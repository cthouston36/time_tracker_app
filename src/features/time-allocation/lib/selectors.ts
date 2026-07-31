import type { AuthUser } from "@/lib/auth/types";
import type { PayItem, Project } from "@/lib/procore/types";
import type {
  MyJobsByUser,
  NetSuiteProjectManagerOption,
  ProcoreSyncSummary,
  ProjectArchiveById,
  ProjectBlacklistById,
  SyncLogEntry
} from "@/features/time-allocation/types";

export function sortProjectsByName(projects: unknown) {
  return normalizeProjectList(projects).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

export function normalizeProjectList(projects: unknown): Project[] {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .map(normalizeProject)
    .filter((project): project is Project => project !== null);
}

export function normalizeProject(project: unknown): Project | null {
  if (!project || typeof project !== "object") {
    return null;
  }

  const projectRecord = project as Partial<Project>;
  const id = readTextValue(projectRecord.id);
  const name = readTextValue(projectRecord.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    netSuiteProjectId: readTextValue(projectRecord.netSuiteProjectId) || undefined,
    netSuiteProjectManagerId: readTextValue(projectRecord.netSuiteProjectManagerId) || undefined,
    netSuiteProjectManagerName: readTextValue(projectRecord.netSuiteProjectManagerName) || undefined,
    payItems: normalizePayItemList(projectRecord.payItems),
    procoreProjectId: readTextValue(projectRecord.procoreProjectId) || id,
    sourceSystem: projectRecord.sourceSystem === "netsuite" ? "netsuite" : "procore"
  };
}

export function normalizePayItemList(payItems: unknown): PayItem[] {
  if (!Array.isArray(payItems)) {
    return [];
  }

  return payItems
    .map(normalizePayItem)
    .filter((payItem): payItem is PayItem => payItem !== null)
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" }));
}

export function normalizePayItem(payItem: unknown): PayItem | null {
  if (!payItem || typeof payItem !== "object") {
    return null;
  }

  const payItemRecord = payItem as Partial<PayItem>;
  const id = readTextValue(payItemRecord.id);
  const code = readTextValue(payItemRecord.code);
  const name = readTextValue(payItemRecord.name);

  if (!id || !code || !name) {
    return null;
  }

  const budgetedQuantity = Number(payItemRecord.budgetedQuantity);

  return {
    id,
    code,
    name,
    budgetedQuantity: Number.isFinite(budgetedQuantity) ? budgetedQuantity : 0,
    unitOfMeasure: readTextValue(payItemRecord.unitOfMeasure)
  };
}

export function filterActiveProjects(
  projects: Project[],
  projectBlacklistById: ProjectBlacklistById,
  projectArchiveById: ProjectArchiveById
) {
  return projects.filter((project) => !projectBlacklistById[project.id] && !projectArchiveById[project.id]);
}

export function projectMatchesIdentifier(project: Project, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  return [project.id, project.procoreProjectId, project.netSuiteProjectId, project.name]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.trim().toLowerCase() === normalizedIdentifier);
}

export function getDefaultMyJobIdsForUser(user: AuthUser, projects: Project[]) {
  if (user.role !== "project_manager" || !user.netSuiteProjectManagerId) {
    return [];
  }

  return projects
    .filter((project) => project.netSuiteProjectManagerId === user.netSuiteProjectManagerId)
    .map((project) => project.id);
}

export function getFieldUserIdsAssignedToProject(fieldUsers: AuthUser[], myJobsByUser: MyJobsByUser, projectId: string) {
  return fieldUsers
    .filter((fieldUser) => (myJobsByUser[fieldUser.id] ?? []).includes(projectId))
    .map((fieldUser) => fieldUser.id);
}

export function buildNetSuiteProjectManagerOptions(projects: Project[]): NetSuiteProjectManagerOption[] {
  const optionsById = new Map<string, NetSuiteProjectManagerOption>();

  for (const project of projects) {
    const id = project.netSuiteProjectManagerId?.trim();

    if (!id) {
      continue;
    }

    const name = project.netSuiteProjectManagerName?.trim() || `NetSuite PM ${id}`;
    const existingOption = optionsById.get(id);

    if (!existingOption || existingOption.name.startsWith("NetSuite PM ")) {
      optionsById.set(id, { id, name });
    }
  }

  return Array.from(optionsById.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveNetSuiteProjectManagerOption(id: string, options: NetSuiteProjectManagerOption[]) {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  return options.find((option) => option.id === normalizedId) ?? {
    id: normalizedId,
    name: `NetSuite PM ${normalizedId}`
  };
}

export function getSyncFailedProjects(summary: Partial<ProcoreSyncSummary> | undefined) {
  return Array.isArray(summary?.failedProjects)
    ? summary.failedProjects.map(readTextValue).filter(Boolean)
    : [];
}

export function normalizeSyncSummary(value: unknown): ProcoreSyncSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const summary = value as Partial<ProcoreSyncSummary>;
  const normalizedSummary: ProcoreSyncSummary = {
    attempted: readNumberValue(summary.attempted),
    failed: readNumberValue(summary.failed),
    failedProjects: getSyncFailedProjects(summary),
    skippedExisting: readNumberValue(summary.skippedExisting),
    synced: readNumberValue(summary.synced)
  };

  const optionalFields: Array<keyof Omit<ProcoreSyncSummary, "attempted" | "failed" | "failedProjects" | "skippedExisting" | "synced">> = [
    "autoArchivedProjects",
    "autoUnarchivedProjects",
    "dailyReportOnlyProjects",
    "eligibleProjects",
    "inactiveNetSuiteProjects",
    "payItemProjects",
    "remainingNewProjects",
    "skippedMissingProcoreProjectId",
    "skippedNoPayItems",
    "totalNetSuiteProjects"
  ];

  for (const field of optionalFields) {
    if (summary[field] !== undefined) {
      normalizedSummary[field] = readNumberValue(summary[field]);
    }
  }

  return normalizedSummary;
}

export function normalizeSyncLogEntries(value: unknown): SyncLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeSyncLogEntry)
    .filter((entry): entry is SyncLogEntry => entry !== null);
}

export function normalizeSyncLogEntry(value: unknown): SyncLogEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<SyncLogEntry>;
  const status = entry.status === "error" || entry.status === "warning" || entry.status === "success" ? entry.status : "success";

  return {
    id: readTextValue(entry.id) || createFallbackId(),
    action: readTextValue(entry.action) || "Sync",
    createdAt: readTextValue(entry.createdAt) || new Date().toISOString(),
    message: readTextValue(entry.message),
    status,
    summary: normalizeSyncSummary(entry.summary)
  };
}

export function readTextValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

export function readNumberValue(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function createFallbackId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
