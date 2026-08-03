import type {
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
export {
  deleteDatabaseDayEntries,
  deleteDatabaseEntry,
  loadDatabaseEntries,
  saveDatabaseEntries
} from "@/features/time-allocation/lib/entries-api";
export {
  addDatabaseCrewMemberToProject,
  loadDatabaseCrewData,
  mergeDatabaseCrewMembers,
  removeDatabaseCrewMemberFromProject,
  updateDatabaseCrewMember
} from "@/features/time-allocation/lib/crew-api";

const PROCORE_SYNC_REQUEST_TIMEOUT_MS = 55_000;

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
