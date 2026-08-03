"use client";

import { useState } from "react";
import { ListChecks, RefreshCw, Trash2, Wrench } from "lucide-react";

type DataMaintenanceIssue = {
  count: number;
  detail: string;
  id: string;
  samples: string[];
  severity: "error" | "info" | "warning";
  title: string;
};

type DataMaintenanceSummary = {
  cleanupCandidates: {
    resolvedFailedImageUploads: number;
    taskQueue: {
      completed: number;
      failed: number;
    };
  };
  databaseConfigured?: boolean;
  error?: string;
  generatedAt: string;
  orphanIssues: DataMaintenanceIssue[];
  rollups: {
    crewPerformance: number;
    dailyWork: number;
    payItemProject: number;
    pmSummary: number;
  };
  taskQueue: {
    statuses: {
      completed: number;
      failed: number;
      processing: number;
      queued: number;
    };
    total: number;
  };
};

type DataMaintenanceAction = "cleanup_records" | "rebuild_rollups" | "run_all";

type DataMaintenanceActionResponse = {
  cleanupResult?: {
    resolvedFailedImageUploads: number;
    taskQueue: {
      completed: number;
      failed: number;
      total: number;
    };
  };
  error?: string;
  ok?: boolean;
  rebuiltRollups?: DataMaintenanceSummary["rollups"];
  summary?: DataMaintenanceSummary;
};

export function AdminMaintenancePanel({
  clearing,
  clearingProjectCatalog,
  netSuiteVendorCount,
  netSuiteVendorsSyncedAt,
  notice,
  onClearProjectCatalog,
  onClearStagingData,
  onSyncNetSuiteVendors,
  syncingNetSuiteVendors
}: {
  clearing: boolean;
  clearingProjectCatalog: boolean;
  netSuiteVendorCount: number;
  netSuiteVendorsSyncedAt: string | null;
  notice: { message: string; status: "success" | "error" } | null;
  onClearProjectCatalog: () => void;
  onClearStagingData: () => void;
  onSyncNetSuiteVendors: () => void;
  syncingNetSuiteVendors: boolean;
}) {
  const [maintenanceAction, setMaintenanceAction] = useState<DataMaintenanceAction | "refresh" | "">("");
  const [maintenanceNotice, setMaintenanceNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [maintenanceSummary, setMaintenanceSummary] = useState<DataMaintenanceSummary | null>(null);

  const refreshMaintenanceSummary = async () => {
    setMaintenanceAction("refresh");
    setMaintenanceNotice(null);

    try {
      const summary = await loadAdminDataMaintenanceSummary();

      setMaintenanceSummary(summary);
      setMaintenanceNotice({
        message: "Maintenance snapshot refreshed.",
        status: "success"
      });
    } catch (error) {
      setMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to refresh maintenance snapshot.",
        status: "error"
      });
    } finally {
      setMaintenanceAction("");
    }
  };

  const runMaintenanceAction = async (action: DataMaintenanceAction) => {
    setMaintenanceAction(action);
    setMaintenanceNotice(null);

    try {
      const data = await runAdminDataMaintenanceAction(action);
      const summary = data.summary ?? (await loadAdminDataMaintenanceSummary());

      setMaintenanceSummary(summary);
      setMaintenanceNotice({
        message: formatMaintenanceActionNotice(action, data),
        status: "success"
      });
    } catch (error) {
      setMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to run maintenance action.",
        status: "error"
      });
    } finally {
      setMaintenanceAction("");
    }
  };
  const isMaintenanceBusy = Boolean(maintenanceAction);

  return (
    <details className="admin-maintenance">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Maintenance
      </summary>
      <div className="admin-maintenance-body">
        {notice ? <div className={notice.status === "error" ? "inline-alert" : "success-alert"}>{notice.message}</div> : null}
        {maintenanceNotice ? (
          <div className={maintenanceNotice.status === "error" ? "inline-alert" : "success-alert"}>
            {maintenanceNotice.message}
          </div>
        ) : null}
        <div className="admin-maintenance-section">
          <div className="admin-maintenance-section-heading">
            <span>
              <strong>Data Maintenance</strong>
              <small>Rebuild report summaries, clean stale queue rows, and scan for orphaned references.</small>
            </span>
            <button
              className="secondary-button compact-button"
              disabled={isMaintenanceBusy}
              onClick={refreshMaintenanceSummary}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {maintenanceAction === "refresh" ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {maintenanceSummary ? <DataMaintenanceSnapshot summary={maintenanceSummary} /> : null}
          <div className="admin-maintenance-actions">
            <button
              className="secondary-button"
              disabled={isMaintenanceBusy}
              onClick={() => runMaintenanceAction("rebuild_rollups")}
              type="button"
            >
              <Wrench aria-hidden="true" size={16} />
              {maintenanceAction === "rebuild_rollups" ? "Rebuilding..." : "Rebuild report rollups"}
            </button>
            <button
              className="secondary-button"
              disabled={isMaintenanceBusy}
              onClick={() => runMaintenanceAction("cleanup_records")}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
              {maintenanceAction === "cleanup_records" ? "Cleaning..." : "Clean maintenance records"}
            </button>
            <button
              className="primary-button"
              disabled={isMaintenanceBusy}
              onClick={() => runMaintenanceAction("run_all")}
              type="button"
            >
              <ListChecks aria-hidden="true" size={16} />
              {maintenanceAction === "run_all" ? "Running..." : "Clean and rebuild"}
            </button>
          </div>
          <p className="field-note">
            Cleanup removes completed queue tasks older than 45 days, failed queue tasks older than 90 days, and resolved
            failed image-upload rows older than 30 days. It does not delete daily entries, daily reports, users, projects,
            pay items, or active unresolved upload failures.
          </p>
        </div>
        <p className="field-note">
          Pulls NetSuite vendors that have a default address and makes them available as subcontractor companies.
          {netSuiteVendorsSyncedAt
            ? ` Current vendor cache: ${netSuiteVendorCount} vendor${netSuiteVendorCount === 1 ? "" : "s"}, refreshed ${formatStatusDateTime(netSuiteVendorsSyncedAt)}.`
            : " No vendor cache has been loaded yet."}
        </p>
        <button
          className="secondary-button admin-clear-button"
          disabled={syncingNetSuiteVendors}
          onClick={onSyncNetSuiteVendors}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={16} />
          {syncingNetSuiteVendors ? "Loading vendors..." : "Get Vendors"}
        </button>
        <p className="field-note">
          Clears daily entries, day statuses, notes, daily reports, upload statuses, and crew records. Preserves users,
          project catalog jobs/pay items, sync log, project blacklist, and My Projects.
        </p>
        <button className="secondary-button admin-clear-button" disabled={clearing} onClick={onClearStagingData} type="button">
          <Trash2 aria-hidden="true" size={16} />
          {clearing ? "Clearing..." : "Clear staging daily data"}
        </button>
        <p className="field-note">
          Clears only project catalog jobs/pay items and the legacy catalog fallback. Use this before the first NetSuite sync.
        </p>
        <button
          className="secondary-button admin-clear-button"
          disabled={clearingProjectCatalog}
          onClick={onClearProjectCatalog}
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          {clearingProjectCatalog ? "Clearing..." : "Clear project catalog"}
        </button>
      </div>
    </details>
  );
}

function DataMaintenanceSnapshot({ summary }: { summary: DataMaintenanceSummary }) {
  const cleanupCount =
    summary.cleanupCandidates.taskQueue.completed +
    summary.cleanupCandidates.taskQueue.failed +
    summary.cleanupCandidates.resolvedFailedImageUploads;
  const criticalCount = summary.orphanIssues.filter((issue) => issue.severity === "error").length;
  const reviewCount = summary.orphanIssues.filter((issue) => issue.severity === "warning").length;

  return (
    <div className="data-maintenance-snapshot">
      <div className="data-quality-metrics">
        <div>
          <span>Rollup rows</span>
          <strong>
            {summary.rollups.payItemProject + summary.rollups.crewPerformance + summary.rollups.dailyWork + summary.rollups.pmSummary}
          </strong>
        </div>
        <div>
          <span>Queue rows</span>
          <strong>{summary.taskQueue.total}</strong>
        </div>
        <div>
          <span>Cleanup ready</span>
          <strong>{cleanupCount}</strong>
        </div>
        <div>
          <span>Orphan checks</span>
          <strong>{criticalCount + reviewCount}</strong>
        </div>
      </div>
      <div className="maintenance-detail-grid">
        <div>
          <strong>Rollups</strong>
          <span>Pay item: {summary.rollups.payItemProject}</span>
          <span>Crew: {summary.rollups.crewPerformance}</span>
          <span>Daily work: {summary.rollups.dailyWork}</span>
          <span>PM summary: {summary.rollups.pmSummary}</span>
        </div>
        <div>
          <strong>Task Queue</strong>
          <span>Queued: {summary.taskQueue.statuses.queued}</span>
          <span>Processing: {summary.taskQueue.statuses.processing}</span>
          <span>Completed: {summary.taskQueue.statuses.completed}</span>
          <span>Failed: {summary.taskQueue.statuses.failed}</span>
        </div>
        <div>
          <strong>Cleanup Candidates</strong>
          <span>Completed queue rows: {summary.cleanupCandidates.taskQueue.completed}</span>
          <span>Failed queue rows: {summary.cleanupCandidates.taskQueue.failed}</span>
          <span>Resolved image failures: {summary.cleanupCandidates.resolvedFailedImageUploads}</span>
          <span>Snapshot: {formatStatusDateTime(summary.generatedAt)}</span>
        </div>
      </div>
      {summary.orphanIssues.length === 0 ? (
        <div className="success-alert">No database orphan issues found.</div>
      ) : (
        <div className="data-quality-list">
          {summary.orphanIssues.map((issue) => (
            <div className={`data-quality-issue ${issue.severity}`} key={issue.id}>
              <strong>
                {issue.title} ({issue.count})
              </strong>
              <span>{issue.detail}</span>
              {issue.samples.length > 0 ? <small>Examples: {issue.samples.join(", ")}</small> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function loadAdminDataMaintenanceSummary() {
  const response = await fetch("/api/admin/data-maintenance", {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as DataMaintenanceSummary;

  if (!response.ok || data.databaseConfigured === false) {
    throw new Error(data.error ?? "Unable to load data maintenance summary.");
  }

  return data;
}

async function runAdminDataMaintenanceAction(action: DataMaintenanceAction) {
  const response = await fetch("/api/admin/data-maintenance", {
    body: JSON.stringify({ action }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as DataMaintenanceActionResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to run data maintenance.");
  }

  return data;
}

function formatMaintenanceActionNotice(action: DataMaintenanceAction, data: DataMaintenanceActionResponse) {
  if (action === "rebuild_rollups") {
    const rollups = data.rebuiltRollups;

    return rollups
      ? `Report rollups rebuilt: ${rollups.payItemProject} pay item, ${rollups.crewPerformance} crew, ${rollups.dailyWork} daily work, ${rollups.pmSummary} PM summary rows.`
      : "Report rollups rebuilt.";
  }

  if (action === "cleanup_records") {
    return formatMaintenanceCleanupNotice(data);
  }

  return `${formatMaintenanceCleanupNotice(data)} Report rollups rebuilt.`;
}

function formatMaintenanceCleanupNotice(data: DataMaintenanceActionResponse) {
  const cleanup = data.cleanupResult;

  if (!cleanup) {
    return "Maintenance records cleaned.";
  }

  return `Maintenance records cleaned: ${cleanup.taskQueue.total} queue row${cleanup.taskQueue.total === 1 ? "" : "s"} and ${
    cleanup.resolvedFailedImageUploads
  } resolved image failure${cleanup.resolvedFailedImageUploads === 1 ? "" : "s"}.`;
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
