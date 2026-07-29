import { readProcoreCache, updateProcoreCache, writeProcoreCache } from "@/lib/procore/cache";
import { projectNameStartsWithTwo } from "@/lib/daily-report-templates";
import { splitCostCodeDisplay } from "@/lib/pay-items";
import type { PayItem, Project } from "@/lib/procore/types";
import { runSuiteQL, runSuiteQLAll } from "@/lib/netsuite/client";
import { setProjectArchiveForProjects } from "@/lib/project-controls-store";

const NETSUITE_PROJECT_TABLE = "job";
const NETSUITE_BUDGET_LINE_TABLE = "customrecord_hrc_pci_budgetviewdetailrow";
const PROJECT_TITLE_FIELD = "custentity_r_it_pc_project_number";
const PROCORE_PROJECT_ID_FIELD = "custentity_hrc_pci_projectid";
const PROJECT_MANAGER_FIELD = "projectmanager";
const BUDGET_LINE_PROJECT_FIELD = "custrecord_hrc_pci_bvl_project";
const BUDGET_LINE_COST_CODE_FIELD = "custrecord_hrc_pci_cost_code";
const BUDGET_LINE_QUANTITY_FIELD = "custrecord_hrc_pci_bvdr_quantity";

export type NetSuiteSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skippedExisting: number;
  failedProjects: string[];
  dailyReportOnlyProjects?: number;
  eligibleProjects?: number;
  inactiveNetSuiteProjects?: number;
  autoArchivedProjects?: number;
  payItemProjects?: number;
  remainingNewProjects?: number;
  skippedMissingProcoreProjectId?: number;
  skippedNoPayItems?: number;
  totalNetSuiteProjects?: number;
};

export type NetSuiteSyncResult = {
  projects: Project[];
  summary: NetSuiteSyncSummary;
};

type NetSuiteProjectRow = Record<string, unknown> & {
  entity_id?: unknown;
  is_inactive?: unknown;
  netsuite_project_id?: unknown;
  project_manager_id?: unknown;
  project_manager_name?: unknown;
  procore_project_id?: unknown;
  project_title?: unknown;
};

type NetSuiteBudgetLineRow = Record<string, unknown> & {
  budget_line_id?: unknown;
  cost_code?: unknown;
  netsuite_project_id?: unknown;
  quantity?: unknown;
};

type MappedNetSuiteProject = Project & {
  netSuiteProjectId: string;
  procoreProjectId: string;
};

type EligibleNetSuiteProjectsResult = {
  dailyReportOnlyProjects: number;
  failedProjects: string[];
  inactiveNetSuiteProjectIds: string[];
  inactiveNetSuiteProjects: number;
  payItemProjects: number;
  projects: MappedNetSuiteProject[];
  skippedMissingProcoreProjectId: number;
  skippedNoPayItems: number;
  totalNetSuiteProjects: number;
};

export async function syncProjectsFromNetSuite(): Promise<NetSuiteSyncResult> {
  const sourceProjects = await fetchEligibleNetSuiteProjects();
  const autoArchivedProjects = (await archiveInactiveNetSuiteProjects(sourceProjects.inactiveNetSuiteProjectIds)) ?? 0;
  const cachedProjects = await readProcoreCache();
  const cachedProjectIds = new Set((cachedProjects?.projects ?? []).map((project) => project.id));
  const newProjects = sourceProjects.projects.filter((project) => !cachedProjectIds.has(project.id));
  const cache = await updateProcoreCache((currentProjects) => [...currentProjects, ...newProjects]);

  return {
    projects: cache.projects,
    summary: {
      attempted: newProjects.length,
      autoArchivedProjects,
      dailyReportOnlyProjects: sourceProjects.dailyReportOnlyProjects,
      eligibleProjects: sourceProjects.projects.length,
      failed: sourceProjects.failedProjects.length,
      failedProjects: sourceProjects.failedProjects,
      inactiveNetSuiteProjects: sourceProjects.inactiveNetSuiteProjects,
      payItemProjects: sourceProjects.payItemProjects,
      skippedExisting: sourceProjects.projects.length - newProjects.length,
      skippedMissingProcoreProjectId: sourceProjects.skippedMissingProcoreProjectId,
      skippedNoPayItems: sourceProjects.skippedNoPayItems,
      synced: newProjects.length,
      totalNetSuiteProjects: sourceProjects.totalNetSuiteProjects
    }
  };
}

export async function syncAllProjectsFromNetSuite(): Promise<NetSuiteSyncResult> {
  const sourceProjects = await fetchEligibleNetSuiteProjects();
  const autoArchivedProjects = (await archiveInactiveNetSuiteProjects(sourceProjects.inactiveNetSuiteProjectIds)) ?? 0;
  const existingCache = await readProcoreCache();
  const activeProjectIds = new Set(sourceProjects.projects.map((project) => project.id));
  const inactiveProjectIds = new Set(sourceProjects.inactiveNetSuiteProjectIds);
  const archivedInactiveProjects = (existingCache?.projects ?? []).filter(
    (project) => inactiveProjectIds.has(project.id) && !activeProjectIds.has(project.id)
  );
  const cache = await writeProcoreCache([...sourceProjects.projects, ...archivedInactiveProjects]);

  return {
    projects: cache.projects,
    summary: {
      attempted: sourceProjects.projects.length,
      autoArchivedProjects,
      dailyReportOnlyProjects: sourceProjects.dailyReportOnlyProjects,
      eligibleProjects: sourceProjects.projects.length,
      failed: sourceProjects.failedProjects.length,
      failedProjects: sourceProjects.failedProjects,
      inactiveNetSuiteProjects: sourceProjects.inactiveNetSuiteProjects,
      payItemProjects: sourceProjects.payItemProjects,
      skippedExisting: 0,
      skippedMissingProcoreProjectId: sourceProjects.skippedMissingProcoreProjectId,
      skippedNoPayItems: sourceProjects.skippedNoPayItems,
      synced: sourceProjects.projects.length,
      totalNetSuiteProjects: sourceProjects.totalNetSuiteProjects
    }
  };
}

export async function addOrUpdateProjectFromNetSuite(projectIdentifier: string) {
  const trimmedProjectIdentifier = projectIdentifier.trim();

  if (!trimmedProjectIdentifier) {
    throw new Error("Enter a NetSuite or Procore project ID.");
  }

  const projectRows = await fetchNetSuiteProjectRows();
  const projectRow = projectRows.find((row) => matchesProjectIdentifier(row, trimmedProjectIdentifier));

  if (!projectRow) {
    throw new Error("No NetSuite project matched that NetSuite or Procore project ID.");
  }

  if (projectIsInactive(projectRow)) {
    const procoreProjectId = readString(rowValue(projectRow, "procore_project_id"));

    if (procoreProjectId) {
      await archiveInactiveNetSuiteProjects([procoreProjectId]);
    }

    throw new Error("The matching NetSuite project is inactive. It was archived in the app if it had already been cached.");
  }

  const projectName = readProjectTitle(projectRow);
  const netSuiteProjectId = readString(rowValue(projectRow, "netsuite_project_id", "id"));
  const isTwoSeriesProject = projectStartsWithTwo(projectName);
  const budgetRows = isTwoSeriesProject ? [] : await fetchNetSuiteBudgetRowsForProject(netSuiteProjectId);
  const mappedProject = mapNetSuiteProject(projectRow, budgetRows);

  if (!mappedProject) {
    throw new Error("The matching NetSuite project is missing a Procore project ID or project title.");
  }

  if (!isTwoSeriesProject && mappedProject.payItems.length === 0) {
    throw new Error("NetSuite returned no budget pay items for the selected project.");
  }

  const updatedCache = await updateProcoreCache((currentProjects) => {
    const projectExists = currentProjects.some((project) => project.id === mappedProject.id);

    if (projectExists) {
      return currentProjects.map((project) => (project.id === mappedProject.id ? mappedProject : project));
    }

    return [...currentProjects, mappedProject];
  });

  return updatedCache.projects;
}

export async function getNetSuiteConnectionTest() {
  const [projectResponse, budgetLineResponse] = await Promise.all([
    runSuiteQL<NetSuiteProjectRow>(buildProjectQuery(), { limit: 5 }),
    runSuiteQL<NetSuiteBudgetLineRow>(buildBudgetLineQuery(), { limit: 5 })
  ]);

  return {
    budgetLineSample: (budgetLineResponse.items ?? []).map((row) => ({
      costCode: readString(rowValue(row, "cost_code")),
      netSuiteProjectId: readString(rowValue(row, "netsuite_project_id")),
      quantity: readNumber(rowValue(row, "quantity"))
    })),
    budgetLineTotalResults: budgetLineResponse.totalResults ?? budgetLineResponse.count ?? 0,
    projectSample: (projectResponse.items ?? []).map((row) => ({
      entityId: readString(rowValue(row, "entity_id")),
      inactive: projectIsInactive(row),
      netSuiteProjectId: readString(rowValue(row, "netsuite_project_id", "id")),
      projectManagerId: readString(rowValue(row, "project_manager_id")),
      projectManagerName: readString(rowValue(row, "project_manager_name")),
      procoreProjectId: readString(rowValue(row, "procore_project_id")),
      title: readString(rowValue(row, "project_title", "entity_id"))
    })),
    projectTotalResults: projectResponse.totalResults ?? projectResponse.count ?? 0
  };
}

async function fetchEligibleNetSuiteProjects(): Promise<EligibleNetSuiteProjectsResult> {
  const [projectRows, budgetLineRows] = await Promise.all([fetchNetSuiteProjectRows(), fetchNetSuiteBudgetLineRows()]);
  const budgetRowsByProjectId = groupBudgetRowsByProjectId(budgetLineRows);
  const projects: MappedNetSuiteProject[] = [];
  const failedProjects: string[] = [];
  let dailyReportOnlyProjects = 0;
  let payItemProjects = 0;
  let inactiveNetSuiteProjects = 0;
  const inactiveNetSuiteProjectIds: string[] = [];
  let skippedMissingProcoreProjectId = 0;
  let skippedNoPayItems = 0;

  for (const projectRow of projectRows) {
    const projectName = readProjectTitle(projectRow);

    const netSuiteProjectId = readString(rowValue(projectRow, "netsuite_project_id", "id"));
    const isTwoSeriesProject = projectStartsWithTwo(projectName);
    const procoreProjectId = readString(rowValue(projectRow, "procore_project_id"));

    if (projectIsInactive(projectRow)) {
      inactiveNetSuiteProjects += 1;

      if (procoreProjectId) {
        inactiveNetSuiteProjectIds.push(procoreProjectId);
      }

      continue;
    }

    if (!procoreProjectId) {
      skippedMissingProcoreProjectId += 1;
      continue;
    }

    const mappedProject = mapNetSuiteProject(
      projectRow,
      isTwoSeriesProject ? [] : budgetRowsByProjectId.get(netSuiteProjectId) ?? []
    );

    if (!mappedProject) {
      failedProjects.push(`${projectName || netSuiteProjectId || "Unknown project"} (missing Procore project ID or project title)`);
      continue;
    }

    if (!isTwoSeriesProject && mappedProject.payItems.length === 0) {
      skippedNoPayItems += 1;
      continue;
    }

    if (isTwoSeriesProject) {
      dailyReportOnlyProjects += 1;
    } else {
      payItemProjects += 1;
    }

    projects.push(mappedProject);
  }

  return {
    dailyReportOnlyProjects,
    failedProjects,
    inactiveNetSuiteProjectIds: Array.from(new Set(inactiveNetSuiteProjectIds)),
    inactiveNetSuiteProjects,
    payItemProjects,
    projects,
    skippedMissingProcoreProjectId,
    skippedNoPayItems,
    totalNetSuiteProjects: projectRows.length
  };
}

async function fetchNetSuiteProjectRows() {
  return runSuiteQLAll<NetSuiteProjectRow>(buildProjectQuery());
}

async function fetchNetSuiteBudgetLineRows() {
  return runSuiteQLAll<NetSuiteBudgetLineRow>(buildBudgetLineQuery());
}

async function fetchNetSuiteBudgetRowsForProject(netSuiteProjectId: string) {
  if (!/^\d+$/.test(netSuiteProjectId)) {
    throw new Error("NetSuite project ID must be numeric before budget lines can be loaded.");
  }

  return runSuiteQLAll<NetSuiteBudgetLineRow>(`${buildBudgetLineQuery()} and ${BUDGET_LINE_PROJECT_FIELD} = ${netSuiteProjectId}`);
}

function buildProjectQuery() {
  return `
    select
      id as netsuite_project_id,
      entityid as entity_id,
      isinactive as is_inactive,
      ${PROJECT_TITLE_FIELD} as project_title,
      ${PROJECT_MANAGER_FIELD} as project_manager_id,
      BUILTIN.DF(${PROJECT_MANAGER_FIELD}) as project_manager_name,
      ${PROCORE_PROJECT_ID_FIELD} as procore_project_id
    from ${NETSUITE_PROJECT_TABLE}
    order by lower(${PROJECT_TITLE_FIELD}), lower(entityid), id
  `;
}

async function archiveInactiveNetSuiteProjects(projectIds: string[]) {
  return setProjectArchiveForProjects(projectIds, true);
}

function buildBudgetLineQuery() {
  return `
    select
      id as budget_line_id,
      ${BUDGET_LINE_PROJECT_FIELD} as netsuite_project_id,
      BUILTIN.DF(${BUDGET_LINE_COST_CODE_FIELD}) as cost_code,
      ${BUDGET_LINE_QUANTITY_FIELD} as quantity
    from ${NETSUITE_BUDGET_LINE_TABLE}
    where ${BUDGET_LINE_PROJECT_FIELD} is not null
      and ${BUDGET_LINE_COST_CODE_FIELD} is not null
  `;
}

function groupBudgetRowsByProjectId(rows: NetSuiteBudgetLineRow[]) {
  const rowsByProjectId = new Map<string, NetSuiteBudgetLineRow[]>();

  for (const row of rows) {
    const projectId = readString(rowValue(row, "netsuite_project_id"));

    if (!projectId) {
      continue;
    }

    const projectRows = rowsByProjectId.get(projectId) ?? [];
    projectRows.push(row);
    rowsByProjectId.set(projectId, projectRows);
  }

  return rowsByProjectId;
}

function mapNetSuiteProject(projectRow: NetSuiteProjectRow, budgetRows: NetSuiteBudgetLineRow[]): MappedNetSuiteProject | null {
  const netSuiteProjectId = readString(rowValue(projectRow, "netsuite_project_id", "id"));
  const procoreProjectId = readString(rowValue(projectRow, "procore_project_id"));
  const name = readProjectTitle(projectRow);

  if (!netSuiteProjectId || !procoreProjectId || !name) {
    return null;
  }

  return {
    id: procoreProjectId,
    name,
    netSuiteProjectId,
    netSuiteProjectManagerId: readString(rowValue(projectRow, "project_manager_id")) || undefined,
    netSuiteProjectManagerName: readString(rowValue(projectRow, "project_manager_name")) || undefined,
    payItems: dedupeNetSuitePayItems(budgetRows),
    procoreProjectId,
    sourceSystem: "netsuite"
  };
}

function dedupeNetSuitePayItems(rows: NetSuiteBudgetLineRow[]) {
  const payItemsByCode = new Map<string, PayItem & { sourceCodeQuantities: Map<string, number> }>();

  for (const row of rows) {
    const displayValue = readString(rowValue(row, "cost_code"));
    const { code, name, sourceCode } = splitCostCodeDisplay(displayValue);

    if (!code) {
      continue;
    }

    const existingPayItem = payItemsByCode.get(code.toLowerCase());
    const quantity = readNumber(rowValue(row, "quantity"));
    const sourceCodeKey = (sourceCode || code).toLowerCase();

    if (!existingPayItem) {
      payItemsByCode.set(code.toLowerCase(), {
        budgetedQuantity: quantity,
        code,
        id: code,
        name: name || code,
        sourceCodeQuantities: new Map([[sourceCodeKey, quantity]]),
        unitOfMeasure: ""
      });
      continue;
    }

    const existingSourceQuantity = existingPayItem.sourceCodeQuantities.get(sourceCodeKey);

    if (existingSourceQuantity === undefined) {
      existingPayItem.budgetedQuantity += quantity;
      existingPayItem.sourceCodeQuantities.set(sourceCodeKey, quantity);
    } else if (quantity > existingSourceQuantity) {
      existingPayItem.budgetedQuantity += quantity - existingSourceQuantity;
      existingPayItem.sourceCodeQuantities.set(sourceCodeKey, quantity);
    }

    existingPayItem.name = choosePayItemName(existingPayItem.name, name);
  }

  return Array.from(payItemsByCode.values())
    .map((payItem) => ({
      budgetedQuantity: payItem.budgetedQuantity,
      code: payItem.code,
      id: payItem.id,
      name: payItem.name,
      unitOfMeasure: payItem.unitOfMeasure
    }))
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" }));
}

function choosePayItemName(existingName: string, nextName: string) {
  if (!nextName) {
    return existingName;
  }

  if (!existingName || existingName === nextName || existingName.length >= nextName.length) {
    return existingName;
  }

  return nextName;
}

function matchesProjectIdentifier(projectRow: NetSuiteProjectRow, projectIdentifier: string) {
  return [
    rowValue(projectRow, "netsuite_project_id", "id"),
    rowValue(projectRow, "procore_project_id"),
    rowValue(projectRow, "project_title"),
    rowValue(projectRow, "entity_id")
  ]
    .map(readString)
    .some((value) => value.toLowerCase() === projectIdentifier.toLowerCase());
}

function readProjectTitle(projectRow: NetSuiteProjectRow) {
  return readString(rowValue(projectRow, "project_title")) || readString(rowValue(projectRow, "entity_id"));
}

function projectStartsWithTwo(projectName: string) {
  return projectNameStartsWithTwo(projectName);
}

function projectIsInactive(projectRow: NetSuiteProjectRow) {
  return readBoolean(rowValue(projectRow, "is_inactive", "isinactive"));
}

function rowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }

    const matchingKey = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());

    if (matchingKey) {
      return row[matchingKey];
    }
  }

  return undefined;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.replace(/,/g, ""));

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return normalizedValue === "t" || normalizedValue === "true" || normalizedValue === "yes" || normalizedValue === "y";
  }

  return false;
}
