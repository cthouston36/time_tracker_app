import { mockProjects } from "@/lib/data/mock-projects";
import { readProcoreCache, updateProcoreCache } from "@/lib/procore/cache";
import { ProcoreClient } from "@/lib/procore/client";
import { getProcoreConfig } from "@/lib/procore/config";
import { getProcoreIntegrationAccessToken } from "@/lib/procore/session";
import type { PayItem, Project } from "@/lib/procore/types";

const PROCORE_PROJECT_SYNC_DELAY_MS = 350;

export type ProcoreSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skippedExisting: number;
  failedProjects: string[];
};

export type ProcoreSyncResult = {
  projects: Project[];
  summary: ProcoreSyncSummary;
};

export async function getProjects(): Promise<Project[]> {
  const cache = await readProcoreCache();
  return cache?.projects.map((project) => ({
    ...project,
    payItems: dedupePayItems(project.payItems)
  })) ?? [];
}

export async function getCachedProjectPayItems(projectId: string): Promise<PayItem[]> {
  const cache = await readProcoreCache();
  const payItems = cache?.projects.find((project) => project.id === projectId)?.payItems ?? [];
  return dedupePayItems(payItems);
}

export async function syncProjectsFromProcore(): Promise<ProcoreSyncResult> {
  const procoreProjects = await fetchEligibleProcoreProjects();
  const cachedProjects = await getProjects();
  const cachedProjectIds = new Set(cachedProjects.map((project) => project.id));
  const newProjects = procoreProjects.filter((project) => !cachedProjectIds.has(String(project.id)));
  const { failedProjects, projects: newProjectsWithPayItems } = await loadProjectsWithPayItemsSequentially(newProjects);
  const cache = await updateProcoreCache((currentProjects) => [...currentProjects, ...newProjectsWithPayItems]);

  return {
    projects: cache.projects,
    summary: {
      attempted: newProjects.length,
      synced: newProjectsWithPayItems.length,
      failed: failedProjects.length,
      skippedExisting: procoreProjects.length - newProjects.length,
      failedProjects
    }
  };
}

export async function syncAllProjectsFromProcore(): Promise<ProcoreSyncResult> {
  const procoreProjects = await fetchEligibleProcoreProjects();
  const { failedProjects, projects: projectsWithPayItems } = await loadProjectsWithPayItemsSequentially(procoreProjects);
  const cache = await updateProcoreCache((currentProjects) => {
    const syncedProjectIds = new Set(projectsWithPayItems.map((project) => project.id));
    const unchangedProjects = currentProjects.filter((project) => !syncedProjectIds.has(project.id));

    return [...unchangedProjects, ...projectsWithPayItems];
  });

  return {
    projects: cache.projects,
    summary: {
      attempted: procoreProjects.length,
      synced: projectsWithPayItems.length,
      failed: failedProjects.length,
      skippedExisting: 0,
      failedProjects
    }
  };
}

export async function addOrUpdateProjectFromProcore(projectId: string): Promise<Project[]> {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    throw new Error("Procore has not been configured by an admin.");
  }

  const cache = await readProcoreCache();
  const cachedProject = cache?.projects.find((project) => project.id === projectId);
  const procoreProject = cachedProject
    ? {
        id: cachedProject.id,
        name: cachedProject.name
      }
    : await findEligibleProcoreProject(projectId);

  if (!procoreProject) {
    throw new Error("No eligible Procore project found for that ID.");
  }

  const payItems = await getProjectPayItemsFromProcore(projectId);

  if (payItems.length === 0) {
    throw new Error("Procore returned no pay items for the selected project.");
  }

  const mappedProject = cachedProject ?? mapProcoreProject(procoreProject);
  const updatedProject = {
    ...mappedProject,
    payItems
  };
  const updatedCache = await updateProcoreCache((currentProjects) => {
    const projectExists = currentProjects.some((project) => project.id === projectId);

    if (projectExists) {
      return currentProjects.map((project) => (project.id === projectId ? updatedProject : project));
    }

    return [...currentProjects, updatedProject];
  });

  return updatedCache.projects;
}

function mapProcoreProject(project: ProcoreProject): Project {
  return {
    id: String(project.id),
    name: firstString(project.name, project.display_name, project.number, project.project_number, project.job_number),
    payItems: []
  };
}

async function fetchEligibleProcoreProjects() {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    throw new Error("Procore has not been configured by an admin.");
  }

  const config = getProcoreConfig();
  const client = new ProcoreClient({ accessToken, baseUrl: config.baseUrl });
  const params = new URLSearchParams({ company_id: config.companyId });
  const procoreProjects = await client.get<ProcoreProject[]>("/rest/v1.0/projects", params);

  return procoreProjects.filter((project) => !projectStartsWithTwo(project));
}

async function findEligibleProcoreProject(projectId: string) {
  const procoreProjects = await fetchEligibleProcoreProjects();
  return procoreProjects.find((project) => String(project.id) === projectId) ?? null;
}

async function loadProjectWithPayItems(project: ProcoreProject) {
  const mappedProject = mapProcoreProject(project);

  const payItems = await getProjectPayItems(mappedProject.id);

  if (payItems.length === 0) {
    return null;
  }

  return {
    ...mappedProject,
    payItems
  };
}

async function loadProjectsWithPayItemsSequentially(projects: ProcoreProject[]) {
  const loadedProjects: Project[] = [];
  const failedProjects: string[] = [];

  for (const [index, project] of projects.entries()) {
    try {
      const loadedProject = await loadProjectWithPayItems(project);

      if (loadedProject) {
        loadedProjects.push(loadedProject);
      } else {
        failedProjects.push(`${mapProcoreProject(project).name} (no budget lines returned)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failedProjects.push(`${mapProcoreProject(project).name} (${message})`);

      if (isRateLimitError(error)) {
        const remainingProjectCount = projects.length - index - 1;

        if (remainingProjectCount > 0) {
          failedProjects.push(`${remainingProjectCount} project${remainingProjectCount === 1 ? "" : "s"} not attempted because the Procore rate limit was reached.`);
        }

        break;
      }
    }

    if (index < projects.length - 1) {
      await delay(PROCORE_PROJECT_SYNC_DELAY_MS);
    }
  }

  return {
    failedProjects,
    projects: loadedProjects
  };
}

function isRateLimitError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("rate limit");
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type ProcoreProject = {
  id: number | string;
  name?: string;
  display_name?: string;
  number?: string | number;
  project_number?: string | number;
  job_number?: string | number;
};

function projectStartsWithTwo(project: ProcoreProject) {
  return [
    project.number,
    project.project_number,
    project.job_number,
    project.name,
    project.display_name
  ].some((value) => firstString(value).trimStart().startsWith("2"));
}

export async function getMockProjects(): Promise<Project[]> {
  return mockProjects;
}

export async function getProjectPayItems(projectId: string): Promise<PayItem[]> {
  return getProjectPayItemsFromProcore(projectId);
}

async function getProjectPayItemsFromProcore(projectId: string): Promise<PayItem[]> {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    return mockProjects.find((project) => project.id === projectId)?.payItems ?? [];
  }

  const config = getProcoreConfig();
  const client = new ProcoreClient({ accessToken, baseUrl: config.baseUrl });
  const params = new URLSearchParams({
    company_id: config.companyId,
    project_id: projectId
  });

  const response = await client.get<ProcoreBudgetLineItem[] | { data?: ProcoreBudgetLineItem[] }>(
    "/rest/v1.0/budget_line_items",
    params
  );
  const lineItems = Array.isArray(response) ? response : response.data ?? [];

  return dedupePayItems(lineItems.map(mapProcoreBudgetLineItem).filter((payItem) => payItem.code || payItem.name));
}

function dedupePayItems(payItems: PayItem[]) {
  const payItemsByKey = new Map<string, PayItem>();

  for (const payItem of payItems) {
    const key = buildPayItemDedupeKey(payItem);
    const existingPayItem = payItemsByKey.get(key);

    if (!existingPayItem) {
      payItemsByKey.set(key, {
        ...payItem,
        id: key,
        unitOfMeasure: normalizeUnitOfMeasure(payItem.unitOfMeasure)
      });
      continue;
    }

    payItemsByKey.set(key, {
      ...existingPayItem,
      name: existingPayItem.name || payItem.name,
      unitOfMeasure: normalizeUnitOfMeasure(existingPayItem.unitOfMeasure || payItem.unitOfMeasure)
    });
  }

  return Array.from(payItemsByKey.values());
}

function buildPayItemDedupeKey(payItem: PayItem) {
  return [
    payItem.code.trim().toLowerCase(),
    String(payItem.budgetedQuantity),
    payItem.unitOfMeasure.trim().toLowerCase()
  ].join("|");
}

function mapProcoreBudgetLineItem(lineItem: ProcoreBudgetLineItem): PayItem {
  const costCode = lineItem.cost_code;
  const costType = lineItem.cost_type;
  const code = firstString(
    lineItem.code,
    lineItem.cost_code_code,
    costCode?.full_code,
    costCode?.code,
    costCode?.name,
    lineItem.name
  );
  const costTypeName = firstString(costType?.name, lineItem.cost_type_name);
  const name = [firstString(lineItem.description, lineItem.name, costCode?.name, code), costTypeName]
    .filter(Boolean)
    .join(" - ");

  return {
    id: String(lineItem.id ?? code),
    code,
    name: name || code,
    budgetedQuantity: firstNumber(
      lineItem.quantity,
      lineItem.original_quantity,
      lineItem.revised_quantity,
      lineItem.budgeted_quantity,
      lineItem.unit_quantity
    ),
    unitOfMeasure: normalizeUnitOfMeasure(firstString(
      lineItem.unit_of_measure,
      lineItem.uom,
      lineItem.unit,
      lineItem.unit_of_measurement,
      "EA"
    ))
  };
}

function normalizeUnitOfMeasure(unitOfMeasure: string) {
  return unitOfMeasure.trim().toUpperCase();
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return 0;
}

type ProcoreBudgetLineItem = {
  id?: number | string;
  code?: string;
  name?: string;
  description?: string;
  quantity?: number | string;
  original_quantity?: number | string;
  revised_quantity?: number | string;
  budgeted_quantity?: number | string;
  unit_quantity?: number | string;
  unit_of_measure?: string;
  uom?: string;
  unit?: string;
  unit_of_measurement?: string;
  cost_code_code?: string;
  cost_type_name?: string;
  cost_code?: {
    code?: string;
    full_code?: string;
    name?: string;
  };
  cost_type?: {
    name?: string;
  };
};
