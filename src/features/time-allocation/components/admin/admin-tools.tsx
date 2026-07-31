"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Download,
  Edit3,
  ExternalLink,
  KeyRound,
  ListChecks,
  PlugZap,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/procore/types";
import type {
  CrewMember,
  CrewMembersByProject,
  ManagedAppUser,
  NetSuiteProjectManagerOption,
  NetSuiteVendor,
  ProcoreSyncSummary,
  ProjectArchiveById,
  ProjectBlacklistById,
  SyncLogEntry,
  VendorBlacklistById
} from "@/features/time-allocation/types";

export type AdminUserFormState = {
  active: boolean;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId: string;
  netSuiteProjectManagerName: string;
  password: string;
  role: AuthUser["role"];
  userId: string;
};

export type PasswordResetResponse = {
  error?: string;
  expiresAt?: string;
  ok?: boolean;
  token?: string;
  userId?: string;
};

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

type AuditLogEntry = {
  action: string;
  actorName?: string;
  actorRole?: string;
  actorUserId?: string;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  targetId?: string;
  targetType?: string;
};

type AuditLogFilters = {
  action: string;
  actorUserId: string;
  endDate: string;
  limit: string;
  projectId: string;
  startDate: string;
  targetId: string;
  targetType: string;
};

type AuditLogResponse = {
  auditLog?: AuditLogEntry[];
  databaseConfigured?: boolean;
  error?: string;
};

type DataQualityIssue = {
  detail: string;
  id: string;
  severity: "error" | "info" | "warning";
  title: string;
};

export function AdminToolsDrawer({
  allNetSuiteVendors,
  allProjects,
  adminPasswordResetToken,
  adminUserForm,
  adminUsers,
  adminUsersNotice,
  adminMaintenanceNotice,
  clearingProjectCache,
  clearingStagingData,
  crewDirectory,
  crewMembersByProject,
  currentUser,
  editingAdminUserId,
  entries,
  loadingAdminUsers,
  netSuiteProjectManagerOptions,
  netSuiteVendorBlacklistById,
  netSuiteVendorsSyncedAt,
  onAddOrUpdateProject,
  onCancelAdminUserEdit,
  onClearProjectCache,
  onClearStagingData,
  onConfigureProcoreUpload,
  onCreatePasswordResetToken,
  onEditUser,
  onExportAllEntryDetails,
  onOpenDailyEntry,
  onRefreshUsers,
  onRetryDailyReportUpload,
  onSaveUser,
  onSetUserActive,
  onSyncAllProjects,
  onSyncNetSuiteVendors,
  onSyncNewProjects,
  onToggleProjectArchive,
  onToggleProjectBlacklist,
  onToggleVendorBlacklist,
  onUpdateAdminUserForm,
  projectArchiveById,
  projectBlacklistById,
  retryingDailyReportUploadKey,
  savingAdminUser,
  syncLog,
  syncing,
  syncingAll,
  syncingNetSuiteVendors,
  syncSummary,
  updatingProject
}: {
  allNetSuiteVendors: NetSuiteVendor[];
  allProjects: Project[];
  adminPasswordResetToken: PasswordResetResponse | null;
  adminUserForm: AdminUserFormState;
  adminUsers: ManagedAppUser[];
  adminUsersNotice: string;
  adminMaintenanceNotice: { message: string; status: "success" | "error" } | null;
  clearingProjectCache: boolean;
  clearingStagingData: boolean;
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  currentUser: AuthUser;
  editingAdminUserId: string;
  entries: AllocationEntry[];
  loadingAdminUsers: boolean;
  netSuiteProjectManagerOptions: NetSuiteProjectManagerOption[];
  netSuiteVendorBlacklistById: VendorBlacklistById;
  netSuiteVendorsSyncedAt: string | null;
  onAddOrUpdateProject: () => void;
  onCancelAdminUserEdit: () => void;
  onClearProjectCache: () => void;
  onClearStagingData: () => void;
  onConfigureProcoreUpload: () => void;
  onCreatePasswordResetToken: (user: ManagedAppUser) => void;
  onEditUser: (user: ManagedAppUser) => void;
  onExportAllEntryDetails: () => void;
  onOpenDailyEntry: (projectId: string, date: string) => void;
  onRefreshUsers: () => void;
  onRetryDailyReportUpload: (dayKey: string) => Promise<void>;
  onSaveUser: () => void;
  onSetUserActive: (user: ManagedAppUser, active: boolean) => void;
  onSyncAllProjects: () => void;
  onSyncNetSuiteVendors: () => void;
  onSyncNewProjects: () => void;
  onToggleProjectArchive: (projectId: string, archived: boolean) => void;
  onToggleProjectBlacklist: (projectId: string, blacklisted: boolean) => void;
  onToggleVendorBlacklist: (vendorId: string, blacklisted: boolean) => void;
  onUpdateAdminUserForm: (field: keyof AdminUserFormState, value: string | boolean) => void;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  retryingDailyReportUploadKey: string;
  savingAdminUser: boolean;
  syncLog: SyncLogEntry[];
  syncing: boolean;
  syncingAll: boolean;
  syncingNetSuiteVendors: boolean;
  syncSummary?: ProcoreSyncSummary;
  updatingProject: boolean;
}) {
  return (
    <details className="admin-tools-drawer">
      <summary>
        <span>Admin Tools</span>
        <span className="admin-tools-meta">Sync, users, controls</span>
      </summary>
      <div className="admin-tools-body">
        <div className="admin-tool-actions">
          <button className="secondary-button" disabled={syncing} onClick={onSyncNewProjects} type="button">
            <RefreshCw aria-hidden="true" size={18} />
            {syncing ? "Syncing..." : "Sync New Projects"}
          </button>
          <button className="secondary-button" disabled={syncingAll} onClick={onSyncAllProjects} type="button">
            <RefreshCw aria-hidden="true" size={18} />
            {syncingAll ? "Syncing All..." : "Sync All Projects"}
          </button>
          <button className="secondary-button" disabled={updatingProject} onClick={onAddOrUpdateProject} type="button">
            <RefreshCw aria-hidden="true" size={18} />
            {updatingProject ? "Updating..." : "Add/Update Project"}
          </button>
          <button className="secondary-button" disabled={entries.length === 0} onClick={onExportAllEntryDetails} type="button">
            <Download aria-hidden="true" size={18} />
            Export CSV
          </button>
          <button className="secondary-button" onClick={onConfigureProcoreUpload} type="button">
            <PlugZap aria-hidden="true" size={18} />
            Configure Procore Upload
          </button>
        </div>
        {syncSummary ? <SyncSummaryCard summary={syncSummary} /> : null}
        <SyncLogPanel entries={syncLog} />
        <AdminFailedUploadCenter
          onOpenDay={onOpenDailyEntry}
          onRetryDailyReport={onRetryDailyReportUpload}
          projects={allProjects}
          retryingDailyReportUploadKey={retryingDailyReportUploadKey}
        />
        <AdminAuditLogPanel projects={allProjects} users={adminUsers} />
        <AdminDataQualityPanel
          crewDirectory={crewDirectory}
          crewMembersByProject={crewMembersByProject}
          projectArchiveById={projectArchiveById}
          projectBlacklistById={projectBlacklistById}
          projects={allProjects}
          users={adminUsers}
          vendorBlacklistById={netSuiteVendorBlacklistById}
          vendors={allNetSuiteVendors}
        />
        <ProjectBlacklistPanel
          onToggleProject={onToggleProjectBlacklist}
          projectBlacklistById={projectBlacklistById}
          projects={allProjects}
        />
        <ProjectArchivePanel
          onToggleProject={onToggleProjectArchive}
          projectArchiveById={projectArchiveById}
          projects={allProjects}
        />
        <VendorBlacklistPanel
          onToggleVendor={onToggleVendorBlacklist}
          vendorBlacklistById={netSuiteVendorBlacklistById}
          vendors={allNetSuiteVendors}
        />
        <AdminUsersPanel
          currentUserId={currentUser.id}
          editingUserId={editingAdminUserId}
          form={adminUserForm}
          loading={loadingAdminUsers}
          netSuiteProjectManagerOptions={netSuiteProjectManagerOptions}
          notice={adminUsersNotice}
          onCancelEdit={onCancelAdminUserEdit}
          onCreatePasswordResetToken={onCreatePasswordResetToken}
          onEditUser={onEditUser}
          onRefresh={onRefreshUsers}
          onSaveUser={onSaveUser}
          onSetUserActive={onSetUserActive}
          onUpdateForm={onUpdateAdminUserForm}
          resetToken={adminPasswordResetToken}
          saving={savingAdminUser}
          users={adminUsers}
        />
        <AdminMaintenancePanel
          clearing={clearingStagingData}
          clearingProjectCache={clearingProjectCache}
          netSuiteVendorCount={allNetSuiteVendors.length}
          netSuiteVendorsSyncedAt={netSuiteVendorsSyncedAt}
          notice={adminMaintenanceNotice}
          onClearProjectCache={onClearProjectCache}
          onClearStagingData={onClearStagingData}
          onSyncNetSuiteVendors={onSyncNetSuiteVendors}
          syncingNetSuiteVendors={syncingNetSuiteVendors}
        />
      </div>
    </details>
  );
}

function AdminDataQualityPanel({
  crewDirectory,
  crewMembersByProject,
  projectArchiveById,
  projectBlacklistById,
  projects,
  users,
  vendorBlacklistById,
  vendors
}: {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
  users: ManagedAppUser[];
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const issues = buildDataQualityIssues({
    crewDirectory,
    crewMembersByProject,
    projectArchiveById,
    projectBlacklistById,
    projects,
    users,
    vendorBlacklistById,
    vendors
  });
  const archivedProjectCount = projects.filter((project) => projectArchiveById[project.id]).length;
  const blacklistedProjectCount = projects.filter((project) => projectBlacklistById[project.id]).length;
  const visibleProjectCount = projects.length - archivedProjectCount - blacklistedProjectCount;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <details className="data-quality-panel" open>
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Data Quality ({errorCount} critical, {warningCount} review)
      </summary>
      <div className="data-quality-body">
        <div className="data-quality-metrics">
          <div>
            <span>Visible jobs</span>
            <strong>{visibleProjectCount}</strong>
          </div>
          <div>
            <span>Archived</span>
            <strong>{archivedProjectCount}</strong>
          </div>
          <div>
            <span>Blacklisted</span>
            <strong>{blacklistedProjectCount}</strong>
          </div>
          <div>
            <span>Crew records</span>
            <strong>{crewDirectory.length}</strong>
          </div>
        </div>
        {issues.length === 0 ? (
          <div className="success-alert">No data quality issues found in the cached app data.</div>
        ) : (
          <div className="data-quality-list">
            {issues.map((issue) => (
              <div className={`data-quality-issue ${issue.severity}`} key={issue.id}>
                <strong>{issue.title}</strong>
                <span>{issue.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function SyncSummaryCard({ summary }: { summary: ProcoreSyncSummary }) {
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
          Inactive NetSuite jobs: {inactiveNetSuiteProjects}. Auto-archived {autoArchivedProjects} cached project
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

function SyncLogPanel({ entries }: { entries: SyncLogEntry[] }) {
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
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
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

function AdminFailedUploadCenter({
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

function AdminAuditLogPanel({ projects, users }: { projects: Project[]; users: ManagedAppUser[] }) {
  const [filters, setFilters] = useState<AuditLogFilters>(() => createEmptyAuditLogFilters());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const sortedProjects = useMemo(() => sortProjectsByName(projects), [projects]);
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)) || a.id.localeCompare(b.id)),
    [users]
  );

  async function refreshAuditLog(nextFilters = filters) {
    setLoading(true);
    setNotice("");

    try {
      const data = await loadAdminAuditLog(nextFilters);

      if (!data.databaseConfigured) {
        setNotice("Audit log viewer requires the production database.");
        setAuditLog([]);
        return;
      }

      setAuditLog(data.auditLog ?? []);
      setLoaded(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load audit log.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(field: keyof AuditLogFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  function clearFilters() {
    const emptyFilters = createEmptyAuditLogFilters();

    setFilters(emptyFilters);
    void refreshAuditLog(emptyFilters);
  }

  return (
    <details
      className="admin-audit-log"
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) {
          void refreshAuditLog();
        }
      }}
    >
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Audit Log {loaded ? `(${auditLog.length})` : ""}
      </summary>
      <div className="admin-audit-body">
        <div className="admin-audit-filters">
          <label>
            User
            <select value={filters.actorUserId} onChange={(event) => updateFilter("actorUserId", event.target.value)}>
              <option value="">All users</option>
              {sortedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserName(user)} ({user.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Job
            <select value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
              <option value="">All jobs</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("action", event.target.value)}
              placeholder="sync, upload, user..."
              value={filters.action}
            />
          </label>
          <label>
            Target Type
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("targetType", event.target.value)}
              placeholder="project, user..."
              value={filters.targetType}
            />
          </label>
          <label>
            Target ID
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("targetId", event.target.value)}
              placeholder="Exact target ID"
              value={filters.targetId}
            />
          </label>
          <label>
            Start
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("startDate", event.target.value)}
              type="date"
              value={filters.startDate}
            />
          </label>
          <label>
            End
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("endDate", event.target.value)}
              type="date"
              value={filters.endDate}
            />
          </label>
          <label>
            Limit
            <select value={filters.limit} onChange={(event) => updateFilter("limit", event.target.value)}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </label>
        </div>
        <div className="admin-panel-toolbar">
          <span>Use filters before refreshing to keep the audit query narrow.</span>
          <div className="admin-panel-actions">
            <button className="secondary-button compact-button" disabled={loading} onClick={clearFilters} type="button">
              Clear
            </button>
            <button className="primary-button compact-button" disabled={loading} onClick={() => refreshAuditLog()} type="button">
              <RefreshCw aria-hidden="true" size={14} />
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
        {notice ? <div className="inline-alert">{notice}</div> : null}
        {!loading && loaded && auditLog.length === 0 ? <div className="field-note">No audit log entries match the filters.</div> : null}
        {auditLog.length > 0 ? (
          <div className="audit-log-list">
            {auditLog.map((entry) => (
              <div className="audit-log-row" key={entry.id}>
                <div className="audit-log-main">
                  <strong>{entry.action}</strong>
                  <span>{entry.createdAt ? formatStatusDateTime(entry.createdAt) : "Unknown time"}</span>
                </div>
                <div className="audit-log-meta">
                  <span>
                    Actor: {entry.actorName || entry.actorUserId || "system"}
                    {entry.actorRole ? ` (${entry.actorRole})` : ""}
                  </span>
                  <span>
                    Target: {entry.targetType || "unknown"}
                    {entry.targetId ? ` ${entry.targetId}` : ""}
                  </span>
                </div>
                <small>{formatAuditMetadata(entry.metadata)}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ProjectBlacklistPanel({
  onToggleProject,
  projectBlacklistById,
  projects
}: {
  onToggleProject: (projectId: string, blacklisted: boolean) => void;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
}) {
  const sortedProjects = sortProjectsByName(projects);
  const blacklistedProjectCount = sortedProjects.filter((project) => projectBlacklistById[project.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Project Blacklist ({blacklistedProjectCount})
      </summary>
      {sortedProjects.length === 0 ? (
        <div className="field-note">No cached projects are available to blacklist yet.</div>
      ) : (
        <>
          <div className="field-note">Blacklisted projects stay cached, but are hidden from entry screens and reports.</div>
          <div className="project-blacklist-list">
            {sortedProjects.map((project) => (
              <label className="project-blacklist-row" key={project.id}>
                <input
                  checked={Boolean(projectBlacklistById[project.id])}
                  onChange={(event) => onToggleProject(project.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

function ProjectArchivePanel({
  onToggleProject,
  projectArchiveById,
  projects
}: {
  onToggleProject: (projectId: string, archived: boolean) => void;
  projectArchiveById: ProjectArchiveById;
  projects: Project[];
}) {
  const sortedProjects = sortProjectsByName(projects);
  const archivedProjectCount = sortedProjects.filter((project) => projectArchiveById[project.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <Archive aria-hidden="true" size={16} />
        Project Archive ({archivedProjectCount})
      </summary>
      {sortedProjects.length === 0 ? (
        <div className="field-note">No cached projects are available to archive yet.</div>
      ) : (
        <>
          <div className="field-note">
            Archived projects stay cached and keep their history, but are hidden from normal entry screens and reports.
          </div>
          <div className="project-blacklist-list">
            {sortedProjects.map((project) => (
              <label className="project-blacklist-row" key={project.id}>
                <input
                  checked={Boolean(projectArchiveById[project.id])}
                  onChange={(event) => onToggleProject(project.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

function VendorBlacklistPanel({
  onToggleVendor,
  vendorBlacklistById,
  vendors
}: {
  onToggleVendor: (vendorId: string, blacklisted: boolean) => void;
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const [searchText, setSearchText] = useState("");
  const sortedVendors = sortNetSuiteVendors(vendors);
  const visibleVendors = filterNetSuiteVendors(sortedVendors, searchText);
  const blacklistedVendorCount = sortedVendors.filter((vendor) => vendorBlacklistById[vendor.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Vendor Blacklist ({blacklistedVendorCount})
      </summary>
      {sortedVendors.length === 0 ? (
        <div className="field-note">No cached NetSuite vendors are available to blacklist yet.</div>
      ) : (
        <>
          <div className="field-note">Blacklisted vendors stay cached, but are hidden from subcontractor assignment.</div>
          <input
            className="compact-search-input"
            placeholder="Search vendors"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="project-blacklist-list">
            {visibleVendors.length === 0 ? (
              <div className="field-note">No vendors match that search.</div>
            ) : (
              visibleVendors.map((vendor) => (
                <label className="project-blacklist-row" key={vendor.id}>
                  <input
                    checked={Boolean(vendorBlacklistById[vendor.id])}
                    onChange={(event) => onToggleVendor(vendor.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{formatNetSuiteVendorOption(vendor)}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </details>
  );
}

function AdminUsersPanel({
  currentUserId,
  editingUserId,
  form,
  loading,
  netSuiteProjectManagerOptions,
  notice,
  onCancelEdit,
  onCreatePasswordResetToken,
  onEditUser,
  onRefresh,
  onSaveUser,
  onSetUserActive,
  onUpdateForm,
  resetToken,
  saving,
  users
}: {
  currentUserId: string;
  editingUserId: string;
  form: AdminUserFormState;
  loading: boolean;
  netSuiteProjectManagerOptions: NetSuiteProjectManagerOption[];
  notice: string;
  onCancelEdit: () => void;
  onCreatePasswordResetToken: (user: ManagedAppUser) => void;
  onEditUser: (user: ManagedAppUser) => void;
  onRefresh: () => void;
  onSaveUser: () => void;
  onSetUserActive: (user: ManagedAppUser, active: boolean) => void;
  onUpdateForm: (field: keyof AdminUserFormState, value: string | boolean) => void;
  resetToken: PasswordResetResponse | null;
  saving: boolean;
  users: ManagedAppUser[];
}) {
  const activeUserCount = users.filter((user) => user.active).length;
  const projectManagerOptions = mergeNetSuiteProjectManagerOptions(netSuiteProjectManagerOptions, {
    id: form.netSuiteProjectManagerId,
    name: form.netSuiteProjectManagerName
  });

  return (
    <details className="admin-users">
      <summary>
        <Users aria-hidden="true" size={16} />
        Users ({activeUserCount}/{users.length})
      </summary>
      <div className="admin-users-body">
        {notice ? <div className={notice.toLowerCase().includes("unable") || notice.toLowerCase().includes("requires") ? "inline-alert" : "success-alert"}>{notice}</div> : null}
        {resetToken?.token ? (
          <div className="password-reset-code-panel">
            <span>One-time reset code for {resetToken.userId}</span>
            <strong>{resetToken.token}</strong>
            <small>Give this code to the user. It expires {resetToken.expiresAt ? new Date(resetToken.expiresAt).toLocaleString() : "in 24 hours"}.</small>
          </div>
        ) : null}
        <div className="admin-user-form">
          <div className="field-group">
            <label htmlFor="admin-user-id">User ID</label>
            <input
              disabled={Boolean(editingUserId) || saving}
              id="admin-user-id"
              onChange={(event) => onUpdateForm("userId", event.target.value)}
              placeholder="jdoe"
              value={form.userId}
            />
          </div>
          <div className="admin-user-name-grid">
            <div className="field-group">
              <label htmlFor="admin-user-first-name">First Name</label>
              <input
                disabled={saving}
                id="admin-user-first-name"
                onChange={(event) => onUpdateForm("firstName", event.target.value)}
                value={form.firstName}
              />
            </div>
            <div className="field-group">
              <label htmlFor="admin-user-last-name">Last Name</label>
              <input
                disabled={saving}
                id="admin-user-last-name"
                onChange={(event) => onUpdateForm("lastName", event.target.value)}
                value={form.lastName}
              />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="admin-user-role">Role</label>
            <select
              disabled={saving || form.userId === currentUserId}
              id="admin-user-role"
              onChange={(event) => {
                const role = event.target.value as AuthUser["role"];
                onUpdateForm("role", role);

                if (role !== "project_manager") {
                  onUpdateForm("netSuiteProjectManagerId", "");
                  onUpdateForm("netSuiteProjectManagerName", "");
                }
              }}
              value={form.role}
            >
              <option value="standard">Field</option>
              <option value="project_manager">Project Manager</option>
              <option value="executive">Executive</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === "project_manager" ? (
            <div className="field-group">
              <label htmlFor="admin-user-netsuite-pm">NetSuite Project Manager</label>
              <select
                disabled={saving}
                id="admin-user-netsuite-pm"
                onChange={(event) => {
                  const selectedOption = projectManagerOptions.find((option) => option.id === event.target.value);

                  onUpdateForm("netSuiteProjectManagerId", selectedOption?.id ?? "");
                  onUpdateForm("netSuiteProjectManagerName", selectedOption?.name ?? "");
                }}
                value={form.netSuiteProjectManagerId}
              >
                <option value="">No NetSuite PM mapping</option>
                {projectManagerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <div className="field-note">Used to default this PM&apos;s My Projects from NetSuite project records.</div>
            </div>
          ) : null}
          <div className="field-group">
            <label htmlFor="admin-user-password">{editingUserId ? "New Password" : "Temporary Password"}</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="admin-user-password"
              onChange={(event) => onUpdateForm("password", event.target.value)}
              placeholder={editingUserId ? "Leave blank to keep current password" : ""}
              type="password"
              value={form.password}
            />
          </div>
          <label className="compact-check-row">
            <input
              checked={form.active}
              disabled={saving || form.userId === currentUserId}
              onChange={(event) => onUpdateForm("active", event.target.checked)}
              type="checkbox"
            />
            <span>Active account</span>
          </label>
          <div className="admin-user-actions">
            <button className="primary-button" disabled={saving} onClick={onSaveUser} type="button">
              <Save aria-hidden="true" size={16} />
              {saving ? "Saving..." : editingUserId ? "Save user" : "Create user"}
            </button>
            {editingUserId ? (
              <button className="secondary-button" disabled={saving} onClick={onCancelEdit} type="button">
                <X aria-hidden="true" size={16} />
                Cancel
              </button>
            ) : null}
            <button className="secondary-button" disabled={loading || saving} onClick={onRefresh} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="field-note">No database users loaded yet.</div>
        ) : (
          <div className="admin-user-list">
            {users.map((user) => (
              <div className={user.active ? "admin-user-row" : "admin-user-row inactive"} key={user.id}>
                <div className="admin-user-row-main">
                  <strong>{formatUserName(user)}</strong>
                  <span>
                    {user.id} - {formatRole(user.role)}
                    {user.role === "project_manager" && user.netSuiteProjectManagerName
                      ? ` - NetSuite PM: ${user.netSuiteProjectManagerName}`
                      : ""}
                  </span>
                </div>
                <div className="admin-user-row-actions">
                  <button className="icon-button" onClick={() => onEditUser(user)} title="Edit user" type="button">
                    <Edit3 aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving || !user.active}
                    onClick={() => onCreatePasswordResetToken(user)}
                    title="Create password reset code"
                    type="button"
                  >
                    <KeyRound aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving || user.id === currentUserId}
                    onClick={() => onSetUserActive(user, !user.active)}
                    title={user.active ? "Deactivate user" : "Reactivate user"}
                    type="button"
                  >
                    {user.active ? <X aria-hidden="true" size={16} /> : <UserPlus aria-hidden="true" size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function AdminMaintenancePanel({
  clearing,
  clearingProjectCache,
  netSuiteVendorCount,
  netSuiteVendorsSyncedAt,
  notice,
  onClearProjectCache,
  onClearStagingData,
  onSyncNetSuiteVendors,
  syncingNetSuiteVendors
}: {
  clearing: boolean;
  clearingProjectCache: boolean;
  netSuiteVendorCount: number;
  netSuiteVendorsSyncedAt: string | null;
  notice: { message: string; status: "success" | "error" } | null;
  onClearProjectCache: () => void;
  onClearStagingData: () => void;
  onSyncNetSuiteVendors: () => void;
  syncingNetSuiteVendors: boolean;
}) {
  return (
    <details className="admin-maintenance">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Admin Tools
      </summary>
      <div className="admin-maintenance-body">
        {notice ? <div className={notice.status === "error" ? "inline-alert" : "success-alert"}>{notice.message}</div> : null}
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
          cached jobs/pay items, sync log, project blacklist, and My Projects.
        </p>
        <button className="secondary-button admin-clear-button" disabled={clearing} onClick={onClearStagingData} type="button">
          <Trash2 aria-hidden="true" size={16} />
          {clearing ? "Clearing..." : "Clear staging daily data"}
        </button>
        <p className="field-note">
          Clears only cached jobs/pay items and the old project cache fallback. Use this before the first NetSuite sync.
        </p>
        <button
          className="secondary-button admin-clear-button"
          disabled={clearingProjectCache}
          onClick={onClearProjectCache}
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          {clearingProjectCache ? "Clearing..." : "Clear cached jobs/pay items"}
        </button>
      </div>
    </details>
  );
}

function buildDataQualityIssues({
  crewDirectory,
  projectArchiveById,
  projectBlacklistById,
  projects,
  users
}: {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
  users: ManagedAppUser[];
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const issues: DataQualityIssue[] = [];
  const visibleProjects = projects.filter((project) => !projectArchiveById[project.id] && !projectBlacklistById[project.id]);
  const duplicateProjectNames = findDuplicateValues(visibleProjects.map((project) => project.name));
  const noPayItemProjects = visibleProjects.filter((project) => !isTwoSeriesProject(project) && project.payItems.length === 0);
  const missingProjectManagerProjects = visibleProjects.filter((project) => !project.netSuiteProjectManagerId);
  const duplicatePayItemProjects = visibleProjects.flatMap((project) => {
    const duplicateCodes = findDuplicateValues(project.payItems.map((payItem) => payItem.code));

    return duplicateCodes.map((code) => `${project.name}: ${code}`);
  });
  const duplicateCrewNames = findDuplicateValues(
    crewDirectory.map((member) =>
      member.laborType === "subcontractor" ? `Subcontractor: ${getCrewDisplayName(member)}` : member.name
    )
  );
  const subcontractorsMissingVendor = crewDirectory.filter(
    (member) => member.laborType === "subcontractor" && !member.netSuiteVendorId
  );
  const pmUsersWithoutMapping = users.filter(
    (user) => user.role === "project_manager" && user.active !== false && !user.netSuiteProjectManagerId
  );

  if (noPayItemProjects.length > 0) {
    issues.push({
      detail: `${noPayItemProjects.length} Signal project${noPayItemProjects.length === 1 ? "" : "s"} have no pay items. Examples: ${formatDataQualitySamples(noPayItemProjects.map((project) => project.name))}.`,
      id: "projects-without-pay-items",
      severity: "error",
      title: "Projects without pay items"
    });
  }

  if (duplicateProjectNames.length > 0) {
    issues.push({
      detail: `Duplicate visible project names can make reporting hard to interpret. Examples: ${formatDataQualitySamples(duplicateProjectNames)}.`,
      id: "duplicate-project-names",
      severity: "warning",
      title: "Duplicate project names"
    });
  }

  if (missingProjectManagerProjects.length > 0) {
    issues.push({
      detail: `${missingProjectManagerProjects.length} visible project${missingProjectManagerProjects.length === 1 ? "" : "s"} are missing a NetSuite Project Manager value. Examples: ${formatDataQualitySamples(missingProjectManagerProjects.map((project) => project.name))}.`,
      id: "missing-project-manager",
      severity: "warning",
      title: "Missing PM mapping on projects"
    });
  }

  if (duplicatePayItemProjects.length > 0) {
    issues.push({
      detail: `Duplicate pay item codes were found after sync. Examples: ${formatDataQualitySamples(duplicatePayItemProjects)}.`,
      id: "duplicate-pay-items",
      severity: "warning",
      title: "Duplicate pay item codes"
    });
  }

  if (duplicateCrewNames.length > 0) {
    issues.push({
      detail: `Duplicate crew/subcontractor names can split reporting. Examples: ${formatDataQualitySamples(duplicateCrewNames)}.`,
      id: "duplicate-crew-names",
      severity: "warning",
      title: "Possible duplicate crew records"
    });
  }

  if (subcontractorsMissingVendor.length > 0) {
    issues.push({
      detail: `${subcontractorsMissingVendor.length} subcontractor record${subcontractorsMissingVendor.length === 1 ? "" : "s"} were not tied to a NetSuite vendor. Examples: ${formatDataQualitySamples(subcontractorsMissingVendor.map(getCrewDisplayName))}.`,
      id: "subcontractors-missing-vendor",
      severity: "warning",
      title: "Subcontractors not tied to NetSuite vendors"
    });
  }

  if (pmUsersWithoutMapping.length > 0) {
    issues.push({
      detail: `${pmUsersWithoutMapping.length} active PM user${pmUsersWithoutMapping.length === 1 ? "" : "s"} do not have a NetSuite Project Manager connection. Examples: ${formatDataQualitySamples(pmUsersWithoutMapping.map(formatUserName))}.`,
      id: "pm-users-without-mapping",
      severity: "warning",
      title: "PM users missing NetSuite PM connection"
    });
  }

  if (projects.length === 0) {
    issues.push({
      detail: "No cached projects are available. Run Sync New Projects, Sync All Projects, or Add/Update Project.",
      id: "no-cached-projects",
      severity: "info",
      title: "No cached projects"
    });
  }

  return issues;
}

function findDuplicateValues(values: string[]) {
  const counts = new Map<string, { count: number; label: string }>();

  for (const value of values) {
    const label = value.trim();
    const key = normalizeCrewName(label);

    if (!key) {
      continue;
    }

    const current = counts.get(key);

    counts.set(key, {
      count: (current?.count ?? 0) + 1,
      label: current?.label ?? label
    });
  }

  return Array.from(counts.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.label)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

function formatDataQualitySamples(values: string[], maxItems = 4) {
  const samples = values.slice(0, maxItems);
  const remainingCount = values.length - samples.length;

  return `${samples.join(", ")}${remainingCount > 0 ? `, +${remainingCount} more` : ""}`;
}

function getSyncFailedProjects(summary: Partial<ProcoreSyncSummary> | undefined) {
  return Array.isArray(summary?.failedProjects) ? summary.failedProjects.map(readTextValue).filter(Boolean) : [];
}

function hasSyncWarnings(summary: ProcoreSyncSummary | undefined) {
  return Boolean(
    summary &&
      (summary.failed > 0 || (summary.remainingNewProjects ?? 0) > 0 || (summary.autoArchivedProjects ?? 0) > 0)
  );
}

function formatSyncSummaryLine(summary: ProcoreSyncSummary) {
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

function createEmptyAuditLogFilters(): AuditLogFilters {
  return {
    action: "",
    actorUserId: "",
    endDate: "",
    limit: "200",
    projectId: "",
    startDate: "",
    targetId: "",
    targetType: ""
  };
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

async function loadAdminAuditLog(filters: AuditLogFilters) {
  const params = new URLSearchParams();

  params.set("limit", filters.limit || "200");

  for (const [key, value] of Object.entries(filters)) {
    if (key === "limit") {
      continue;
    }

    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  const response = await fetch(`/api/admin/audit-log?${params.toString()}`, {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as AuditLogResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load audit log.");
  }

  return data;
}

function mergeNetSuiteProjectManagerOptions(
  options: NetSuiteProjectManagerOption[],
  selectedOption: NetSuiteProjectManagerOption
) {
  if (!selectedOption.id || options.some((option) => option.id === selectedOption.id)) {
    return options;
  }

  return [...options, selectedOption].sort((left, right) => left.name.localeCompare(right.name));
}

function filterNetSuiteVendors(vendors: NetSuiteVendor[], searchText: string) {
  const normalizedSearchText = normalizeVendorSearchText(searchText);

  if (!normalizedSearchText) {
    return sortNetSuiteVendors(vendors);
  }

  return sortNetSuiteVendors(
    vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.entityId ?? "",
        vendor.companyName ?? "",
        vendor.defaultAddress,
        formatNetSuiteVendorOption(vendor)
      ].some((value) => normalizeVendorSearchText(value).includes(normalizedSearchText))
    )
  );
}

function sortNetSuiteVendors(vendors: NetSuiteVendor[]) {
  return [...vendors].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
      (left.entityId ?? "").localeCompare(right.entityId ?? "", undefined, { numeric: true, sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
  );
}

function formatNetSuiteVendorOption(vendor: NetSuiteVendor) {
  return vendor.entityId && vendor.entityId !== vendor.name ? `${vendor.name} (${vendor.entityId})` : vendor.name;
}

function sortProjectsByName(projects: Project[]) {
  return [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function formatAuditMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length === 0) {
    return "No extra metadata.";
  }

  return entries
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${formatAuditMetadataValue(value)}`)
    .join(" | ");
}

function formatAuditMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatAuditMetadataValue).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatUserName(user: AuthUser) {
  return `${user.firstName} ${user.lastName}`;
}

function formatRole(role: AuthUser["role"]) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "project_manager") {
    return "Project Manager";
  }

  if (role === "executive") {
    return "Executive";
  }

  return "Field";
}

function getCrewDisplayName(member: CrewMember) {
  return member.laborType === "subcontractor" ? member.subcontractorCompany || member.name : member.name;
}

function normalizeCrewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeVendorSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function readTextValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
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
