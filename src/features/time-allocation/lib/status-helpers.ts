import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import type {
  DailyReport,
  DailyReportUpload,
  DaySubmission,
  DaySubmissionsByKey
} from "@/features/time-allocation/types";
import { formatStatusDateTime, getDayKey } from "@/features/time-allocation/lib/date-helpers";

const PROCORE_WEB_BASE_URL = process.env.NEXT_PUBLIC_PROCORE_WEB_BASE_URL ?? "https://us02.procore.com";
const PROCORE_COMPANY_ID = process.env.NEXT_PUBLIC_PROCORE_COMPANY_ID ?? "598134325538800";

export function getEntryCalendarStatus(daySubmission: DaySubmission | undefined, hasSavedEntries: boolean) {
  if (daySubmission?.status === "submitted") {
    return {
      className: "submitted",
      label: "Submitted"
    };
  }

  if (!hasSavedEntries) {
    return {
      className: "not-started",
      label: "Not Started"
    };
  }

  return {
    className: "draft",
    label: "Draft"
  };
}

export function getProjectEntryCalendarStatus(
  project: Project,
  daySubmission: DaySubmission | undefined,
  hasSavedEntries: boolean
) {
  if (isTwoSeriesProject(project)) {
    return getNotApplicableCalendarStatus();
  }

  return getEntryCalendarStatus(daySubmission, hasSavedEntries);
}

export function getProjectWorkTypeLabel(project: Project | null | undefined) {
  if (!project) {
    return "No job type";
  }

  return isTwoSeriesProject(project) ? "Electrical" : "Signal";
}

export function buildEntryDayKeySet(entries: AllocationEntry[]) {
  return new Set(entries.map((entry) => getDayKey(entry.projectId, entry.date)));
}

export function getNotApplicableCalendarStatus() {
  return {
    className: "not-applicable",
    label: "N/A"
  };
}

export function getHasDailyEntryActivity(
  project: Project,
  dayKey: string,
  daySubmissions: DaySubmissionsByKey,
  entryDayKeys: Set<string>
) {
  if (isTwoSeriesProject(project)) {
    return false;
  }

  return entryDayKeys.has(dayKey) || Boolean(daySubmissions[dayKey]);
}

export function getDailyReportCalendarStatus(
  dailyReport: DailyReport | undefined,
  upload: DailyReportUpload | undefined,
  hasDailyEntryActivity = true
) {
  if (isUploadedDailyReportUpload(upload)) {
    return {
      className: "uploaded",
      label: "Uploaded"
    };
  }

  if (upload?.status === "failed") {
    return {
      className: "failed",
      label: "Failed"
    };
  }

  if (upload?.status === "queued" || upload?.status === "processing") {
    return {
      className: "created",
      label: "Pending"
    };
  }

  if (dailyReport) {
    return {
      className: "created",
      label: "Pending"
    };
  }

  if (!hasDailyEntryActivity) {
    return {
      className: "not-started",
      label: "Not Started"
    };
  }

  return {
    className: "missing",
    label: "Missing"
  };
}

export function getDailyReportProcoreStatus(
  dailyReport: DailyReport | undefined,
  upload: DailyReportUpload | undefined,
  projectId: string | undefined,
  userRole: AuthUser["role"]
) {
  if (!dailyReport) {
    return {
      className: "missing",
      label: "Not Submitted",
      message: "Create and save a daily report before uploading to Procore."
    };
  }

  if (isUploadedDailyReportUpload(upload)) {
    const uploadedAt = upload?.uploadedAt ? ` on ${formatStatusDateTime(upload.uploadedAt)}` : "";
    const fileName = upload?.fileName ? ` File: ${upload.fileName}.` : "";
    const folderPath = upload?.folderPath ? ` Folder: ${upload.folderPath}.` : "";
    const folderUrl = normalizeProcoreDocumentsFolderUrl(upload?.folderUrl, upload?.companyId, projectId, upload?.folderId);

    return {
      className: "uploaded",
      href: folderUrl,
      label: "Uploaded",
      message: userRole === "admin" ? `Uploaded to Procore${uploadedAt}.${fileName}${folderPath}` : `Uploaded${uploadedAt}.`
    };
  }

  if (upload?.status === "failed") {
    const attemptedAt = upload.attemptedAt ? ` on ${new Date(upload.attemptedAt).toLocaleString()}` : "";

    return {
      className: "failed",
      label: "Upload failed",
      message: `Last Procore upload failed${attemptedAt}: ${upload.error ?? "Unknown error."}`
    };
  }

  if (upload?.status === "queued" || upload?.status === "processing") {
    return {
      className: "pending",
      label: "Pending",
      message:
        upload.status === "processing"
          ? "Procore upload is processing in the background."
          : "Procore upload is queued and will retry automatically."
    };
  }

  return {
    className: "pending",
    label: "Pending",
    message: "Pending upload to Procore. Click Upload to Procore when the daily report is ready."
  };
}

export function isUploadedDailyReportUpload(upload: DailyReportUpload | undefined) {
  return Boolean(upload && (upload.status === "uploaded" || (!upload.status && upload.uploadedAt)));
}

export function normalizeProcoreDocumentsFolderUrl(
  folderUrl: string | undefined,
  companyId: string | undefined,
  projectId: string | undefined,
  folderId: string | undefined
) {
  if (folderUrl && !folderUrl.includes("app.procore.com")) {
    return folderUrl;
  }

  return buildProcoreDocumentsFolderUrl(companyId, projectId, folderId);
}

export function buildProcoreDocumentsFolderUrl(
  companyId: string | undefined,
  projectId: string | undefined,
  folderId: string | undefined
) {
  if (!projectId) {
    return undefined;
  }

  const url = new URL(
    `/webclients/host/companies/${encodeURIComponent(companyId || PROCORE_COMPANY_ID)}/projects/${encodeURIComponent(
      projectId
    )}/tools/documents`,
    PROCORE_WEB_BASE_URL
  );

  if (folderId) {
    url.searchParams.set("folder_id", folderId);
  }

  return url.toString();
}
