import type { Project } from "@/lib/domain/types";
import { buildProcoreDocumentsFolderUrl } from "@/features/time-allocation/lib/status-helpers";
import { buildDailyReportUploadFileName } from "@/features/time-allocation/lib/date-helpers";
import {
  readApiError,
  readApiJson,
  readDownloadFileName
} from "@/features/time-allocation/lib/api-utils";
import type { DailyReportUploadResponse } from "@/features/time-allocation/lib/workspace-api-types";
import type { DailyReport, DailyReportUpload, DayEntryNotes } from "@/features/time-allocation/types";

type DailyReportDocumentRequest = {
  date: string;
  dayNotes: DayEntryNotes;
  project: Project;
  report: DailyReport;
};

export async function downloadDailyReportPdfFile({
  date,
  dayNotes,
  project,
  report
}: DailyReportDocumentRequest) {
  const response = await fetch("/api/daily-reports/pdf", {
    body: JSON.stringify({
      date,
      dayNotes,
      project,
      report
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to download daily report PDF."));
  }

  return {
    blob: await response.blob(),
    fileName: readDownloadFileName(response.headers) ?? `daily-report-${date}.pdf`
  };
}

export function buildDailyReportUploadFromResponse(
  data: DailyReportUploadResponse,
  project: Project,
  date: string
): DailyReportUpload {
  if (data.queued) {
    return {
      attemptedAt: new Date().toISOString(),
      fileName: data.fileName ?? buildDailyReportUploadFileName(project.name, date),
      folderPath: data.folderPath ?? "Daily Reports",
      status: "queued"
    };
  }

  return {
    companyId: data.companyId,
    fileName: data.fileName ?? "daily report",
    folderId: data.folderId,
    folderPath: data.folderPath ?? "Daily Reports",
    folderUrl: data.folderUrl ?? buildProcoreDocumentsFolderUrl(data.companyId, project.id, data.folderId),
    procoreFileId: data.procoreFileId,
    status: "uploaded",
    uploadedAt: new Date().toISOString()
  };
}

export function buildFailedDailyReportUploadStatus(project: Project, date: string, message: string): DailyReportUpload {
  return {
    attemptedAt: new Date().toISOString(),
    error: message,
    fileName: buildDailyReportUploadFileName(project.name, date),
    folderPath: "Daily Reports",
    status: "failed"
  };
}

export async function uploadDailyReportPdfToProcore(request: DailyReportDocumentRequest) {
  const response = await fetch("/api/procore/daily-reports/upload", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as DailyReportUploadResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to upload daily report to Procore.");
  }

  return {
    data,
    upload: buildDailyReportUploadFromResponse(data, request.project, request.date)
  };
}
