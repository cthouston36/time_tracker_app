"use client";

import { ListChecks } from "lucide-react";
import { formatStatusDateTime } from "@/lib/date";
import { readTextValue } from "@/features/time-allocation/lib/selectors";
import type { ProjectSyncSummary, SyncLogEntry } from "@/features/time-allocation/types";

export function SyncSummaryCard({ summary }: { summary: ProjectSyncSummary }) {
  const dailyReportOnlyProjects = summary.dailyReportOnlyProjects ?? 0;
  const eligibleProjects = summary.eligibleProjects ?? summary.attempted + summary.skippedExisting;
  const inactiveNetSuiteProjects = summary.inactiveNetSuiteProjects ?? 0;
  const autoArchivedProjects = summary.autoArchivedProjects ?? 0;
  const autoUnarchivedProjects = summary.autoUnarchivedProjects ?? 0;
  const payItemProjects = summary.payItemProjects ?? 0;
  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const skippedMissingProcoreProjectId = summary.skippedMissingProcoreProjectId ?? 0;
  const skippedNoPayItems = summary.skippedNoPayItems ?? 0;

  return (
    <div className={hasSyncWarnings(summary) ? "sync-summary warning" : "sync-summary"}>
      <strong>
        Synced {summary.synced} of {summary.attempted} attempted project{summary.attempted === 1 ? "" : "s"}
      </strong>
      {summary.totalNetSuiteProjects !== undefined ? (
        <span>
          NetSuite scan: {summary.totalNetSuiteProjects} project{summary.totalNetSuiteProjects === 1 ? "" : "s"} inspected,{" "}
          {eligibleProjects} eligible.
        </span>
      ) : null}
      {summary.payItemProjects !== undefined || summary.dailyReportOnlyProjects !== undefined ? (
        <span>
          Eligible mix: {payItemProjects} Signal project{payItemProjects === 1 ? "" : "s"},{" "}
          {dailyReportOnlyProjects} Electrical project{dailyReportOnlyProjects === 1 ? "" : "s"}.
        </span>
      ) : null}
      {summary.inactiveNetSuiteProjects !== undefined ||
      summary.autoArchivedProjects !== undefined ||
      summary.autoUnarchivedProjects !== undefined ? (
        <span>
          Inactive NetSuite jobs: {inactiveNetSuiteProjects}. Auto-archived {autoArchivedProjects} project catalog job
          {autoArchivedProjects === 1 ? "" : "s"}. Auto-unarchived {autoUnarchivedProjects} active project
          {autoUnarchivedProjects === 1 ? "" : "s"}.
        </span>
      ) : null}
      <span>
        {summary.skippedExisting} existing project{summary.skippedExisting === 1 ? "" : "s"} skipped.
      </span>
      {skippedMissingProcoreProjectId > 0 || skippedNoPayItems > 0 ? (
        <span>
          Skipped from app: {skippedMissingProcoreProjectId} missing Procore project ID, {skippedNoPayItems} with no pay items.
        </span>
      ) : null}
      {remainingNewProjects > 0 ? (
        <span>
          {remainingNewProjects} new project{remainingNewProjects === 1 ? "" : "s"} still queued. Run Sync New Projects again to continue.
        </span>
      ) : null}
      {summary.failed > 0 ? (
        <span>
          {summary.failed} project{summary.failed === 1 ? "" : "s"} failed or returned no budget lines.
        </span>
      ) : null}
      {getSyncFailedProjects(summary).length > 0 ? (
        <details>
          <summary>Failed projects</summary>
          <ul>
            {getSyncFailedProjects(summary).slice(0, 8).map((project) => (
              <li key={project}>{project}</li>
            ))}
          </ul>
          {getSyncFailedProjects(summary).length > 8 ? (
            <span>{getSyncFailedProjects(summary).length - 8} more not shown.</span>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

export function SyncLogPanel({ entries }: { entries: SyncLogEntry[] }) {
  return (
    <details className="sync-log">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Sync Log
      </summary>
      {entries.length === 0 ? (
        <div className="field-note">No sync attempts logged yet.</div>
      ) : (
        <div className="sync-log-list">
          {entries.map((entry) => (
            <div className={`sync-log-entry ${entry.status}`} key={entry.id}>
              <div className="sync-log-heading">
                <strong>{entry.action}</strong>
                <span>{formatStatusDateTime(entry.createdAt)}</span>
              </div>
              <span>{entry.message}</span>
              {entry.summary ? <span>{formatSyncSummaryLine(entry.summary)}</span> : null}
              {entry.summary && getSyncFailedProjects(entry.summary).length > 0 ? (
                <details>
                  <summary>Failed projects</summary>
                  <ul>
                    {getSyncFailedProjects(entry.summary).slice(0, 8).map((project) => (
                      <li key={project}>{project}</li>
                    ))}
                  </ul>
                  {getSyncFailedProjects(entry.summary).length > 8 ? (
                    <span>{getSyncFailedProjects(entry.summary).length - 8} more not shown.</span>
                  ) : null}
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function getSyncFailedProjects(summary: Partial<ProjectSyncSummary> | undefined) {
  return Array.isArray(summary?.failedProjects) ? summary.failedProjects.map(readTextValue).filter(Boolean) : [];
}

function hasSyncWarnings(summary: ProjectSyncSummary | undefined) {
  return Boolean(
    summary &&
      (summary.failed > 0 || (summary.remainingNewProjects ?? 0) > 0 || (summary.autoArchivedProjects ?? 0) > 0)
  );
}

function formatSyncSummaryLine(summary: ProjectSyncSummary) {
  const eligibleText = summary.eligibleProjects !== undefined ? `, ${summary.eligibleProjects} eligible` : "";
  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const queuedText = remainingNewProjects > 0 ? `, ${remainingNewProjects} queued` : "";
  const inactiveText =
    summary.inactiveNetSuiteProjects !== undefined
      ? `, ${summary.inactiveNetSuiteProjects} inactive, ${summary.autoArchivedProjects ?? 0} archived, ${
          summary.autoUnarchivedProjects ?? 0
        } unarchived`
      : "";
  const skippedDetails =
    summary.skippedMissingProcoreProjectId !== undefined || summary.skippedNoPayItems !== undefined
      ? `, ${summary.skippedMissingProcoreProjectId ?? 0} missing Procore ID, ${summary.skippedNoPayItems ?? 0} no pay items`
      : "";
  const sourceDetails =
    summary.payItemProjects !== undefined || summary.dailyReportOnlyProjects !== undefined
      ? `, ${summary.payItemProjects ?? 0} Signal, ${summary.dailyReportOnlyProjects ?? 0} Electrical`
      : "";

  return `${summary.synced} synced, ${summary.skippedExisting} existing skipped, ${summary.failed} failed${eligibleText}${sourceDetails}${skippedDetails}${inactiveText}${queuedText}`;
}
