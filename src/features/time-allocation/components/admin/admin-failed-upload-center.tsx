"use client";

import { useMemo, useState } from "react";
import { ExternalLink, RefreshCw, UploadCloud } from "lucide-react";
import type { Project } from "@/lib/domain/types";

type AdminFailedUploadDailyReport = {
  attemptedAt?: string;
  date: string;
  dayKey: string;
  error?: string;
  fileName: string;
  projectId: string;
};

type AdminFailedUploadJobImage = {
  attemptedAt?: string;
  caption?: string;
  date: string;
  error?: string;
  fileName: string;
  folderUrl?: string;
  id: string;
  originalFileName?: string;
  projectId: string;
};

type AdminFailedUploadsResponse = {
  dailyReports?: AdminFailedUploadDailyReport[];
  databaseConfigured?: boolean;
  error?: string;
  jobImages?: AdminFailedUploadJobImage[];
};

export function AdminFailedUploadCenter({
  onOpenDay,
  onRetryDailyReport,
  projects,
  retryingDailyReportUploadKey
}: {
  onOpenDay: (projectId: string, date: string) => void;
  onRetryDailyReport: (dayKey: string) => Promise<void>;
  projects: Project[];
  retryingDailyReportUploadKey: string;
}) {
  const [dailyReports, setDailyReports] = useState<AdminFailedUploadDailyReport[]>([]);
  const [jobImages, setJobImages] = useState<AdminFailedUploadJobImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const projectNameById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const unresolvedCount = dailyReports.length + jobImages.length;

  async function refreshFailedUploads() {
    setLoading(true);
    setNotice("");

    try {
      const data = await loadAdminFailedUploads();

      if (!data.databaseConfigured) {
        setNotice("Failed upload center requires the production database.");
        setDailyReports([]);
        setJobImages([]);
        return;
      }

      setDailyReports(data.dailyReports ?? []);
      setJobImages(data.jobImages ?? []);
      setLoaded(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load unresolved failed uploads.");
    } finally {
      setLoading(false);
    }
  }

  async function retryDailyReport(dayKey: string) {
    await onRetryDailyReport(dayKey);
    await refreshFailedUploads();
  }

  return (
    <details
      className="failed-upload-center"
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) {
          void refreshFailedUploads();
        }
      }}
    >
      <summary>
        <UploadCloud aria-hidden="true" size={16} />
        Failed Upload Center {loaded ? `(${unresolvedCount})` : ""}
      </summary>
      <div className="failed-upload-body">
        <div className="admin-panel-toolbar">
          <span>Unresolved upload failures only. Resolved failures are hidden automatically.</span>
          <button className="secondary-button compact-button" disabled={loading} onClick={refreshFailedUploads} type="button">
            <RefreshCw aria-hidden="true" size={14} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {notice ? <div className="inline-alert">{notice}</div> : null}
        {!loading && loaded && unresolvedCount === 0 ? (
          <div className="success-alert">No unresolved upload failures found.</div>
        ) : null}
        {dailyReports.length > 0 ? (
          <div className="failed-upload-section">
            <h4>Daily Reports</h4>
            <div className="failed-upload-list">
              {dailyReports.map((upload) => (
                <div className="failed-upload-row error" key={upload.dayKey}>
                  <div>
                    <strong>
                      {projectNameById.get(upload.projectId) ?? upload.projectId} - {formatDate(upload.date)}
                    </strong>
                    <span>{upload.fileName}</span>
                    <small>
                      Last tried {upload.attemptedAt ? formatStatusDateTime(upload.attemptedAt) : "unknown"} -{" "}
                      {upload.error}
                    </small>
                  </div>
                  <div className="failed-upload-actions">
                    <button className="secondary-button compact-button" onClick={() => onOpenDay(upload.projectId, upload.date)} type="button">
                      Open day
                    </button>
                    <button
                      className="primary-button compact-button"
                      disabled={retryingDailyReportUploadKey === upload.dayKey}
                      onClick={() => retryDailyReport(upload.dayKey)}
                      type="button"
                    >
                      {retryingDailyReportUploadKey === upload.dayKey ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {jobImages.length > 0 ? (
          <div className="failed-upload-section">
            <h4>Job Images</h4>
            <div className="failed-upload-list">
              {jobImages.map((upload) => (
                <div className="failed-upload-row error" key={upload.id}>
                  <div>
                    <strong>
                      {projectNameById.get(upload.projectId) ?? upload.projectId} - {formatDate(upload.date)}
                    </strong>
                    <span>{upload.fileName}</span>
                    <small>
                      Original: {upload.originalFileName || "unknown"} - Last tried{" "}
                      {upload.attemptedAt ? formatStatusDateTime(upload.attemptedAt) : "unknown"} - {upload.error}
                    </small>
                    {upload.caption ? <small>Caption: {upload.caption}</small> : null}
                  </div>
                  <div className="failed-upload-actions">
                    <button className="secondary-button compact-button" onClick={() => onOpenDay(upload.projectId, upload.date)} type="button">
                      Open day
                    </button>
                    {upload.folderUrl ? (
                      <a className="secondary-button compact-button" href={upload.folderUrl} rel="noreferrer" target="_blank">
                        <ExternalLink aria-hidden="true" size={14} />
                        Folder
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="field-note">
              Image files are not stored in the app, so failed image uploads are retried by opening the day and selecting the original photos again.
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

async function loadAdminFailedUploads() {
  const response = await fetch("/api/admin/failed-uploads", {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as AdminFailedUploadsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load unresolved failed uploads.");
  }

  return data;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString();
}

function formatStatusDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function readApiJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) {
      return { error: text };
    }

    throw new Error("Server returned an invalid JSON response.");
  }
}
