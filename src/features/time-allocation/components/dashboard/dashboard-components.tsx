"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Inbox,
  Save,
  Users
} from "lucide-react";
import { todayInputValue } from "@/lib/date";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { Project } from "@/lib/domain/types";
import type { AuthUser } from "@/lib/auth/types";
import { EmptyState, InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import { getFieldUserIdsAssignedToProject } from "@/features/time-allocation/lib/selectors";
import type {
  CalendarStatusMode,
  DailyReportUpload,
  DaySubmission,
  MyJobsByUser
} from "@/features/time-allocation/types";

export type DashboardIssue = {
  date: string;
  detail: string;
  id: string;
  label: string;
  tone: "error" | "neutral" | "warning";
};

export type DashboardProjectNavigationRow = {
  assignedFieldCount: number;
  assignedFieldNames: string[];
  issueCount: number;
  openDate: string;
  project: Project;
};

export type ExecutiveReviewItem = {
  detail: string;
  id: string;
  meta: string;
  openDate: string;
  projectId: string;
  projectName: string;
  title: string;
  tone: "error" | "neutral" | "warning";
  type: "Production" | "Status";
};

export type FieldAssignmentVisibilityRow = {
  assignedUsers: AuthUser[];
  project: Project;
};

export type PmComplianceProjectRow = {
  openDate: string;
  projectId: string;
  projectName: string;
  summary: string;
};

export type PmComplianceRow = {
  id: string;
  issueCount: number;
  issueProjectCount: number;
  name: string;
  projectCount: number;
  projects: PmComplianceProjectRow[];
  score: number;
};

export type ProductionPerformanceAlert = {
  detail: string;
  id: string;
  message: string;
  openDate: string;
  payItemLabel: string;
  projectId: string;
  projectName: string;
  tone: "error" | "warning";
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

export function ExecutiveSummaryStrip({
  fieldAssignmentGapCount,
  issueProjectCount,
  openIssueCount,
  pmIssueCount,
  productionAlertCount,
  projectCount
}: {
  fieldAssignmentGapCount: number;
  issueProjectCount: number;
  openIssueCount: number;
  pmIssueCount: number;
  productionAlertCount: number;
  projectCount: number;
}) {
  return (
    <div className="executive-summary-strip">
      <div className="executive-summary-card primary">
        <span>Needs Review</span>
        <strong>{openIssueCount + productionAlertCount}</strong>
        <small>
          {issueProjectCount} project{issueProjectCount === 1 ? "" : "s"} with status issues
        </small>
      </div>
      <div className={productionAlertCount > 0 ? "executive-summary-card warning" : "executive-summary-card success"}>
        <span>Production Alerts</span>
        <strong>{productionAlertCount}</strong>
        <small>Recent performance and quantity checks</small>
      </div>
      <div className={pmIssueCount > 0 ? "executive-summary-card warning" : "executive-summary-card success"}>
        <span>PM Follow-up</span>
        <strong>{pmIssueCount}</strong>
        <small>PMs with open issue-driven items</small>
      </div>
      <div className={fieldAssignmentGapCount > 0 ? "executive-summary-card warning" : "executive-summary-card success"}>
        <span>Field Access Gaps</span>
        <strong>{fieldAssignmentGapCount}</strong>
        <small>
          {projectCount} active project{projectCount === 1 ? "" : "s"} reviewed
        </small>
      </div>
    </div>
  );
}

export function ExecutiveReviewQueue({
  items,
  onOpenDay
}: {
  items: ExecutiveReviewItem[];
  onOpenDay: (projectId: string, date: string) => void;
}) {
  const visibleItems = items.slice(0, 12);

  return (
    <div className="panel executive-review-panel">
      <div className="panel-heading">
        <span>
          <h2>Executive Review Queue</h2>
          <small>Prioritized exceptions across production, daily reports, entries, and Procore uploads.</small>
        </span>
        <span className="dashboard-panel-meta">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      {visibleItems.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No open review items">
          Current week status and recent production checks are clear.
        </EmptyState>
      ) : (
        <div className="executive-review-list">
          {visibleItems.map((item) => (
            <div className={`executive-review-row ${item.tone}`} key={item.id}>
              <span className="executive-review-type">{item.type}</span>
              <span className="dashboard-row-heading">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="dashboard-row-meta">
                <strong>{item.projectName}</strong>
                <small>{item.meta}</small>
              </span>
              <button className="secondary-button compact-button" onClick={() => onOpenDay(item.projectId, item.openDate)} type="button">
                Review
              </button>
            </div>
          ))}
          {items.length > visibleItems.length ? (
            <span className="dashboard-list-note">Showing the highest-priority review items first.</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ExecutiveProjectNavigator({
  onOpenDay,
  onQueryChange,
  query,
  rows,
  totalRows
}: {
  onOpenDay: (projectId: string, date: string) => void;
  onQueryChange: (query: string) => void;
  query: string;
  rows: DashboardProjectNavigationRow[];
  totalRows: number;
}) {
  const visibleRows = rows.slice(0, 8);

  return (
    <div className="panel dashboard-executive-panel executive-project-navigator">
      <div className="panel-heading">
        <h2>Find a Job</h2>
        <span className="dashboard-panel-meta">
          {rows.length} of {totalRows} project{totalRows === 1 ? "" : "s"}
        </span>
      </div>
      <label className="dashboard-search-field">
        <span>Find Job</span>
        <input
          placeholder="Search job, PM, type, or assigned Field user"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {visibleRows.length === 0 ? (
        <EmptyState icon={Inbox} title="No matching projects" />
      ) : (
        <div className="dashboard-section-list">
          {visibleRows.map((row) => (
            <div className="dashboard-list-row" key={row.project.id}>
              <span className="dashboard-row-heading">
                <strong>{row.project.name}</strong>
                <small>
                  {getProjectWorkTypeLabel(row.project)} | {row.project.netSuiteProjectManagerName || "No PM mapped"}
                </small>
              </span>
              <span className="dashboard-chip-row">
                <span className={row.issueCount > 0 ? "dashboard-chip warning" : "dashboard-chip success"}>
                  {row.issueCount} issue{row.issueCount === 1 ? "" : "s"}
                </span>
                <span className="dashboard-chip">
                  {row.assignedFieldCount} Field user{row.assignedFieldCount === 1 ? "" : "s"}
                </span>
              </span>
              <button className="secondary-button compact-button" onClick={() => onOpenDay(row.project.id, row.openDate)} type="button">
                Review
              </button>
            </div>
          ))}
          {rows.length > visibleRows.length ? (
            <span className="dashboard-list-note">Narrow the search to see more matching jobs.</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ExecutiveFieldAccessTools({
  currentUser,
  fieldAssignmentNotice,
  fieldAssignmentRows,
  fieldUsers,
  myJobsByUser,
  onOpenDay,
  onSaveFieldAssignments,
  projects,
  savingFieldAssignmentProjectId
}: {
  currentUser: AuthUser;
  fieldAssignmentNotice: { message: string; status: "success" | "error" } | null;
  fieldAssignmentRows: FieldAssignmentVisibilityRow[];
  fieldUsers: AuthUser[];
  myJobsByUser: MyJobsByUser;
  onOpenDay: (projectId: string, date: string) => void;
  onSaveFieldAssignments: (projectId: string, fieldUserIds: string[]) => Promise<void>;
  projects: Project[];
  savingFieldAssignmentProjectId: string;
}) {
  const missingAssignmentCount = fieldAssignmentRows.filter((row) => row.assignedUsers.length === 0).length;

  return (
    <details className="panel executive-field-tools-panel">
      <summary className="executive-section-summary">
        <span>
          <strong>Field Access Tools</strong>
          <small>
            {missingAssignmentCount} project{missingAssignmentCount === 1 ? "" : "s"} with no Field users assigned
          </small>
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="executive-field-tools-body">
        <FieldAssignmentVisibilityPanel rows={fieldAssignmentRows} onOpenDay={onOpenDay} />
        <FieldProjectAssignmentPanel
          currentUser={currentUser}
          fieldUsers={fieldUsers}
          myJobsByUser={myJobsByUser}
          notice={fieldAssignmentNotice}
          onSaveAssignments={onSaveFieldAssignments}
          projects={projects}
          savingProjectId={savingFieldAssignmentProjectId}
        />
      </div>
    </details>
  );
}

export function PmComplianceRanking({
  onOpenDay,
  rows
}: {
  onOpenDay: (projectId: string, date: string) => void;
  rows: PmComplianceRow[];
}) {
  return (
    <div className="panel dashboard-executive-panel">
      <div className="panel-heading">
        <h2>PM Compliance Ranking</h2>
        <span className="dashboard-panel-meta">Issue-driven</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No PM compliance issues">
          Drafts, missing dailies after entry activity, and Procore upload issues will appear here.
        </EmptyState>
      ) : (
        <div className="dashboard-section-list">
          {rows.map((row) => (
            <details className="dashboard-list-row dashboard-drilldown-row" key={row.id}>
              <summary>
                <span className="dashboard-row-heading">
                  <strong>{row.name}</strong>
                  <small>
                    {row.issueProjectCount} of {row.projectCount} project{row.projectCount === 1 ? "" : "s"} need attention
                  </small>
                </span>
                <span className="dashboard-chip warning">
                  {row.issueCount} issue{row.issueCount === 1 ? "" : "s"}
                </span>
              </summary>
              <div className="dashboard-issue-list">
                {row.projects.map((project) => (
                  <div className="dashboard-issue-row warning" key={project.projectId}>
                    <span>
                      <strong>{project.projectName}</strong>
                      <small>{project.summary}</small>
                    </span>
                    {project.openDate ? (
                      <button className="secondary-button compact-button" onClick={() => onOpenDay(project.projectId, project.openDate)} type="button">
                        Open
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldAssignmentVisibilityPanel({
  onOpenDay,
  rows
}: {
  onOpenDay: (projectId: string, date: string) => void;
  rows: FieldAssignmentVisibilityRow[];
}) {
  const visibleRows = rows.slice(0, 14);

  return (
    <div className="panel dashboard-executive-panel">
      <div className="panel-heading">
        <h2>Field User Assignment Visibility</h2>
        <span className="dashboard-panel-meta">
          {rows.length} project{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {visibleRows.length === 0 ? (
        <EmptyState icon={Users} title="No projects available" />
      ) : (
        <div className="dashboard-section-list">
          {visibleRows.map((row) => (
            <div className={row.assignedUsers.length > 0 ? "dashboard-list-row" : "dashboard-list-row warning"} key={row.project.id}>
              <span className="dashboard-row-heading">
                <strong>{row.project.name}</strong>
                <small>{row.project.netSuiteProjectManagerName || "No PM mapped"}</small>
              </span>
              <span className="dashboard-row-meta">
                <strong>
                  {row.assignedUsers.length} Field user{row.assignedUsers.length === 1 ? "" : "s"}
                </strong>
                <small>{row.assignedUsers.length > 0 ? row.assignedUsers.map(formatUserName).join(", ") : "No Field users assigned"}</small>
              </span>
              <button className="secondary-button compact-button" onClick={() => onOpenDay(row.project.id, todayInputValue())} type="button">
                Open
              </button>
            </div>
          ))}
          {rows.length > visibleRows.length ? (
            <span className="dashboard-list-note">Showing projects with missing assignments first.</span>
          ) : null}
        </div>
      )}
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

export function FieldProjectAssignmentPanel({
  currentUser,
  fieldUsers,
  myJobsByUser,
  notice,
  onSaveAssignments,
  projects,
  requestedProjectId,
  requestKey = 0,
  savingProjectId
}: {
  currentUser: AuthUser;
  fieldUsers: AuthUser[];
  myJobsByUser: MyJobsByUser;
  notice: { message: string; status: "success" | "error" } | null;
  onSaveAssignments: (projectId: string, fieldUserIds: string[]) => Promise<void>;
  projects: Project[];
  requestedProjectId?: string;
  requestKey?: number;
  savingProjectId: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [fieldUserSearch, setFieldUserSearch] = useState("");
  const [draftFieldUserIds, setDraftFieldUserIds] = useState<string[]>([]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const assignedFieldUserIds = selectedProject ? getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, selectedProject.id) : [];
  const draftFieldUserIdSet = useMemo(() => new Set(draftFieldUserIds), [draftFieldUserIds]);
  const filteredFieldUsers = useMemo(
    () => filterFieldUsersBySearch(fieldUsers, fieldUserSearch),
    [fieldUserSearch, fieldUsers]
  );
  const hasChanges = selectedProject ? !sameStringSet(assignedFieldUserIds, draftFieldUserIds) : false;

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectId("");
      setDraftFieldUserIds([]);
      return;
    }

    if (selectedProject.id !== selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    }

    setDraftFieldUserIds(getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, selectedProject.id));
  }, [fieldUsers, myJobsByUser, selectedProject, selectedProjectId]);

  useEffect(() => {
    if (!requestedProjectId || !projects.some((project) => project.id === requestedProjectId)) {
      return;
    }

    setSelectedProjectId(requestedProjectId);

    if (detailsRef.current) {
      detailsRef.current.open = true;
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }
  }, [projects, requestedProjectId, requestKey]);

  function toggleFieldUser(userId: string) {
    setDraftFieldUserIds((current) =>
      current.includes(userId) ? current.filter((candidate) => candidate !== userId) : [...current, userId]
    );
  }

  if (currentUser.role === "standard") {
    return null;
  }

  return (
    <details className="panel dashboard-field-access-panel" ref={detailsRef}>
      <summary className="field-access-summary">
        <span>
          <strong>Field Access</strong>
          <small>Assign Field users by project</small>
        </span>
        <span className="field-access-summary-meta">
          {selectedProject ? `${draftFieldUserIds.length} assigned` : `${projects.length} projects`}
          <ChevronDown aria-hidden="true" size={18} />
        </span>
      </summary>

      <div className="field-access-body">
        <div className="field-access-intro">
          <span className="dashboard-panel-meta">Choose a job, then assign the Field users who can enter and upload against it.</span>
          {selectedProject ? (
            <span className="dashboard-panel-meta">
              {draftFieldUserIds.length} Field user{draftFieldUserIds.length === 1 ? "" : "s"} assigned
            </span>
          ) : null}
        </div>

        {notice ? <div className={notice.status === "error" ? "inline-alert" : "success-alert"}>{notice.message}</div> : null}

        {fieldUsers.length === 0 ? (
          <EmptyState icon={Users} title="No Field users available">
            Create active Field users before assigning project access.
          </EmptyState>
        ) : projects.length === 0 ? (
          <EmptyState icon={Inbox} title="No assignable projects">
            Projects you can assign will appear here after sync and access setup.
          </EmptyState>
        ) : (
          <div className="field-access-layout">
            <div className="field-access-controls">
              <label className="field-group">
                <span>Project</span>
                <select value={selectedProject?.id ?? ""} onChange={(event) => setSelectedProjectId(event.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Find Field User</span>
                <input
                  placeholder="Search name or user ID"
                  value={fieldUserSearch}
                  onChange={(event) => setFieldUserSearch(event.target.value)}
                />
              </label>
            </div>

            <div className="field-access-project-list">
              {filteredFieldUsers.map((user) => (
                <label className="field-access-project-row" key={user.id}>
                  <input checked={draftFieldUserIdSet.has(user.id)} onChange={() => toggleFieldUser(user.id)} type="checkbox" />
                  <span>
                    <strong>{formatUserName(user)}</strong>
                    <small>
                      {user.id} - {draftFieldUserIdSet.has(user.id) ? "Attached" : "Not assigned"}
                    </small>
                  </span>
                </label>
              ))}
              {filteredFieldUsers.length === 0 ? <EmptyState title="No matching Field users" /> : null}
            </div>

            <div className="field-access-actions">
              <span className="field-note">
                PMs can only assign projects tied to their NetSuite Project Manager record.
              </span>
              <button
                className="primary-button prominent-action"
                disabled={!selectedProject || !hasChanges || savingProjectId === selectedProject.id}
                onClick={() => selectedProject && void onSaveAssignments(selectedProject.id, draftFieldUserIds)}
                type="button"
              >
                {savingProjectId === selectedProject?.id ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
                {savingProjectId === selectedProject?.id ? "Saving..." : "Save Field Access"}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function filterFieldUsersBySearch(fieldUsers: AuthUser[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return fieldUsers;
  }

  return fieldUsers.filter((fieldUser) =>
    [fieldUser.id, fieldUser.firstName, fieldUser.lastName].join(" ").toLowerCase().includes(normalizedSearch)
  );
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
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

function getProjectWorkTypeLabel(project: Project | null | undefined) {
  if (!project) {
    return "No job type";
  }

  return isTwoSeriesProject(project) ? "Electrical" : "Signal";
}

function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
}

function formatUserName(user: AuthUser) {
  return `${user.firstName} ${user.lastName}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString();
}

function addDaysToInputDate(value: string, days: number) {
  const date = parseInputDate(value);

  date.setDate(date.getDate() + days);

  return formatInputDate(date);
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWeekRange(weekDates: string[]) {
  const start = parseInputDate(weekDates[0]);
  const end = parseInputDate(weekDates[weekDates.length - 1]);

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  )}`;
}

function formatWeekDayLabel(value: string) {
  return parseInputDate(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric"
  });
}
