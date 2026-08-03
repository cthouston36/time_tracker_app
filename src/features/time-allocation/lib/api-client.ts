import type { AllocationEntry } from "@/lib/domain/types";
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
  ProjectsResponse
} from "@/features/time-allocation/types";
import { isAbortError, readApiJson, type OkResponse } from "@/features/time-allocation/lib/api-utils";

export { readApiError, readApiJson, readDownloadFileName } from "@/features/time-allocation/lib/api-utils";
export {
  clearDatabaseProjectCatalog,
  clearDatabaseStagingOperationalData,
  loadAssignableFieldUsers,
  loadDatabaseProjectControls,
  saveDatabaseMyJobs,
  saveDatabaseProjectArchive,
  saveDatabaseProjectBlacklist,
  saveDatabaseProjectFieldUsers,
  saveDatabaseSyncLogEntry
} from "@/features/time-allocation/lib/project-controls-api";
export {
  loadDatabaseNetSuiteVendors,
  saveDatabaseNetSuiteVendorBlacklist,
  syncDatabaseNetSuiteVendors
} from "@/features/time-allocation/lib/netsuite-vendors-api";

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
