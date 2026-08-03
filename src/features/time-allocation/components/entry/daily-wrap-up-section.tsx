"use client";

import type { RefObject } from "react";
import { Edit3, Save, Send, UploadCloud } from "lucide-react";
import type { Project } from "@/lib/domain/types";
import { DailyReportPanel } from "@/features/time-allocation/components/daily-report/daily-report-panel";
import { JobImagesPanel } from "@/features/time-allocation/components/entry/job-images-panel";
import { InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import type {
  DailyReport,
  DailyReportProcoreStatus,
  DailyReportUpload,
  JobImageQueueItem,
  JobImageUpload
} from "@/features/time-allocation/types";

type DailyReportUploadNotice = { message: string; status: "success" | "error" } | null;
type JobImageNotice = { message: string; status: "success" | "error" } | null;

type DailyReportUploadRetryItem = {
  date: string;
  dayKey: string;
  project: Project;
  report: DailyReport;
  upload: DailyReportUpload;
};

export function DailyWrapUpSection({
  currentDailyReport,
  currentJobImageUploads,
  dailyReportNeedsUpload,
  dailyReportUploadNotice,
  dailyReportUploadPending,
  dailyReportUploadRetryQueue,
  dayIsSubmitted,
  downloadingDailyReportPdf,
  draftEntryCount,
  failedJobImageUploads,
  failedQueuedJobImages,
  jobImageDailyLimitReached,
  jobImageHistoryExpanded,
  jobImageInputRef,
  jobImageNotice,
  jobImageQueue,
  loadingJobImageUploads,
  procoreStatus,
  queuedJobImages,
  retryingDailyReportUploadKey,
  savingEntries,
  selectedProject,
  selectedProjectUsesPayItems,
  selectedProjectUsesTwoSeriesDailyReport,
  showDailyReportDetails,
  showJobImageDetails,
  submittingDay,
  uploadedJobImageCount,
  uploadingDailyReport,
  uploadingJobImages,
  visibleEntryCount,
  onAddJobImages,
  onClearJobImageQueue,
  onClearUploadedJobImagesFromQueue,
  onDownloadDailyReportPdf,
  onOpenDailyEntry,
  onOpenDailyReportModal,
  onRemoveJobImageFromQueue,
  onRetryDailyReportUpload,
  onRetryFailedJobImages,
  onSaveAllocationEntries,
  onToggleJobImageHistory,
  onSubmitDay,
  onUpdateJobImageCaption,
  onUploadDailyReportToProcore,
  onUploadQueuedJobImages
}: {
  currentDailyReport: DailyReport | undefined;
  currentJobImageUploads: JobImageUpload[];
  dailyReportNeedsUpload: boolean;
  dailyReportUploadNotice: DailyReportUploadNotice;
  dailyReportUploadPending: boolean;
  dailyReportUploadRetryQueue: DailyReportUploadRetryItem[];
  dayIsSubmitted: boolean;
  downloadingDailyReportPdf: boolean;
  draftEntryCount: number;
  failedJobImageUploads: JobImageUpload[];
  failedQueuedJobImages: JobImageQueueItem[];
  jobImageDailyLimitReached: boolean;
  jobImageHistoryExpanded: boolean;
  jobImageInputRef: RefObject<HTMLInputElement | null>;
  jobImageNotice: JobImageNotice;
  jobImageQueue: JobImageQueueItem[];
  loadingJobImageUploads: boolean;
  procoreStatus: DailyReportProcoreStatus;
  queuedJobImages: JobImageQueueItem[];
  retryingDailyReportUploadKey: string;
  savingEntries: boolean;
  selectedProject: Project | undefined;
  selectedProjectUsesPayItems: boolean;
  selectedProjectUsesTwoSeriesDailyReport: boolean;
  showDailyReportDetails: boolean;
  showJobImageDetails: boolean;
  submittingDay: boolean;
  uploadedJobImageCount: number;
  uploadingDailyReport: boolean;
  uploadingJobImages: boolean;
  visibleEntryCount: number;
  onAddJobImages: (files: FileList | null) => Promise<void>;
  onClearJobImageQueue: () => void;
  onClearUploadedJobImagesFromQueue: () => void;
  onDownloadDailyReportPdf: () => void;
  onOpenDailyEntry: (projectId: string, date: string) => void;
  onOpenDailyReportModal: () => void;
  onRemoveJobImageFromQueue: (imageId: string) => void;
  onRetryDailyReportUpload: (dayKey: string) => void;
  onRetryFailedJobImages: () => Promise<void>;
  onSaveAllocationEntries: () => Promise<void>;
  onToggleJobImageHistory: () => void;
  onSubmitDay: () => Promise<void>;
  onUpdateJobImageCaption: (imageId: string, caption: string) => void;
  onUploadDailyReportToProcore: () => Promise<void>;
  onUploadQueuedJobImages: () => Promise<void>;
}) {
  const selectedProjectExists = Boolean(selectedProject);

  return (
    <>
      {selectedProjectUsesPayItems ? (
        <div className="workflow-section-heading">
          <h2 className="workflow-title">
            <span className="workflow-step">3</span>
            Daily Wrap-Up
          </h2>
        </div>
      ) : null}

      <input
        ref={jobImageInputRef}
        accept="image/*"
        className="job-image-file-input"
        multiple
        type="file"
        onChange={(event) => void onAddJobImages(event.target.files)}
      />
      {!showDailyReportDetails || !showJobImageDetails ? (
        <div className="wrap-up-action-strip" aria-label="Daily wrap-up actions">
          {!showDailyReportDetails ? (
            <button
              className="primary-button prominent-action"
              disabled={!selectedProject}
              onClick={onOpenDailyReportModal}
              type="button"
            >
              <Edit3 aria-hidden="true" size={18} />
              Create Daily Report
            </button>
          ) : null}
          {!showJobImageDetails ? (
            <button
              className="secondary-button"
              disabled={!selectedProject || uploadingJobImages || jobImageDailyLimitReached}
              onClick={() => jobImageInputRef.current?.click()}
              type="button"
            >
              <UploadCloud aria-hidden="true" size={18} />
              Add Images
            </button>
          ) : null}
        </div>
      ) : null}

      {showDailyReportDetails ? (
        <DailyReportPanel
          currentDailyReport={currentDailyReport}
          dailyReportNeedsUpload={dailyReportNeedsUpload}
          dailyReportUploadPending={dailyReportUploadPending}
          dailyReportUploadNotice={dailyReportUploadNotice}
          dailyReportUploadRetryQueue={dailyReportUploadRetryQueue}
          downloadingDailyReportPdf={downloadingDailyReportPdf}
          procoreStatus={procoreStatus}
          retryingDailyReportUploadKey={retryingDailyReportUploadKey}
          selectedProject={selectedProject}
          selectedProjectUsesTwoSeriesDailyReport={selectedProjectUsesTwoSeriesDailyReport}
          uploadingDailyReport={uploadingDailyReport}
          onDownloadPdf={onDownloadDailyReportPdf}
          onOpenDailyEntry={onOpenDailyEntry}
          onOpenDailyReportModal={onOpenDailyReportModal}
          onRetryDailyReportUpload={onRetryDailyReportUpload}
          onUploadToProcore={onUploadDailyReportToProcore}
        />
      ) : null}

      {showJobImageDetails ? (
        <JobImagesPanel
          currentJobImageUploads={currentJobImageUploads}
          failedJobImageUploads={failedJobImageUploads}
          failedQueuedJobImages={failedQueuedJobImages}
          jobImageDailyLimitReached={jobImageDailyLimitReached}
          jobImageHistoryExpanded={jobImageHistoryExpanded}
          jobImageNotice={jobImageNotice}
          jobImageQueue={jobImageQueue}
          loadingJobImageUploads={loadingJobImageUploads}
          queuedJobImages={queuedJobImages}
          selectedProjectExists={selectedProjectExists}
          uploadedJobImageCount={uploadedJobImageCount}
          uploadingJobImages={uploadingJobImages}
          onAddImages={() => jobImageInputRef.current?.click()}
          onClearQueue={onClearJobImageQueue}
          onClearUploadedFromQueue={onClearUploadedJobImagesFromQueue}
          onRemoveFromQueue={onRemoveJobImageFromQueue}
          onRetryFailed={() => void onRetryFailedJobImages()}
          onToggleHistory={onToggleJobImageHistory}
          onUpdateCaption={onUpdateJobImageCaption}
          onUploadQueued={onUploadQueuedJobImages}
        />
      ) : null}

      <div className="mobile-sticky-action-bar" aria-label="Entry actions">
        {selectedProjectUsesPayItems ? (
          <>
            <button
              className="primary-button"
              disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
              onClick={onSaveAllocationEntries}
              type="button"
            >
              {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={17} />}
              {savingEntries ? "Saving..." : "Save"}
            </button>
            <button
              className="secondary-button"
              disabled={dayIsSubmitted || visibleEntryCount === 0 || submittingDay || savingEntries}
              onClick={onSubmitDay}
              type="button"
            >
              {submittingDay ? <InlineSpinner /> : <Send aria-hidden="true" size={17} />}
              {submittingDay ? "Submitting..." : "Submit"}
            </button>
          </>
        ) : null}
        <button className="secondary-button" disabled={!selectedProject} onClick={onOpenDailyReportModal} type="button">
          <Edit3 aria-hidden="true" size={17} />
          Daily
        </button>
      </div>
    </>
  );
}
