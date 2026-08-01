import { Download, Edit3, UploadCloud } from "lucide-react";
import type { Project } from "@/lib/domain/types";
import { InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import {
  DailyReportProcoreStatusValue
} from "@/features/time-allocation/components/daily-report/daily-report-ui";
import { formatYesNoAnswer } from "@/features/time-allocation/lib/daily-report-helpers";
import { formatDate } from "@/features/time-allocation/lib/date-helpers";
import type {
  DailyReport,
  DailyReportProcoreStatus,
  DailyReportUpload
} from "@/features/time-allocation/types";

type DailyReportUploadNotice = { message: string; status: "success" | "error" } | null;

type DailyReportUploadRetryItem = {
  date: string;
  dayKey: string;
  project: Project;
  report: DailyReport;
  upload: DailyReportUpload;
};

export function DailyReportPanel({
  currentDailyReport,
  dailyReportNeedsUpload,
  dailyReportUploadPending,
  dailyReportUploadNotice,
  dailyReportUploadRetryQueue,
  downloadingDailyReportPdf,
  procoreStatus,
  retryingDailyReportUploadKey,
  selectedProject,
  selectedProjectUsesTwoSeriesDailyReport,
  uploadingDailyReport,
  onDownloadPdf,
  onOpenDailyEntry,
  onOpenDailyReportModal,
  onRetryDailyReportUpload,
  onUploadToProcore
}: {
  currentDailyReport: DailyReport | undefined;
  dailyReportNeedsUpload: boolean;
  dailyReportUploadPending: boolean;
  dailyReportUploadNotice: DailyReportUploadNotice;
  dailyReportUploadRetryQueue: DailyReportUploadRetryItem[];
  downloadingDailyReportPdf: boolean;
  procoreStatus: DailyReportProcoreStatus;
  retryingDailyReportUploadKey: string;
  selectedProject: Project | undefined;
  selectedProjectUsesTwoSeriesDailyReport: boolean;
  uploadingDailyReport: boolean;
  onDownloadPdf: () => void;
  onOpenDailyEntry: (projectId: string, date: string) => void;
  onOpenDailyReportModal: () => void;
  onRetryDailyReportUpload: (dayKey: string) => void;
  onUploadToProcore: () => void;
}) {
  return (
    <div className="panel">
      <div className="panel-heading">
        <h2>Daily Report</h2>
        <div className="panel-heading-actions">
          <button
            className={!currentDailyReport ? "primary-button prominent-action" : "secondary-button"}
            disabled={!selectedProject}
            onClick={onOpenDailyReportModal}
            type="button"
          >
            <Edit3 aria-hidden="true" size={18} />
            {currentDailyReport ? "Edit Daily Report" : "Create Daily Report"}
          </button>
          {currentDailyReport ? (
            <button
              className="secondary-button"
              disabled={!selectedProject || downloadingDailyReportPdf}
              onClick={onDownloadPdf}
              type="button"
            >
              {downloadingDailyReportPdf ? <InlineSpinner /> : <Download aria-hidden="true" size={18} />}
              {downloadingDailyReportPdf ? "Downloading..." : "Download PDF"}
            </button>
          ) : null}
          {currentDailyReport ? (
            <button
              className={dailyReportNeedsUpload ? "primary-button prominent-action" : "secondary-button"}
              disabled={!selectedProject || uploadingDailyReport || dailyReportUploadPending}
              onClick={onUploadToProcore}
              type="button"
            >
              {uploadingDailyReport ? <InlineSpinner /> : <UploadCloud aria-hidden="true" size={18} />}
              {uploadingDailyReport ? "Queueing..." : dailyReportUploadPending ? "Queued for upload" : "Upload to Procore"}
            </button>
          ) : null}
        </div>
      </div>
      {currentDailyReport ? (
        <div className="daily-report-summary">
          <div className="daily-report-summary-card">
            <span>Status</span>
            <strong>Saved</strong>
          </div>
          <div className="daily-report-summary-card">
            <span>Procore Upload</span>
            <DailyReportProcoreStatusValue status={procoreStatus} />
          </div>
          <div className="daily-report-summary-card">
            <span>Updated</span>
            <strong>{new Date(currentDailyReport.updatedAt).toLocaleString()}</strong>
          </div>
          {selectedProjectUsesTwoSeriesDailyReport ? (
            <div className="daily-report-summary-card daily-report-summary-secondary">
              <span>Template</span>
              <strong>Field Report</strong>
            </div>
          ) : (
            <>
              <div className="daily-report-summary-card daily-report-summary-secondary">
                <span>Inspector Quantities</span>
                <strong>{formatYesNoAnswer(currentDailyReport.quantitiesTurnedIn)}</strong>
              </div>
              <div className="daily-report-summary-card daily-report-summary-secondary">
                <span>Incidents</span>
                <strong>{formatYesNoAnswer(currentDailyReport.incidentOccurred)}</strong>
              </div>
            </>
          )}
        </div>
      ) : null}
      {currentDailyReport ? (
        <div className="daily-report-upload-status">
          {dailyReportUploadNotice ? (
            <div className={dailyReportUploadNotice.status === "error" ? "inline-alert" : "success-alert"}>
              {dailyReportUploadNotice.message}
            </div>
          ) : (
            <div
              className={
                procoreStatus.className === "failed"
                  ? "inline-alert"
                  : procoreStatus.className === "uploaded"
                    ? "success-alert"
                    : "field-note"
              }
            >
              {procoreStatus.message}
            </div>
          )}
        </div>
      ) : null}
      {dailyReportUploadRetryQueue.length > 0 ? (
        <div className="daily-report-retry-queue">
          <div className="retry-queue-heading">
            <h3>Upload Retry Queue</h3>
            <span>
              {dailyReportUploadRetryQueue.length} failed upload
              {dailyReportUploadRetryQueue.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="retry-queue-list">
            {dailyReportUploadRetryQueue.map((item) => (
              <div className="retry-queue-row" key={item.dayKey}>
                <div>
                  <strong>{item.project.name}</strong>
                  <span>
                    {formatDate(item.date)}
                    {item.upload.attemptedAt ? ` - last tried ${new Date(item.upload.attemptedAt).toLocaleString()}` : ""}
                  </span>
                  <p>{item.upload.error ?? "Upload failed."}</p>
                </div>
                <div className="retry-queue-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onOpenDailyEntry(item.project.id, item.date)}
                    type="button"
                  >
                    Open day
                  </button>
                  <button
                    className="primary-button"
                    disabled={retryingDailyReportUploadKey === item.dayKey}
                    onClick={() => onRetryDailyReportUpload(item.dayKey)}
                    type="button"
                  >
                    <UploadCloud aria-hidden="true" size={18} />
                    {retryingDailyReportUploadKey === item.dayKey ? "Retrying..." : "Retry upload"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
