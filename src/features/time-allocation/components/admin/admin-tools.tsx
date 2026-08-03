"use client";

import {
  Download,
  PlugZap,
  RefreshCw
} from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { AdminAuditLogPanel } from "@/features/time-allocation/components/admin/admin-audit-log-panel";
import {
  ProjectArchivePanel,
  ProjectBlacklistPanel,
  VendorBlacklistPanel
} from "@/features/time-allocation/components/admin/admin-catalog-control-panels";
import { AdminDataQualityPanel } from "@/features/time-allocation/components/admin/admin-data-quality-panel";
import { AdminFailedUploadCenter } from "@/features/time-allocation/components/admin/admin-failed-upload-center";
import { AdminMaintenancePanel } from "@/features/time-allocation/components/admin/admin-data-maintenance-panel";
import { AdminUsersPanel } from "@/features/time-allocation/components/admin/admin-users-panel";
import { SyncLogPanel, SyncSummaryCard } from "@/features/time-allocation/components/admin/admin-sync-log-panel";
import {
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
