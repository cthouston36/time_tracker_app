"use client";

import {
  Download,
  Edit3,
  KeyRound,
  ListChecks,
  PlugZap,
  RefreshCw,
  Save,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { AdminAuditLogPanel } from "@/features/time-allocation/components/admin/admin-audit-log-panel";
import {
  ProjectArchivePanel,
  ProjectBlacklistPanel,
  VendorBlacklistPanel
} from "@/features/time-allocation/components/admin/admin-catalog-control-panels";
import { AdminFailedUploadCenter } from "@/features/time-allocation/components/admin/admin-failed-upload-center";
import { AdminMaintenancePanel } from "@/features/time-allocation/components/admin/admin-data-maintenance-panel";
import { SyncLogPanel, SyncSummaryCard } from "@/features/time-allocation/components/admin/admin-sync-log-panel";
import {
  formatRole,
  formatUserName,
  type AdminUserFormState,
  type PasswordResetResponse
} from "@/features/time-allocation/lib/auth-ui-helpers";
import type {
  CrewMember,
  CrewMembersByProject,
  ManagedAppUser,
  NetSuiteProjectManagerOption,
  NetSuiteVendor,
  ProjectSyncSummary,
  ProjectArchiveById,
  ProjectBlacklistById,
  SyncLogEntry,
  VendorBlacklistById
} from "@/features/time-allocation/types";

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
  clearingProjectCatalog,
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
  onClearProjectCatalog,
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
  clearingProjectCatalog: boolean;
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
  onClearProjectCatalog: () => void;
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
  syncSummary?: ProjectSyncSummary;
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
          clearingProjectCatalog={clearingProjectCatalog}
          netSuiteVendorCount={allNetSuiteVendors.length}
          netSuiteVendorsSyncedAt={netSuiteVendorsSyncedAt}
          notice={adminMaintenanceNotice}
          onClearProjectCatalog={onClearProjectCatalog}
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
      detail: "No project catalog jobs are available. Run Sync New Projects, Sync All Projects, or Add/Update Project.",
      id: "no-cached-projects",
      severity: "info",
      title: "No project catalog jobs"
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

function mergeNetSuiteProjectManagerOptions(
  options: NetSuiteProjectManagerOption[],
  selectedOption: NetSuiteProjectManagerOption
) {
  if (!selectedOption.id || options.some((option) => option.id === selectedOption.id)) {
    return options;
  }

  return [...options, selectedOption].sort((left, right) => left.name.localeCompare(right.name));
}

function getCrewDisplayName(member: CrewMember) {
  return member.laborType === "subcontractor" ? member.subcontractorCompany || member.name : member.name;
}

function normalizeCrewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
