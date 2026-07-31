import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry } from "@/lib/procore/types";
import type {
  CrewMember,
  CrewMembersByProject,
  DailyReport,
  DailyReportUpload,
  DailyReportsByKey,
  DailyReportUploadsByKey,
  DaySubmission,
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  JobImageUpload,
  MyJobsByUser,
  NetSuiteVendor,
  ProjectArchiveById,
  ProjectBlacklistById,
  ProjectsResponse,
  SyncLogEntry,
  VendorBlacklistById
} from "@/features/time-allocation/types";

const PROCORE_SYNC_REQUEST_TIMEOUT_MS = 55_000;

type EntriesResponse = {
  databaseConfigured?: boolean;
  entries?: AllocationEntry[];
  error?: string;
};

type CrewDataResponse = {
  crewDirectory?: CrewMember[];
  crewMembersByProject?: CrewMembersByProject;
  databaseConfigured?: boolean;
  error?: string;
};

type DailyReportsResponse = {
  dailyReportUploadsByKey?: DailyReportUploadsByKey;
  dailyReportsByKey?: DailyReportsByKey;
  databaseConfigured?: boolean;
  error?: string;
};

type JobImagesResponse = {
  databaseConfigured?: boolean;
  error?: string;
  uploads?: JobImageUpload[];
};

type DayRecordsResponse = {
  dayEntryNotesByKey?: DayEntryNotesByKey;
  daySubmissions?: DaySubmissionsByKey;
  databaseConfigured?: boolean;
  error?: string;
};

type ProjectControlsResponse = {
  myJobsByUser?: MyJobsByUser;
  projectArchiveById?: ProjectArchiveById;
  projectBlacklistById?: ProjectBlacklistById;
  syncLog?: SyncLogEntry[];
  databaseConfigured?: boolean;
  error?: string;
};

type NetSuiteVendorsResponse = {
  allVendors?: NetSuiteVendor[];
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
  syncedAt?: string | null;
  vendorBlacklistById?: VendorBlacklistById;
  vendors?: NetSuiteVendor[];
};

type FieldUsersResponse = {
  databaseConfigured?: boolean;
  error?: string;
  users?: AuthUser[];
};

type AdminClearStagingDataResponse = {
  cleared?: Record<string, unknown>;
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
};

type AdminClearProjectCacheResponse = {
  cleared?: {
    appSettings: number;
    payItems: number;
    projects: number;
    syncState: number;
  };
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
};

type OkResponse = {
  error?: string;
  ok?: boolean;
};

export async function loadDatabaseEntries() {
  try {
    const response = await fetch("/api/entries", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as EntriesResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return data.entries ?? [];
  } catch {
    return null;
  }
}

export async function saveDatabaseEntries(entries: AllocationEntry[]) {
  const response = await fetch("/api/entries", {
    body: JSON.stringify({ entries }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to save entries.");
  }
}

export async function deleteDatabaseEntry(entryId: string) {
  const response = await fetch(`/api/entries?entryId=${encodeURIComponent(entryId)}`, {
    method: "DELETE"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete entry.");
  }
}

export async function deleteDatabaseDayEntries(projectId: string, date: string) {
  const response = await fetch(
    `/api/entries?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete day entries.");
  }
}

export async function loadDatabaseCrewData() {
  try {
    const response = await fetch("/api/crew", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as CrewDataResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      crewDirectory: data.crewDirectory ?? [],
      crewMembersByProject: data.crewMembersByProject ?? {}
    };
  } catch {
    return null;
  }
}

export async function addDatabaseCrewMemberToProject(projectId: string, crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "add_to_project",
      crewMember,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save crew member.");
  }
}

export async function updateDatabaseCrewMember(crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "update_member",
      crewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to update crew member.");
  }
}

export async function removeDatabaseCrewMemberFromProject(projectId: string, crewMemberId: string) {
  const response = await fetch(
    `/api/crew?projectId=${encodeURIComponent(projectId)}&crewMemberId=${encodeURIComponent(crewMemberId)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to remove crew member from project.");
  }
}

export async function mergeDatabaseCrewMembers(sourceCrewMemberId: string, targetCrewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "merge",
      sourceCrewMemberId,
      targetCrewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to merge crew members.");
  }
}

export async function loadDatabaseDailyReportData() {
  try {
    const response = await fetch("/api/daily-reports", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as DailyReportsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      dailyReportUploadsByKey: data.dailyReportUploadsByKey ?? {},
      dailyReportsByKey: data.dailyReportsByKey ?? {}
    };
  } catch {
    return null;
  }
}

export async function saveDatabaseDailyReport(projectId: string, date: string, dailyReport: DailyReport) {
  const response = await fetch("/api/daily-reports", {
    body: JSON.stringify({
      action: "save_report",
      dailyReport,
      date,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save daily report.");
  }
}

export async function saveDatabaseDailyReportUpload(projectId: string, date: string, dailyReportUpload: DailyReportUpload) {
  const response = await fetch("/api/daily-reports", {
    body: JSON.stringify({
      action: "save_upload",
      dailyReportUpload,
      date,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save daily report upload status.");
  }
}

export async function deleteDatabaseDailyReportUpload(projectId: string, date: string) {
  const response = await fetch(
    `/api/daily-reports?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}&kind=upload`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear daily report upload status.");
  }
}

export async function loadDatabaseJobImageUploads(projectId: string, date: string) {
  try {
    const response = await fetch(
      `/api/job-images?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
      {
        cache: "no-store"
      }
    );
    const data = (await readApiJson(response)) as JobImagesResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return data.uploads ?? [];
  } catch {
    return null;
  }
}

export async function loadDatabaseDayRecords() {
  try {
    const response = await fetch("/api/day-records", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as DayRecordsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      dayEntryNotesByKey: data.dayEntryNotesByKey ?? {},
      daySubmissions: data.daySubmissions ?? {}
    };
  } catch {
    return null;
  }
}

export async function saveDatabaseDaySubmission(projectId: string, date: string, daySubmission: DaySubmission) {
  const response = await fetch("/api/day-records", {
    body: JSON.stringify({
      action: "save_submission",
      date,
      daySubmission,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save day status.");
  }
}

export async function deleteDatabaseDaySubmission(projectId: string, date: string) {
  const response = await fetch(
    `/api/day-records?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to delete day status.");
  }
}

export async function loadDatabaseProjectControls() {
  try {
    const response = await fetch("/api/project-controls", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as ProjectControlsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      myJobsByUser: data.myJobsByUser ?? {},
      projectArchiveById: data.projectArchiveById ?? {},
      projectBlacklistById: data.projectBlacklistById ?? {},
      syncLog: data.syncLog ?? []
    };
  } catch {
    return null;
  }
}

export async function loadDatabaseNetSuiteVendors() {
  try {
    const response = await fetch("/api/netsuite/vendors", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return buildNetSuiteVendorResult(data);
  } catch {
    return null;
  }
}

export async function syncDatabaseNetSuiteVendors() {
  const response = await fetch("/api/netsuite/vendors", {
    method: "POST"
  });
  const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to sync NetSuite vendors.");
  }

  return buildNetSuiteVendorResult(data);
}

export async function saveDatabaseNetSuiteVendorBlacklist(vendorId: string, blacklisted: boolean) {
  const response = await fetch("/api/netsuite/vendors", {
    body: JSON.stringify({
      blacklisted,
      vendorId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save NetSuite vendor blacklist.");
  }

  return data.databaseConfigured === false ? null : buildNetSuiteVendorResult(data);
}

export async function saveDatabaseMyJobs(userId: string, projectIds: string[]) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "save_my_jobs",
      projectIds,
      userId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save My Projects.");
  }
}

export async function loadAssignableFieldUsers() {
  const response = await fetch("/api/field-users", {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as FieldUsersResponse;

  if (!response.ok || data.databaseConfigured === false) {
    throw new Error(data.error ?? "Unable to load Field users.");
  }

  return data.users ?? [];
}

export async function saveDatabaseProjectFieldUsers(projectId: string, fieldUserIds: string[]) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "assign_project_field_users",
      fieldUserIds,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as { assignedFieldUserIds?: string[]; error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save Field project access.");
  }

  return data.assignedFieldUserIds ?? fieldUserIds;
}

export async function saveDatabaseProjectBlacklist(projectId: string, blacklisted: boolean) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "set_blacklist",
      blacklisted,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save project blacklist.");
  }
}

export async function saveDatabaseProjectArchive(projectId: string, archived: boolean) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "set_archive",
      archived,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save project archive.");
  }
}

export async function saveDatabaseSyncLogEntry(syncLogEntry: SyncLogEntry) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "add_sync_log",
      syncLogEntry
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save sync log.");
  }
}

export async function clearDatabaseStagingOperationalData() {
  const response = await fetch("/api/admin/clear-staging-data", {
    body: JSON.stringify({
      confirmation: "CLEAR_STAGING_DATA"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as AdminClearStagingDataResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear staging data.");
  }

  return data;
}

export async function clearDatabaseProjectCache() {
  const response = await fetch("/api/admin/clear-project-cache", {
    body: JSON.stringify({
      confirmation: "CLEAR_PROJECT_CACHE"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as AdminClearProjectCacheResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear cached project data.");
  }

  return data;
}

export async function postProjectsWithTimeout(path: string, timeoutMessage: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROCORE_SYNC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      signal: controller.signal
    });
    const data = (await readApiJson(response)) as ProjectsResponse;

    return { data, response };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const data = (await readApiJson(response)) as { error?: string };

    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function readApiJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    if (response.ok) {
      return {};
    }

    throw new Error(`${response.status} ${response.statusText || "Request failed"}`.trim());
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) {
      throw new Error("The server returned an unreadable response.");
    }

    throw new Error(text.slice(0, 300) || `${response.status} ${response.statusText || "Request failed"}`.trim());
  }
}

export function readDownloadFileName(headers: Headers) {
  const contentDisposition = headers.get("content-disposition") ?? "";
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);

  if (encodedMatch) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return quotedMatch?.[1] ?? plainMatch?.[1]?.trim();
}

function buildNetSuiteVendorResult(data: NetSuiteVendorsResponse) {
  return {
    allVendors: data.allVendors ?? data.vendors ?? [],
    syncedAt: data.syncedAt ?? null,
    vendorBlacklistById: data.vendorBlacklistById ?? {},
    vendors: data.vendors ?? []
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
