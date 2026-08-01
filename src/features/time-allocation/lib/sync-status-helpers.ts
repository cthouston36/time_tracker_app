import type { ProjectSyncSummary } from "@/features/time-allocation/types";

export function buildSyncStatus(prefix: string, summary: ProjectSyncSummary | undefined) {
  if (!summary) {
    return `${prefix} complete`;
  }

  const dailyReportOnlyText =
    summary.dailyReportOnlyProjects !== undefined ? `, ${summary.dailyReportOnlyProjects} Electrical` : "";
  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const queuedText = remainingNewProjects > 0 ? `, ${remainingNewProjects} queued` : "";
  const autoArchivedProjects = summary.autoArchivedProjects ?? 0;
  const autoUnarchivedProjects = summary.autoUnarchivedProjects ?? 0;
  const archivedText = autoArchivedProjects > 0 ? `, ${autoArchivedProjects} archived inactive` : "";
  const unarchivedText = autoUnarchivedProjects > 0 ? `, ${autoUnarchivedProjects} unarchived active` : "";

  return `${prefix}: ${summary.synced} synced, ${summary.failed} failed${dailyReportOnlyText}${queuedText}${archivedText}${unarchivedText}`;
}

export function hasSyncWarnings(summary: ProjectSyncSummary | undefined) {
  return Boolean(
    summary &&
      (summary.failed > 0 || (summary.remainingNewProjects ?? 0) > 0 || (summary.autoArchivedProjects ?? 0) > 0)
  );
}
