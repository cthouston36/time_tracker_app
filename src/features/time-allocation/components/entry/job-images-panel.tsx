import { ChevronDown, ExternalLink, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { EmptyState, InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import {
  formatFileSize,
  formatJobImageQueueStatus,
  JOB_IMAGE_DAILY_UPLOAD_LIMIT
} from "@/features/time-allocation/lib/job-image-helpers";
import type { JobImageQueueItem, JobImageUpload } from "@/features/time-allocation/types";

type JobImageNotice = { message: string; status: "success" | "error" } | null;

export function JobImagesPanel({
  currentJobImageUploads,
  failedJobImageUploads,
  failedQueuedJobImages,
  jobImageDailyLimitReached,
  jobImageHistoryExpanded,
  jobImageNotice,
  jobImageQueue,
  loadingJobImageUploads,
  queuedJobImages,
  selectedProjectExists,
  uploadedJobImageCount,
  uploadingJobImages,
  onAddImages,
  onClearQueue,
  onClearUploadedFromQueue,
  onRemoveFromQueue,
  onRetryFailed,
  onToggleHistory,
  onUpdateCaption,
  onUploadQueued
}: {
  currentJobImageUploads: JobImageUpload[];
  failedJobImageUploads: JobImageUpload[];
  failedQueuedJobImages: JobImageQueueItem[];
  jobImageDailyLimitReached: boolean;
  jobImageHistoryExpanded: boolean;
  jobImageNotice: JobImageNotice;
  jobImageQueue: JobImageQueueItem[];
  loadingJobImageUploads: boolean;
  queuedJobImages: JobImageQueueItem[];
  selectedProjectExists: boolean;
  uploadedJobImageCount: number;
  uploadingJobImages: boolean;
  onAddImages: () => void;
  onClearQueue: () => void;
  onClearUploadedFromQueue: () => void;
  onRemoveFromQueue: (imageId: string) => void;
  onRetryFailed: () => void;
  onToggleHistory: () => void;
  onUpdateCaption: (imageId: string, caption: string) => void;
  onUploadQueued: () => void;
}) {
  return (
    <div className="panel job-images-panel">
      <div className="panel-heading">
        <h2>Job Images</h2>
        <div className="panel-heading-actions">
          <button
            className="secondary-button"
            disabled={!selectedProjectExists || uploadingJobImages || jobImageDailyLimitReached}
            onClick={onAddImages}
            type="button"
          >
            <UploadCloud aria-hidden="true" size={18} />
            Add Images
          </button>
          <button
            className={queuedJobImages.length > 0 ? "primary-button prominent-action" : "primary-button"}
            disabled={!selectedProjectExists || queuedJobImages.length === 0 || uploadingJobImages || jobImageDailyLimitReached}
            onClick={onUploadQueued}
            type="button"
          >
            {uploadingJobImages ? <InlineSpinner /> : <UploadCloud aria-hidden="true" size={18} />}
            {uploadingJobImages ? "Uploading..." : "Upload Images to Procore"}
          </button>
        </div>
      </div>
      <div className="field-note job-image-help-text">
        {uploadedJobImageCount} of {JOB_IMAGE_DAILY_UPLOAD_LIMIT} images uploaded for this job/day. Selected images stay in a temporary queue
        until they are uploaded to Procore.
      </div>
      {jobImageNotice ? (
        <div className={jobImageNotice.status === "error" ? "inline-alert job-image-notice" : "success-alert job-image-notice"}>
          {jobImageNotice.message}
        </div>
      ) : null}
      {jobImageQueue.length > 0 ? (
        <div className="job-image-queue">
          <div className="job-image-section-heading">
            <h3>Temporary Queue</h3>
            <div className="job-image-section-actions">
              {failedQueuedJobImages.length > 0 ? (
                <button
                  className="secondary-button compact-action"
                  disabled={uploadingJobImages || jobImageDailyLimitReached}
                  onClick={onRetryFailed}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={16} />
                  Retry failed
                </button>
              ) : null}
              {jobImageQueue.some((item) => item.status === "uploaded") ? (
                <button className="text-button" onClick={onClearUploadedFromQueue} type="button">
                  Clear uploaded
                </button>
              ) : null}
              <button className="text-button" disabled={uploadingJobImages} onClick={onClearQueue} type="button">
                Clear queue
              </button>
            </div>
          </div>
          <div className="job-image-grid">
            {jobImageQueue.map((item) => (
              <div className={`job-image-card ${item.status}`} key={item.id}>
                <div
                  aria-label={item.originalName}
                  className="job-image-preview"
                  role="img"
                  style={{ backgroundImage: `url(${item.previewUrl})` }}
                />
                <div className="job-image-card-body">
                  <div>
                    <strong>{item.originalName}</strong>
                    <span>{formatFileSize(item.size)}</span>
                  </div>
                  <span className={`job-image-status ${item.status}`}>{formatJobImageQueueStatus(item)}</span>
                  <label className="job-image-caption-field">
                    <span>Caption</span>
                    <input
                      disabled={item.status === "uploading" || item.status === "uploaded"}
                      maxLength={160}
                      placeholder="Optional photo caption"
                      value={item.caption}
                      onChange={(event) => onUpdateCaption(item.id, event.target.value)}
                    />
                  </label>
                  {item.uploadedFileName ? <span className="job-image-meta">{item.uploadedFileName}</span> : null}
                  {item.error ? <p>{item.error}</p> : null}
                </div>
                <button
                  aria-label={`Remove ${item.originalName}`}
                  className="icon-button"
                  disabled={item.status === "uploading"}
                  onClick={() => onRemoveFromQueue(item.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>
            ))}
          </div>
          {failedQueuedJobImages.length > 0 ? (
            <div className="job-image-retry-queue">
              <div>
                <strong>
                  {failedQueuedJobImages.length} failed image{failedQueuedJobImages.length === 1 ? "" : "s"} ready to retry
                </strong>
                <span>Failed images stay in this temporary queue until you retry them, remove them, or refresh the page.</span>
              </div>
              <button
                className="primary-button"
                disabled={uploadingJobImages || jobImageDailyLimitReached}
                onClick={onRetryFailed}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={17} />
                Retry failed uploads
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={jobImageHistoryExpanded ? "job-image-history expanded" : "job-image-history"}>
        <button
          aria-expanded={jobImageHistoryExpanded}
          className="job-image-section-heading job-image-history-toggle"
          onClick={onToggleHistory}
          type="button"
        >
          <h3>Uploaded Images</h3>
          <span>
            {loadingJobImageUploads ? "Loading..." : `${uploadedJobImageCount}/${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded`}
          </span>
          <ChevronDown aria-hidden="true" className="job-image-history-chevron" size={18} />
        </button>
        {jobImageHistoryExpanded ? (
          <>
            {failedJobImageUploads.length > 0 ? (
              <div className="field-note">
                {failedJobImageUploads.length} failed upload attempt{failedJobImageUploads.length === 1 ? "" : "s"} recorded. If the image is
                no longer in the temporary queue, reselect the original photo to retry it.
              </div>
            ) : null}
            {currentJobImageUploads.length > 0 ? (
              <div className="job-image-history-list">
                {currentJobImageUploads.map((upload) => (
                  <div className={`job-image-history-row ${upload.status}`} key={upload.id}>
                    <div>
                      <strong>{upload.fileName}</strong>
                      <span>
                        {upload.status === "uploaded" ? "Uploaded" : "Failed"}
                        {upload.uploadedAt || upload.attemptedAt
                          ? ` ${new Date(upload.uploadedAt ?? upload.attemptedAt ?? "").toLocaleString()}`
                          : ""}
                        {upload.uploadedByName ? ` by ${upload.uploadedByName}` : ""}
                        {upload.fileSizeBytes ? ` - ${formatFileSize(upload.fileSizeBytes)}` : ""}
                      </span>
                      {upload.originalFileName ? <span>Original: {upload.originalFileName}</span> : null}
                      {upload.caption ? <span>Caption: {upload.caption}</span> : null}
                      {upload.error ? <p>{upload.error}</p> : null}
                    </div>
                    {upload.folderUrl ? (
                      <a className="secondary-button" href={upload.folderUrl} rel="noreferrer" target="_blank">
                        <ExternalLink aria-hidden="true" size={17} />
                        Open Folder
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No image upload history">
                Uploaded or failed image attempts for this job and date will appear here.
              </EmptyState>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
