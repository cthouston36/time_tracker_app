"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Users
} from "lucide-react";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { Project } from "@/lib/domain/types";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import {
  addDaysToInputDate,
  formatDate,
  formatWeekDayLabel,
  formatWeekRange,
  getDayKey
} from "@/features/time-allocation/lib/date-helpers";
import type {
  CalendarStatusMode,
  DailyReportUpload,
  DaySubmission
} from "@/features/time-allocation/types";

export type DashboardIssue = {
  date: string;
  detail: string;
  id: string;
  label: string;
  tone: "error" | "neutral" | "warning";
};

export type DashboardProjectWeekRow = {
  attentionScore: number;
  dailyFailedCount: number;
  dailyPendingCount: number;
  dailySavedCount: number;
  draftEntryCount: number;
  issues: DashboardIssue[];
  missingPastDailyReportCount: number;
  openDate: string;
  project: Project;
  submittedEntryCount: number;
};

export function DashboardMetric({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "error" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <div className={`dashboard-metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DashboardWeeklyCalendar({
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entryDayKeys,
  fieldAssignmentCountsByProjectId,
  onOpenDay,
  onOpenFieldAccess,
  projects,
  setStatusMode,
  setWeekStart,
  statusMode,
  weekDates,
  weekStart
}: {
  dailyReportUploadsByKey: Record<string, DailyReportUpload | undefined>;
  dailyReportsByKey: Record<string, unknown>;
  daySubmissions: Record<string, DaySubmission | undefined>;
  entryDayKeys: Set<string>;
  fieldAssignmentCountsByProjectId?: Record<string, number>;
  onOpenDay: (projectId: string, date: string) => void;
  onOpenFieldAccess?: (projectId: string) => void;
  projects: Project[];
  setStatusMode: (mode: CalendarStatusMode) => void;
  setWeekStart: (weekStart: string) => void;
  statusMode: CalendarStatusMode;
  weekDates: string[];
  weekStart: string;
}) {
  return (
    <div className="dashboard-calendar">
      <div className="dashboard-calendar-controls">
        <div className="week-nav">
          <button
            aria-label="Previous week"
            className="icon-button"
            onClick={() => setWeekStart(addDaysToInputDate(weekStart, -7))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div className="week-range">
            <span>Week</span>
            <strong>{formatWeekRange(weekDates)}</strong>
          </div>
          <button
            aria-label="Next week"
            className="icon-button"
            onClick={() => setWeekStart(addDaysToInputDate(weekStart, 7))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="calendar-status-toggle" aria-label="Dashboard status type">
          <button className={statusMode === "entry_status" ? "active" : ""} onClick={() => setStatusMode("entry_status")} type="button">
            Entry Status
          </button>
          <button className={statusMode === "daily_reports" ? "active" : ""} onClick={() => setStatusMode("daily_reports")} type="button">
            Daily Reports
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No projects available">
          Projects will appear here after they are available to your account.
        </EmptyState>
      ) : (
        <div className="weekly-calendar dashboard-weekly-calendar">
          <div className="weekly-calendar-row weekly-calendar-header">
            <span>Job</span>
            {weekDates.map((date) => (
              <span key={date}>{formatWeekDayLabel(date)}</span>
            ))}
          </div>
          {projects.map((project) => (
            <div className="weekly-calendar-row" key={project.id}>
              <span className="weekly-calendar-job dashboard-weekly-calendar-job">
                <span>{project.name}</span>
                {onOpenFieldAccess ? (
                  <button
                    aria-label={`Open Field Access for ${project.name}. ${fieldAssignmentCountsByProjectId?.[project.id] ?? 0} Field users assigned.`}
                    className="field-assignment-count-button"
                    onClick={() => onOpenFieldAccess(project.id)}
                    type="button"
                  >
                    <Users aria-hidden="true" size={14} />
                    {fieldAssignmentCountsByProjectId?.[project.id] ?? 0}
                  </button>
                ) : null}
              </span>
              {weekDates.map((date) => {
                const dayKey = getDayKey(project.id, date);
                const hasDailyEntryActivity = getHasDailyEntryActivity(project, dayKey, daySubmissions, entryDayKeys);
                const status =
                  statusMode === "daily_reports"
                    ? getDailyReportCalendarStatus(
                        dailyReportsByKey[dayKey],
                        dailyReportUploadsByKey[dayKey],
                        hasDailyEntryActivity
                      )
                    : getProjectEntryCalendarStatus(project, daySubmissions[dayKey], entryDayKeys.has(dayKey));

                return (
                  <button
                    aria-label={`Open ${project.name} entry for ${formatWeekDayLabel(date)}. Status: ${status.label}`}
                    className={`status-badge ${status.className}`}
                    data-label={formatWeekDayLabel(date)}
                    key={date}
                    onClick={() => onOpenDay(project.id, date)}
                    type="button"
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardAttentionList({
  onOpenDay,
  rows
}: {
  onOpenDay: (projectId: string, date: string) => void;
  rows: DashboardProjectWeekRow[];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={CheckCircle2} title="No projects need attention">
        Drafts, failed uploads, and pending Procore uploads for the selected week will appear here.
      </EmptyState>
    );
  }

  return (
    <div className="dashboard-attention-list">
      {rows.map((row) => (
        <details className="dashboard-attention-row dashboard-drilldown-row" key={row.project.id}>
          <summary>
            <span className="dashboard-row-heading">
              <strong>{row.project.name}</strong>
              <small>{formatDashboardAttentionSummary(row)}</small>
            </span>
            <span className="dashboard-row-action">Drill down</span>
          </summary>
          <div className="dashboard-issue-list">
            {row.issues.map((issue) => (
              <div className={`dashboard-issue-row ${issue.tone}`} key={issue.id}>
                <span>
                  <strong>{formatDate(issue.date)}</strong>
                  <small>
                    {issue.label}: {issue.detail}
                  </small>
                </span>
                <button className="secondary-button compact-button" onClick={() => onOpenDay(row.project.id, issue.date)} type="button">
                  Open
                </button>
              </div>
            ))}
            {row.issues.length === 0 && row.openDate ? (
              <button className="secondary-button compact-button" onClick={() => onOpenDay(row.project.id, row.openDate)} type="button">
                Open {formatDate(row.openDate)}
              </button>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function getProjectEntryCalendarStatus(project: Project, daySubmission: DaySubmission | undefined, hasSavedEntries: boolean) {
  if (isTwoSeriesProject(project)) {
    return {
      className: "not-applicable",
      label: "N/A"
    };
  }

  return getEntryCalendarStatus(daySubmission, hasSavedEntries);
}

function getEntryCalendarStatus(daySubmission: DaySubmission | undefined, hasSavedEntries: boolean) {
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

function getHasDailyEntryActivity(
  project: Project,
  dayKey: string,
  daySubmissions: Record<string, DaySubmission | undefined>,
  entryDayKeys: Set<string>
) {
  if (isTwoSeriesProject(project)) {
    return false;
  }

  return entryDayKeys.has(dayKey) || Boolean(daySubmissions[dayKey]);
}

function getDailyReportCalendarStatus(
  dailyReport: unknown,
  upload: DailyReportUpload | undefined,
  hasDailyEntryActivity = true
) {
  if (upload?.status === "uploaded") {
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
