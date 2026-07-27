import { readProcoreCache, updateProcoreCache, writeProcoreCache } from "@/lib/procore/cache";
import type { PayItem, Project } from "@/lib/procore/types";
import { runSuiteQL, runSuiteQLAll } from "@/lib/netsuite/client";

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
  remainingNewProjects?: number;
};

export type NetSuiteSyncResult = {
  projects: Project[];
  summary: NetSuiteSyncSummary;
};

type NetSuiteProjectRow = Record<string, unknown> & {
  entity_id?: unknown;
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

export async function syncProjectsFromNetSuite(): Promise<NetSuiteSyncResult> {
  const sourceProjects = await fetchEligibleNetSuiteProjects();
  const cachedProjects = await readProcoreCache();
  const cachedProjectIds = new Set((cachedProjects?.projects ?? []).map((project) => project.id));
  const newProjects = sourceProjects.projects.filter((project) => !cachedProjectIds.has(project.id));
  const cache = await updateProcoreCache((currentProjects) => [...currentProjects, ...newProjects]);

  return {
    projects: cache.projects,
    summary: {
      attempted: newProjects.length,
      failed: sourceProjects.failedProjects.length,
      failedProjects: sourceProjects.failedProjects,
      skippedExisting: sourceProjects.projects.length - newProjects.length,
      synced: newProjects.length
    }
  };
}

export async function syncAllProjectsFromNetSuite(): Promise<NetSuiteSyncResult> {
  const sourceProjects = await fetchEligibleNetSuiteProjects();
  const cache = await writeProcoreCache(sourceProjects.projects);

  return {
    projects: cache.projects,
    summary: {
      attempted: sourceProjects.projects.length,
      failed: sourceProjects.failedProjects.length,
      failedProjects: sourceProjects.failedProjects,
      skippedExisting: 0,
      synced: sourceProjects.projects.length
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

  const netSuiteProjectId = readString(rowValue(projectRow, "netsuite_project_id", "id"));
  const budgetRows = await fetchNetSuiteBudgetRowsForProject(netSuiteProjectId);
  const mappedProject = mapNetSuiteProject(projectRow, budgetRows);

  if (!mappedProject) {
    throw new Error("The matching NetSuite project is missing a Procore project ID or project title.");
  }

  if (mappedProject.payItems.length === 0) {
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
      netSuiteProjectId: readString(rowValue(row, "netsuite_project_id", "id")),
      projectManagerId: readString(rowValue(row, "project_manager_id")),
      projectManagerName: readString(rowValue(row, "project_manager_name")),
      procoreProjectId: readString(rowValue(row, "procore_project_id")),
      title: readString(rowValue(row, "project_title", "entity_id"))
    })),
    projectTotalResults: projectResponse.totalResults ?? projectResponse.count ?? 0
  };
}

async function fetchEligibleNetSuiteProjects() {
  const [projectRows, budgetLineRows] = await Promise.all([fetchNetSuiteProjectRows(), fetchNetSuiteBudgetLineRows()]);
  const budgetRowsByProjectId = groupBudgetRowsByProjectId(budgetLineRows);
  const projects: MappedNetSuiteProject[] = [];
  const failedProjects: string[] = [];

  for (const projectRow of projectRows) {
    const projectName = readProjectTitle(projectRow);

    if (projectStartsWithTwo(projectName)) {
      continue;
    }

    const netSuiteProjectId = readString(rowValue(projectRow, "netsuite_project_id", "id"));
    const mappedProject = mapNetSuiteProject(projectRow, budgetRowsByProjectId.get(netSuiteProjectId) ?? []);

    if (!mappedProject) {
      failedProjects.push(`${projectName || netSuiteProjectId || "Unknown project"} (missing Procore project ID or project title)`);
      continue;
    }

    if (mappedProject.payItems.length === 0) {
      continue;
    }

    projects.push(mappedProject);
  }

  return {
    failedProjects,
    projects
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
      ${PROJECT_TITLE_FIELD} as project_title,
      ${PROJECT_MANAGER_FIELD} as project_manager_id,
      BUILTIN.DF(${PROJECT_MANAGER_FIELD}) as project_manager_name,
      ${PROCORE_PROJECT_ID_FIELD} as procore_project_id
    from ${NETSUITE_PROJECT_TABLE}
    where isinactive = 'F'
    order by lower(${PROJECT_TITLE_FIELD}), lower(entityid), id
  `;
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
  const payItemsByCode = new Map<string, PayItem>();

  for (const row of rows) {
    const displayValue = readString(rowValue(row, "cost_code"));
    const { code, name } = splitCostCodeDisplay(displayValue);

    if (!code) {
      continue;
    }

    const existingPayItem = payItemsByCode.get(code.toLowerCase());
    const quantity = readNumber(rowValue(row, "quantity"));

    if (!existingPayItem) {
      payItemsByCode.set(code.toLowerCase(), {
        budgetedQuantity: quantity,
        code,
        id: code,
        name: name || code,
        unitOfMeasure: ""
      });
      continue;
    }

    existingPayItem.budgetedQuantity = Math.max(existingPayItem.budgetedQuantity, quantity);
    existingPayItem.name = choosePayItemName(existingPayItem.name, name);
  }

  return Array.from(payItemsByCode.values()).sort((left, right) =>
    left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" })
  );
}

function splitCostCodeDisplay(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  const match = normalizedValue.match(/^([A-Za-z0-9][A-Za-z0-9.\-]*)\s*(?:-\s*)?(.*)$/);

  if (!match) {
    return {
      code: normalizedValue,
      name: normalizedValue
    };
  }

  const code = match[1]?.trim() ?? "";
  const name = match[2]?.trim() ?? "";

  return {
    code,
    name: name || code
  };
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
  return projectName.trimStart().startsWith("2");
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
