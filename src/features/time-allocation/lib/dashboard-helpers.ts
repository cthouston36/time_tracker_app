import { todayInputValue } from "@/lib/date";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import { buildPayItemReport } from "@/lib/report-builders";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import type {
  DailyReportUploadsByKey,
  DailyReportsByKey,
  DaySubmissionsByKey,
  MyJobsByUser
} from "@/features/time-allocation/types";
import { formatDate, getDayKey } from "@/features/time-allocation/lib/date-helpers";
import { formatPayItemQuantity } from "@/features/time-allocation/lib/pay-item-helpers";
import {
  getDailyReportCalendarStatus,
  getHasDailyEntryActivity,
  getProjectEntryCalendarStatus,
  getProjectWorkTypeLabel
} from "@/features/time-allocation/lib/status-helpers";
import { getFieldUserIdsAssignedToProject } from "@/features/time-allocation/lib/selectors";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import type {
  DashboardIssue,
  DashboardProjectWeekRow
} from "@/features/time-allocation/components/dashboard/dashboard-components";
import type {
  DashboardProjectNavigationRow,
  ExecutiveReviewItem,
  FieldAssignmentVisibilityRow,
  PmComplianceRow,
  ProductionPerformanceAlert
} from "@/features/time-allocation/components/dashboard/executive-dashboard-components";

export function buildDashboardProjectRows({
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entryDayKeys,
  projects,
  weekDates
}: {
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
  entryDayKeys: Set<string>;
  projects: Project[];
  weekDates: string[];
}): DashboardProjectWeekRow[] {
  const today = todayInputValue();

  return projects.map((project) => {
    let dailyFailedCount = 0;
    let dailyPendingCount = 0;
    let dailySavedCount = 0;
    let draftEntryCount = 0;
    let missingPastDailyReportCount = 0;
    let openDate = "";
    let submittedEntryCount = 0;
    const issues: DashboardIssue[] = [];

    for (const date of weekDates) {
      const dayKey = getDayKey(project.id, date);
      const entryStatus = getProjectEntryCalendarStatus(project, daySubmissions[dayKey], entryDayKeys.has(dayKey));
      const dailyStatus = getDailyReportCalendarStatus(
        dailyReportsByKey[dayKey],
        dailyReportUploadsByKey[dayKey],
        getHasDailyEntryActivity(project, dayKey, daySubmissions, entryDayKeys)
      );

      if (entryStatus.className === "submitted") {
        submittedEntryCount += 1;
      }

      if (entryStatus.className === "draft") {
        draftEntryCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Entry activity has been saved but the day has not been submitted.",
          id: `${project.id}-${date}-entry-draft`,
          label: "Draft entry",
          tone: "warning"
        });
      }

      if (dailyStatus.className !== "missing" && dailyStatus.className !== "not-started") {
        dailySavedCount += 1;
      }

      if (dailyStatus.className === "failed") {
        dailyFailedCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Daily report upload failed and needs retry or review.",
          id: `${project.id}-${date}-daily-upload-failed`,
          label: "Failed upload",
          tone: "error"
        });
      }

      if (dailyStatus.className === "created") {
        dailyPendingCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Daily report has been saved but has not been uploaded to Procore.",
          id: `${project.id}-${date}-daily-upload-pending`,
          label: "Pending upload",
          tone: "warning"
        });
      }

      if (dailyStatus.className === "missing" && date <= today) {
        missingPastDailyReportCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Entry activity exists, but no daily report has been saved.",
          id: `${project.id}-${date}-daily-missing`,
          label: "Missing daily",
          tone: "error"
        });
      }
    }

    return {
      attentionScore: dailyFailedCount * 5 + dailyPendingCount * 3 + draftEntryCount * 2 + missingPastDailyReportCount,
      dailyFailedCount,
      dailyPendingCount,
      dailySavedCount,
      draftEntryCount,
      issues,
      missingPastDailyReportCount,
      openDate,
      project,
      submittedEntryCount
    };
  });
}

export function buildDashboardMetrics(rows: DashboardProjectWeekRow[]) {
  return rows.reduce(
    (totals, row) => ({
      draftEntryDays: totals.draftEntryDays + row.draftEntryCount,
      procoreAttentionCount: totals.procoreAttentionCount + row.dailyFailedCount + row.dailyPendingCount,
      savedDailyReports: totals.savedDailyReports + row.dailySavedCount,
      submittedEntryDays: totals.submittedEntryDays + row.submittedEntryCount
    }),
    {
      draftEntryDays: 0,
      procoreAttentionCount: 0,
      savedDailyReports: 0,
      submittedEntryDays: 0
    }
  );
}

export function buildExecutiveReviewItems(
  attentionRows: DashboardProjectWeekRow[],
  productionAlerts: ProductionPerformanceAlert[]
): ExecutiveReviewItem[] {
  const statusItems = attentionRows.flatMap((row) =>
    row.issues.map((issue) => ({
      detail: issue.detail,
      id: `status-${issue.id}`,
      meta: formatDate(issue.date),
      openDate: issue.date,
      projectId: row.project.id,
      projectName: row.project.name,
      title: issue.label,
      tone: issue.tone,
      type: "Status" as const
    }))
  );
  const productionItems = productionAlerts.map((alert) => ({
    detail: alert.payItemLabel,
    id: `production-${alert.id}`,
    meta: alert.detail,
    openDate: alert.openDate,
    projectId: alert.projectId,
    projectName: alert.projectName,
    title: alert.message,
    tone: alert.tone,
    type: "Production" as const
  }));

  return [...productionItems, ...statusItems].sort((left, right) => {
    const toneOrder = getExecutiveReviewToneRank(right.tone) - getExecutiveReviewToneRank(left.tone);

    return toneOrder || left.projectName.localeCompare(right.projectName) || left.title.localeCompare(right.title);
  });
}

function getExecutiveReviewToneRank(tone: ExecutiveReviewItem["tone"]) {
  if (tone === "error") {
    return 2;
  }

  if (tone === "warning") {
    return 1;
  }

  return 0;
}

export function buildDashboardProjectNavigationRows(
  projectRows: DashboardProjectWeekRow[],
  assignmentRows: FieldAssignmentVisibilityRow[]
): DashboardProjectNavigationRow[] {
  const assignmentsByProjectId = new Map(assignmentRows.map((row) => [row.project.id, row]));
  const today = todayInputValue();

  return projectRows
    .map((row) => {
      const assignment = assignmentsByProjectId.get(row.project.id);
      const assignedFieldNames = assignment?.assignedUsers.map(formatUserName).sort((a, b) => a.localeCompare(b)) ?? [];

      return {
        assignedFieldCount: assignedFieldNames.length,
        assignedFieldNames,
        issueCount: row.issues.length,
        openDate: row.openDate || today,
        project: row.project
      };
    })
    .sort((left, right) => right.issueCount - left.issueCount || left.project.name.localeCompare(right.project.name));
}

export function filterDashboardProjectNavigationRows(rows: DashboardProjectNavigationRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => {
    const searchableText = [
      row.project.name,
      getProjectWorkTypeLabel(row.project),
      row.project.netSuiteProjectManagerName ?? "",
      ...row.assignedFieldNames
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function buildFieldAssignmentVisibilityRows(
  projects: Project[],
  fieldUsers: AuthUser[],
  myJobsByUser: MyJobsByUser
): FieldAssignmentVisibilityRow[] {
  return projects
    .map((project) => {
      const assignedUserIds = new Set(getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, project.id));

      return {
        assignedUsers: fieldUsers
          .filter((user) => assignedUserIds.has(user.id))
          .sort((left, right) => formatUserName(left).localeCompare(formatUserName(right))),
        project
      };
    })
    .sort(
      (left, right) =>
        Number(left.assignedUsers.length > 0) - Number(right.assignedUsers.length > 0) ||
        left.project.name.localeCompare(right.project.name)
    );
}

export function buildPmComplianceRows(projectRows: DashboardProjectWeekRow[]): PmComplianceRow[] {
  const rowsByPm = new Map<string, PmComplianceRow>();

  for (const row of projectRows) {
    const pmId = row.project.netSuiteProjectManagerId || "unassigned";
    const pmName = row.project.netSuiteProjectManagerName || "Unassigned PM";
    const current = rowsByPm.get(pmId) ?? {
      id: pmId,
      issueCount: 0,
      issueProjectCount: 0,
      name: pmName,
      projectCount: 0,
      projects: [],
      score: 0
    };
    const projectIssueCount = row.issues.length;

    current.projectCount += 1;
    current.issueCount += projectIssueCount;
    current.score += row.attentionScore;

    if (projectIssueCount > 0) {
      current.issueProjectCount += 1;
      current.projects.push({
        openDate: row.openDate,
        projectId: row.project.id,
        projectName: row.project.name,
        summary: formatDashboardAttentionSummary(row)
      });
    }

    rowsByPm.set(pmId, current);
  }

  return Array.from(rowsByPm.values())
    .filter((row) => row.issueCount > 0)
    .map((row) => ({
      ...row,
      projects: row.projects.sort((left, right) => left.projectName.localeCompare(right.projectName))
    }))
    .sort((left, right) => right.score - left.score || right.issueCount - left.issueCount || left.name.localeCompare(right.name));
}

export function buildProductionPerformanceAlerts({
  endDate,
  entries,
  projects,
  startDate
}: {
  endDate: string;
  entries: AllocationEntry[];
  projects: Project[];
  startDate: string;
}): ProductionPerformanceAlert[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const filteredEntries = entries.filter(
    (entry) =>
      entry.date >= startDate &&
      entry.date <= endDate &&
      entry.hours > 0 &&
      entry.quantityCompleted > 0 &&
      projectsById.has(entry.projectId)
  );
  const alerts: ProductionPerformanceAlert[] = [];
  const reportRows = buildPayItemReport(filteredEntries, projects, {
    excludeOutliers: true,
    metric: "median"
  });

  for (const payItemRow of reportRows) {
    if (payItemRow.hoursPerUnit <= 0 || payItemRow.sampleSize < 3) {
      continue;
    }

    for (const jobRow of payItemRow.jobRollupRows ?? []) {
      const project = projectsById.get(jobRow.id);

      if (!project || jobRow.hoursPerUnit <= 0 || jobRow.sampleSize < 2) {
        continue;
      }

      const variance = (jobRow.hoursPerUnit - payItemRow.hoursPerUnit) / payItemRow.hoursPerUnit;

      if (variance < 0.25) {
        continue;
      }

      alerts.push({
        detail: `${formatHoursPerUnit(jobRow.hoursPerUnit)} vs company ${formatHoursPerUnit(payItemRow.hoursPerUnit)} across ${jobRow.sampleSize} row${jobRow.sampleSize === 1 ? "" : "s"}.`,
        id: `performance-${jobRow.id}-${payItemRow.key}`,
        message: `${formatVariance(variance)} than company median`,
        openDate: endDate,
        payItemLabel: `${payItemRow.code} - ${payItemRow.name}`,
        projectId: project.id,
        projectName: project.name,
        tone: "warning"
      });
    }
  }

  const completedQuantityByProjectPayItemKey = new Map<string, number>();

  for (const entry of entries) {
    const projectPayItemKey = `${entry.projectId}|${entry.payItemId}`;

    completedQuantityByProjectPayItemKey.set(
      projectPayItemKey,
      (completedQuantityByProjectPayItemKey.get(projectPayItemKey) ?? 0) + entry.quantityCompleted
    );
  }

  for (const project of projects.filter((candidate) => !isTwoSeriesProject(candidate))) {
    for (const payItem of project.payItems) {
      const completedQuantity = completedQuantityByProjectPayItemKey.get(`${project.id}|${payItem.id}`) ?? 0;

      if (payItem.budgetedQuantity <= 0 || completedQuantity <= payItem.budgetedQuantity) {
        continue;
      }

      alerts.push({
        detail: `${formatPayItemQuantity(completedQuantity)} completed vs ${formatPayItemQuantity(payItem.budgetedQuantity)} budgeted.`,
        id: `quantity-overrun-${project.id}-${payItem.id}`,
        message: "Quantity over budget",
        openDate: endDate,
        payItemLabel: `${payItem.code} - ${payItem.name}`,
        projectId: project.id,
        projectName: project.name,
        tone: "error"
      });
    }
  }

  return alerts
    .sort((left, right) => {
      const toneOrder = Number(right.tone === "error") - Number(left.tone === "error");

      return toneOrder || left.projectName.localeCompare(right.projectName) || left.payItemLabel.localeCompare(right.payItemLabel);
    })
    .slice(0, 10);
}

function formatHoursPerUnit(value: number) {
  return `${value.toFixed(3)} hrs/unit`;
}

function formatVariance(variance: number) {
  const percent = Math.abs(variance * 100);

  if (percent < 0.5) {
    return "At average";
  }

  return `${percent.toFixed(1)}% ${variance < 0 ? "better" : "worse"}`;
}

function formatDashboardAttentionSummary(row: DashboardProjectWeekRow) {
  const parts = [
    row.dailyFailedCount > 0 ? `${row.dailyFailedCount} failed Procore upload${row.dailyFailedCount === 1 ? "" : "s"}` : "",
    row.dailyPendingCount > 0 ? `${row.dailyPendingCount} pending Procore upload${row.dailyPendingCount === 1 ? "" : "s"}` : "",
    row.draftEntryCount > 0 ? `${row.draftEntryCount} draft entr${row.draftEntryCount === 1 ? "y" : "ies"}` : "",
    row.missingPastDailyReportCount > 0
      ? `${row.missingPastDailyReportCount} missing daily report${row.missingPastDailyReportCount === 1 ? "" : "s"}`
      : ""
  ].filter(Boolean);

  return parts.join(" | ");
}
