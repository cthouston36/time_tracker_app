"use client";

import { CheckCircle2, ChevronDown, Inbox, Users } from "lucide-react";
import { todayInputValue } from "@/lib/date";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import { FieldProjectAssignmentPanel } from "@/features/time-allocation/components/dashboard/field-project-assignment-panel";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import { getProjectWorkTypeLabel } from "@/features/time-allocation/lib/status-helpers";
import type { MyJobsByUser } from "@/features/time-allocation/types";

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
