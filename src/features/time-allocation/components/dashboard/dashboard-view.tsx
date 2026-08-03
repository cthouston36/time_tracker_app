"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { todayInputValue } from "@/lib/date";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { DashboardLoadingSkeleton, PageHeader } from "@/features/time-allocation/components/workspace-primitives";
import {
  DashboardAttentionList,
  DashboardMetric,
  DashboardWeeklyCalendar
} from "@/features/time-allocation/components/dashboard/dashboard-components";
import {
  ExecutiveFieldAccessTools,
  ExecutiveProjectNavigator,
  ExecutiveReviewQueue,
  ExecutiveSummaryStrip,
  PmComplianceRanking
} from "@/features/time-allocation/components/dashboard/executive-dashboard-components";
import { FieldProjectAssignmentPanel } from "@/features/time-allocation/components/dashboard/field-project-assignment-panel";
import {
  addDaysToInputDate,
  formatDate,
  formatWeekRange,
  getWeekDates,
  getWeekStart
} from "@/features/time-allocation/lib/date-helpers";
import { buildEntryDayKeySet } from "@/features/time-allocation/lib/status-helpers";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import {
  buildDashboardMetrics,
  buildDashboardProjectNavigationRows,
  buildDashboardProjectRows,
  buildExecutiveReviewItems,
  buildFieldAssignmentVisibilityRows,
  buildPmComplianceRows,
  buildProductionPerformanceAlerts,
  filterDashboardProjectNavigationRows
} from "@/features/time-allocation/lib/dashboard-helpers";
import type {
  CalendarStatusMode,
  DailyReportsByKey,
  DailyReportUploadsByKey,
  DaySubmissionsByKey,
  MyJobsByUser
} from "@/features/time-allocation/types";

export function DashboardView({
  adminTools,
  currentUser,
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entries,
  fieldAssignmentNotice,
  fieldUsers,
  myJobsByUser,
  onOpenDay,
  onSaveFieldAssignments,
  projects,
  loading,
  savingFieldAssignmentProjectId
}: {
  adminTools?: ReactNode;
  currentUser: AuthUser;
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  fieldAssignmentNotice: { message: string; status: "success" | "error" } | null;
  fieldUsers: AuthUser[];
  myJobsByUser: MyJobsByUser;
  onOpenDay: (projectId: string, date: string) => void;
  onSaveFieldAssignments: (projectId: string, fieldUserIds: string[]) => Promise<void>;
  projects: Project[];
  loading?: boolean;
  savingFieldAssignmentProjectId: string;
}) {
  const [weekStart, setWeekStart] = useState(getWeekStart(todayInputValue()));
  const [statusMode, setStatusMode] = useState<CalendarStatusMode>(
    currentUser.role === "project_manager" || currentUser.role === "standard" ? "entry_status" : "daily_reports"
  );
  const [dashboardProjectQuery, setDashboardProjectQuery] = useState("");
  const [fieldAccessRequest, setFieldAccessRequest] = useState<{ projectId: string; token: number } | null>(null);
  const today = todayInputValue();
  const productionAlertStartDate = addDaysToInputDate(today, -45);
  const weekDates = getWeekDates(weekStart);
  const entryDayKeys = useMemo(() => buildEntryDayKeySet(entries), [entries]);
  const sortedProjects = useMemo(() => sortProjectsByName(projects), [projects]);
  const projectRows = useMemo(
    () =>
      buildDashboardProjectRows({
        dailyReportUploadsByKey,
        dailyReportsByKey,
        daySubmissions,
        entryDayKeys,
        projects,
        weekDates
      }),
    [dailyReportUploadsByKey, dailyReportsByKey, daySubmissions, entryDayKeys, projects, weekDates]
  );
  const metrics = buildDashboardMetrics(projectRows);
  const fieldAssignmentRows = useMemo(
    () => buildFieldAssignmentVisibilityRows(sortedProjects, fieldUsers, myJobsByUser),
    [fieldUsers, myJobsByUser, sortedProjects]
  );
  const fieldAssignmentCountsByProjectId = useMemo(
    () =>
      fieldAssignmentRows.reduce<Record<string, number>>((counts, row) => {
        counts[row.project.id] = row.assignedUsers.length;

        return counts;
      }, {}),
    [fieldAssignmentRows]
  );
  const productionAlerts = useMemo(
    () =>
      buildProductionPerformanceAlerts({
        endDate: today,
        entries,
        projects: sortedProjects,
        startDate: productionAlertStartDate
      }),
    [entries, productionAlertStartDate, sortedProjects, today]
  );
  const pmComplianceRows = useMemo(() => buildPmComplianceRows(projectRows), [projectRows]);
  const dashboardProjectNavigationRows = useMemo(
    () => buildDashboardProjectNavigationRows(projectRows, fieldAssignmentRows),
    [fieldAssignmentRows, projectRows]
  );
  const filteredDashboardProjectNavigationRows = useMemo(
    () => filterDashboardProjectNavigationRows(dashboardProjectNavigationRows, dashboardProjectQuery),
    [dashboardProjectNavigationRows, dashboardProjectQuery]
  );
  const attentionRows = [...projectRows]
    .filter((row) => row.attentionScore > 0)
    .sort((left, right) => right.attentionScore - left.attentionScore || left.project.name.localeCompare(right.project.name))
    .slice(0, 8);
  const executiveReviewItems = useMemo(
    () => buildExecutiveReviewItems(attentionRows, productionAlerts),
    [attentionRows, productionAlerts]
  );
  const isProjectManager = currentUser.role === "project_manager";
  const isExecutive = currentUser.role === "executive";
  const canManageFieldAccess = currentUser.role === "admin" || currentUser.role === "project_manager";
  const requestFieldAccessProject = useCallback((projectId: string) => {
    setFieldAccessRequest((current) => ({
      projectId,
      token: (current?.token ?? 0) + 1
    }));
  }, []);
  const dashboardTitle =
    currentUser.role === "admin"
      ? "Admin Dashboard"
      : isExecutive
        ? "Executive Dashboard"
        : isProjectManager
          ? "Project Manager Dashboard"
          : currentUser.role === "standard"
            ? "Field Dashboard"
            : "Dashboard";
  const dashboardScope =
    currentUser.role === "admin"
      ? "Company"
      : currentUser.role === "executive"
        ? "Company"
        : isProjectManager
          ? "My Projects"
          : "Assigned Projects";
  const dashboardMeta = isExecutive
    ? [dashboardScope, `${projects.length} project${projects.length === 1 ? "" : "s"}`, `Review week ${formatWeekRange(weekDates)}`]
    : [dashboardScope, `${projects.length} project${projects.length === 1 ? "" : "s"}`, `Week of ${formatDate(weekStart)}`];

  return (
    <section className="allocation-grid dashboard-view">
      <PageHeader
        icon={LayoutDashboard}
        kicker="Dashboard"
        meta={dashboardMeta}
        title={dashboardTitle}
      />

      {loading ? <DashboardLoadingSkeleton /> : null}

      {!loading ? (
        <>
      {isExecutive ? (
        <ExecutiveSummaryStrip
          fieldAssignmentGapCount={fieldAssignmentRows.filter((row) => row.assignedUsers.length === 0).length}
          issueProjectCount={attentionRows.length}
          openIssueCount={attentionRows.reduce((total, row) => total + row.issues.length, 0)}
          pmIssueCount={pmComplianceRows.length}
          productionAlertCount={productionAlerts.length}
          projectCount={projects.length}
        />
      ) : (
        <div className="dashboard-metrics">
          <DashboardMetric label="Projects" value={String(projects.length)} />
          <DashboardMetric label="Submitted Days" value={String(metrics.submittedEntryDays)} tone="success" />
          <DashboardMetric label="Draft Days" value={String(metrics.draftEntryDays)} tone={metrics.draftEntryDays > 0 ? "warning" : "neutral"} />
          <DashboardMetric label="Daily Reports" value={String(metrics.savedDailyReports)} tone={metrics.savedDailyReports > 0 ? "success" : "neutral"} />
          <DashboardMetric
            label="Procore Issues"
            value={String(metrics.procoreAttentionCount)}
            tone={metrics.procoreAttentionCount > 0 ? "error" : "success"}
          />
        </div>
      )}

      {isExecutive ? (
        <div className="executive-dashboard-layout">
          <div className="executive-dashboard-primary">
            <ExecutiveReviewQueue items={executiveReviewItems} onOpenDay={onOpenDay} />
            <PmComplianceRanking rows={pmComplianceRows} onOpenDay={onOpenDay} />
          </div>

          <div className="executive-dashboard-secondary">
            <ExecutiveProjectNavigator
              onOpenDay={onOpenDay}
              onQueryChange={setDashboardProjectQuery}
              query={dashboardProjectQuery}
              rows={filteredDashboardProjectNavigationRows}
              totalRows={dashboardProjectNavigationRows.length}
            />
            <ExecutiveFieldAccessTools
              currentUser={currentUser}
              fieldAssignmentNotice={fieldAssignmentNotice}
              fieldAssignmentRows={fieldAssignmentRows}
              fieldUsers={fieldUsers}
              myJobsByUser={myJobsByUser}
              onOpenDay={onOpenDay}
              onSaveFieldAssignments={onSaveFieldAssignments}
              projects={sortedProjects}
              savingFieldAssignmentProjectId={savingFieldAssignmentProjectId}
            />
          </div>
        </div>
      ) : (
        <div className={currentUser.role === "admin" ? "dashboard-main-grid admin" : "dashboard-main-grid"}>
          <div className="dashboard-main-column">
            <div className="panel dashboard-calendar-panel">
              <div className="panel-heading">
                <h2>
                  {currentUser.role === "standard"
                    ? "Assigned Project Calendar"
                    : isProjectManager
                      ? "My Project Calendar"
                      : "Weekly Project Status"}
                </h2>
                <span className="dashboard-panel-meta">{formatWeekRange(weekDates)}</span>
              </div>
              <DashboardWeeklyCalendar
                dailyReportUploadsByKey={dailyReportUploadsByKey}
                dailyReportsByKey={dailyReportsByKey}
                daySubmissions={daySubmissions}
                entryDayKeys={entryDayKeys}
                fieldAssignmentCountsByProjectId={fieldAssignmentCountsByProjectId}
                onOpenDay={onOpenDay}
                onOpenFieldAccess={canManageFieldAccess ? requestFieldAccessProject : undefined}
                projects={sortedProjects}
                setStatusMode={setStatusMode}
                setWeekStart={setWeekStart}
                statusMode={statusMode}
                weekDates={weekDates}
                weekStart={weekStart}
              />
            </div>

            <div className="panel dashboard-projects-panel">
              <div className="panel-heading">
                <h2>Projects Needing Attention</h2>
                <span className="dashboard-panel-meta">{attentionRows.length} shown</span>
              </div>
              <DashboardAttentionList rows={attentionRows} onOpenDay={onOpenDay} />
            </div>

            <FieldProjectAssignmentPanel
              currentUser={currentUser}
              fieldUsers={fieldUsers}
              myJobsByUser={myJobsByUser}
              notice={fieldAssignmentNotice}
              onSaveAssignments={onSaveFieldAssignments}
              projects={sortedProjects}
              requestedProjectId={fieldAccessRequest?.projectId}
              requestKey={fieldAccessRequest?.token ?? 0}
              savingProjectId={savingFieldAssignmentProjectId}
            />
          </div>

          {currentUser.role === "admin" && adminTools ? (
            <div className="dashboard-admin-column">
              <div className="panel dashboard-admin-panel">{adminTools}</div>
            </div>
          ) : null}
        </div>
      )}
        </>
      ) : null}
    </section>
  );
}
