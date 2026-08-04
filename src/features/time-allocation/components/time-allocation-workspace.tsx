"use client";

import { useCallback, useRef, useState } from "react";
import {
  CalendarDays,
  Edit3,
  ExternalLink
} from "lucide-react";
import { todayInputValue } from "@/lib/date";
import { canAccessReports } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import {
  AppLoadingShell,
  PageHeader
} from "@/features/time-allocation/components/workspace-primitives";
import { DailyStatusStrip } from "@/features/time-allocation/components/daily-status-strip";
import { ChangePasswordModal } from "@/features/time-allocation/components/change-password-modal";
import { AuthShell } from "@/features/time-allocation/components/auth-shell";
import { JobSetupSidebar } from "@/features/time-allocation/components/job-setup-sidebar";
import { WorkspaceHeader } from "@/features/time-allocation/components/workspace-header";
import {
  MobileInstallPrompt,
  NetworkStatusBanner
} from "@/features/time-allocation/components/status-banners";
import { ReportsView } from "@/features/time-allocation/components/reports/reports-view";
import { DailyReportModal } from "@/features/time-allocation/components/daily-report/daily-report-ui";
import { DashboardView } from "@/features/time-allocation/components/dashboard/dashboard-view";
import { PayItemEntryPanel } from "@/features/time-allocation/components/entry/pay-item-entry-panel";
import { MatrixFullscreenModal } from "@/features/time-allocation/components/entry/matrix-fullscreen-modal";
import { DailyWrapUpSection } from "@/features/time-allocation/components/entry/daily-wrap-up-section";
import { ReviewSubmitPanel } from "@/features/time-allocation/components/entry/review-submit-panel";
import { type ViewMode } from "@/features/time-allocation/lib/client-storage";
import {
  formatDate,
  getWeekStart
} from "@/features/time-allocation/lib/date-helpers";
import { getProjectWorkTypeLabel } from "@/features/time-allocation/lib/status-helpers";
import { getDefaultViewModeForUser } from "@/features/time-allocation/lib/auth-ui-helpers";
import {
  draftHasAnyInput,
} from "@/features/time-allocation/lib/crew-entry-helpers";
import type {
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  DraftsByPayItem,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById
} from "@/features/time-allocation/types";
import { useNetworkStatus } from "@/features/time-allocation/hooks/use-network-status";
import { useAdminMaintenanceActions } from "@/features/time-allocation/hooks/use-admin-maintenance-actions";
import { useAdminUserManagement } from "@/features/time-allocation/hooks/use-admin-user-management";
import { useAuthForms } from "@/features/time-allocation/hooks/use-auth-forms";
import { useCrewManagement } from "@/features/time-allocation/hooks/use-crew-management";
import { useCurrentUserSessionBootstrap } from "@/features/time-allocation/hooks/use-current-user-session-bootstrap";
import { useDailyReports } from "@/features/time-allocation/hooks/use-daily-reports";
import { useEntryActions } from "@/features/time-allocation/hooks/use-entry-actions";
import { useEntryExportActions } from "@/features/time-allocation/hooks/use-entry-export-actions";
import { useEntryProjectSnapshotRepair } from "@/features/time-allocation/hooks/use-entry-project-snapshot-repair";
import { useConfirmationDialog } from "@/features/time-allocation/hooks/use-confirmation-dialog";
import { useFieldProjectAssignments } from "@/features/time-allocation/hooks/use-field-project-assignments";
import { useJobImages } from "@/features/time-allocation/hooks/use-job-images";
import { useLastSelectedProjectStorage } from "@/features/time-allocation/hooks/use-last-selected-project-storage";
import { useMobileInstallPrompt } from "@/features/time-allocation/hooks/use-mobile-install-prompt";
import { useMobilePayItemSelection } from "@/features/time-allocation/hooks/use-mobile-pay-item-selection";
import { useMyProjectsFilterDefault } from "@/features/time-allocation/hooks/use-my-projects-filter-default";
import { useNetSuiteVendors } from "@/features/time-allocation/hooks/use-netsuite-vendors";
import { usePayItemDraftActions } from "@/features/time-allocation/hooks/use-pay-item-draft-actions";
import { useProcoreConnectAction } from "@/features/time-allocation/hooks/use-procore-connect-action";
import { useProjectCatalogBootstrap } from "@/features/time-allocation/hooks/use-project-catalog-bootstrap";
import { useProjectControlActions } from "@/features/time-allocation/hooks/use-project-control-actions";
import { useProjectSelectionGuards } from "@/features/time-allocation/hooks/use-project-selection-guards";
import { useProjectSync } from "@/features/time-allocation/hooks/use-project-sync";
import { useRetiredViewRedirect } from "@/features/time-allocation/hooks/use-retired-view-redirect";
import { useSharedAppStateApplication } from "@/features/time-allocation/hooks/use-shared-app-state-application";
import { useSharedAppStatePersistence } from "@/features/time-allocation/hooks/use-shared-app-state-persistence";
import { useSelectedDaySummaries } from "@/features/time-allocation/hooks/use-selected-day-summaries";
import { useSyncLogStorage } from "@/features/time-allocation/hooks/use-sync-log-storage";
import { useUnsavedChangesWarning } from "@/features/time-allocation/hooks/use-unsaved-changes-warning";
import { useWorkspaceNavigationActions } from "@/features/time-allocation/hooks/use-workspace-navigation-actions";
import { useWorkspaceKeyboardShortcuts } from "@/features/time-allocation/hooks/use-workspace-keyboard-shortcuts";
import { useWorkspaceLogoutAction } from "@/features/time-allocation/hooks/use-workspace-logout-action";
import { useWorkspaceDerivedData } from "@/features/time-allocation/hooks/use-workspace-derived-data";
import { useWorkspaceReportScope } from "@/features/time-allocation/hooks/use-workspace-report-scope";
import { WeeklyStatusReport } from "@/features/time-allocation/components/dashboard/weekly-status-report";
import { AdminToolsDrawer } from "@/features/time-allocation/components/admin/admin-tools";
import type { AllocationEntry, Project } from "@/lib/domain/types";

export function TimeAllocationWorkspace() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [reportProjectId, setReportProjectId] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [calendarWeekStart, setCalendarWeekStart] = useState(getWeekStart(todayInputValue()));
  const [calendarProjectIds, setCalendarProjectIds] = useState<string[]>([]);
  const [calendarUseMyProjects, setCalendarUseMyProjects] = useState(true);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectArchiveById, setProjectArchiveById] = useState<ProjectArchiveById>({});
  const [projectBlacklistById, setProjectBlacklistById] = useState<ProjectBlacklistById>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(false);
  const [matrixFullscreenOpen, setMatrixFullscreenOpen] = useState(false);
  const [jobSetupCollapsed, setJobSetupCollapsed] = useState(false);
  const [jobSetupExpanded, setJobSetupExpanded] = useState(false);
  const [myProjectsEditorOpen, setMyProjectsEditorOpen] = useState(false);
  const [crewSetupExpanded, setCrewSetupExpanded] = useState(false);
  const [mobileSelectedPayItemId, setMobileSelectedPayItemId] = useState("");
  const [workDate, setWorkDate] = useState(todayInputValue());
  const [entries, setEntries] = useState<AllocationEntry[]>([]);
  const [daySubmissions, setDaySubmissions] = useState<DaySubmissionsByKey>({});
  const [dayEntryNotesByKey, setDayEntryNotesByKey] = useState<DayEntryNotesByKey>({});
  const [myJobsByUser, setMyJobsByUser] = useState<MyJobsByUser>({});
  const [draftsByPayItem, setDraftsByPayItem] = useState<DraftsByPayItem>({});
  const [connectionStatus, setConnectionStatus] = useState("Mock data active");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [entryNotice, setEntryNotice] = useState("");
  const networkStatus = useNetworkStatus();
  const userIsOffline = networkStatus.checked && !networkStatus.online;
  const mobileInstallPrompt = useMobileInstallPrompt(Boolean(currentUser));
  const resetDraftPayItems = useCallback(() => {
    setDraftsByPayItem({});
  }, []);
  const {
    addOrUpdateProject,
    addSyncLog,
    replaceSyncLog,
    resetProjectSyncState,
    setSyncedAt,
    syncAllProjects,
    syncing,
    syncingAll,
    syncLog,
    syncNewProjects,
    syncSummary,
    syncedAt,
    updatingProject
  } = useProjectSync({
    onConnectionStatus: setConnectionStatus,
    onDraftsReset: resetDraftPayItems,
    onProjectArchiveChange: setProjectArchiveById,
    onProjectLoadError: setProjectLoadError,
    onProjectsChange: setAllProjects,
    onSelectedProjectChange: setSelectedProjectId,
    projectArchiveById,
    projectBlacklistById,
    selectedProjectId,
    userIsOffline
  });
  const [appStateHydrated, setAppStateHydrated] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const payItemEntryPanelRef = useRef<HTMLDivElement>(null);
  const saveDailyReportRef = useRef<(() => Promise<void>) | null>(null);
  const saveAllocationEntriesRef = useRef<(() => Promise<void>) | null>(null);
  const stagingOperationalDataClearedRef = useRef<() => void>(() => {});
  const projectCatalogClearedRef = useRef<() => void>(() => {});
  const { confirmAction, confirmationDialog } = useConfirmationDialog();
  const {
    adminMaintenanceNotice,
    clearingProjectCatalog,
    clearingStagingData,
    clearProjectCatalogData,
    clearStagingOperationalData,
    setAdminMaintenanceNotice
  } = useAdminMaintenanceActions({
    confirmAction,
    currentUser,
    onProjectCatalogCleared: () => projectCatalogClearedRef.current(),
    onStagingOperationalDataCleared: () => stagingOperationalDataClearedRef.current(),
    userIsOffline
  });

  const handleLoginSuccess = useCallback((user: AuthUser) => {
    setCurrentUser(user);
    setViewMode(getDefaultViewModeForUser());
  }, []);
  const {
    changePasswordForm,
    changePasswordNotice,
    changePasswordOpen,
    changingPassword,
    closeChangePasswordModal,
    closePasswordReset,
    login,
    loginError,
    loginPassword,
    loginUserId,
    openChangePasswordModal,
    openPasswordReset,
    passwordResetForm,
    passwordResetNotice,
    passwordResetOpen,
    resettingPassword,
    resetAuthForms,
    setLoginPassword,
    setLoginUserId,
    submitChangePassword,
    submitPasswordReset,
    updateChangePasswordForm,
    updatePasswordResetForm
  } = useAuthForms({
    onLoginSuccess: handleLoginSuccess
  });

  const {
    currentDayEntryNotes,
    currentDayKey,
    currentDaySubmission,
    currentUserAutoMyJobIds,
    currentUserMyJobIds,
    dayIsSubmitted,
    displayedPayItems,
    draftEntryCount,
    jobPickerProjects,
    mobileSelectedPayItem,
    netSuiteProjectManagerOptions,
    projects,
    remainingQuantitiesByPayItem,
    selectedProject,
    selectedProjectUsesPayItems,
    selectedProjectUsesTwoSeriesDailyReport,
    visibleEntries
  } = useWorkspaceDerivedData({
    allProjects,
    currentUser,
    dayEntryNotesByKey,
    daySubmissions,
    draftsByPayItem,
    entries,
    mobileSelectedPayItemId,
    myJobsByUser,
    projectArchiveById,
    projectBlacklistById,
    selectedProjectId,
    showOnlyMyProjects,
    workDate
  });
  const {
    adminPasswordResetToken,
    adminUserForm,
    adminUsers,
    adminUsersNotice,
    createAdminPasswordResetToken,
    editingAdminUserId,
    loadAdminUsers,
    loadingAdminUsers,
    resetAdminUserForm,
    saveAdminUser,
    savingAdminUser,
    setAdminUserActive,
    startEditingAdminUser,
    updateAdminUserForm
  } = useAdminUserManagement({
    currentUser,
    netSuiteProjectManagerOptions
  });
  const {
    fieldAssignmentNotice,
    fieldUsers,
    saveFieldProjectAssignments,
    savingFieldAssignmentProjectId
  } = useFieldProjectAssignments({
    currentUser,
    setMyJobsByUser
  });
  const {
    allNetSuiteVendors,
    clearSubcontractorVendorSelection,
    filteredSubcontractorVendors,
    loadingNetSuiteVendors,
    netSuiteVendorBlacklistById,
    netSuiteVendors,
    netSuiteVendorsSyncedAt,
    selectSubcontractorVendor,
    selectedSubcontractorVendor,
    selectedSubcontractorVendorId,
    subcontractorVendorSearch,
    syncingNetSuiteVendors,
    syncNetSuiteVendorDirectory,
    toggleVendorBlacklist,
    updateSubcontractorVendorSearch
  } = useNetSuiteVendors({
    currentUser,
    onAdminMaintenanceNotice: setAdminMaintenanceNotice,
    onSyncLog: addSyncLog,
    userIsOffline
  });

  const {
    addCrewMember,
    addExistingCrewMemberToProject,
    addSubcontractorVendorToProject,
    cancelEditingCrewMember,
    clearCrewForms,
    crewDirectory,
    crewMemberJobTitle,
    crewMemberLaborType,
    crewMemberName,
    crewMembersByProject,
    editingCrewMember,
    existingCrewMemberOptions,
    mergeCrewMembers,
    mergeSourceCrewMemberId,
    mergeTargetCrewMemberId,
    removeCrewMember,
    replaceCrewData,
    resetCrewManagementState,
    saveEditedCrewMember,
    selectedExistingCrewMemberId,
    selectedProjectCrewMembers,
    setCrewMemberJobTitle,
    setCrewMemberLaborType,
    setCrewMemberName,
    setMergeSourceCrewMemberId,
    setMergeTargetCrewMemberId,
    setSelectedExistingCrewMemberId,
    startEditingCrewMember,
    updateEditingCrewMember
  } = useCrewManagement({
    clearSubcontractorVendorSelection,
    confirmAction,
    currentUser,
    entries,
    filteredSubcontractorVendors,
    selectedProject,
    selectedSubcontractorVendor,
    setDraftsByPayItem,
    setEntries,
    setEntryNotice
  });
  const {
    cancelEditingEntry,
    clearDraftInputs,
    deleteSubmittedDay,
    deletingSubmittedDay,
    editingEntry,
    removeEntry,
    removingEntryId,
    reopenSubmittedDay,
    reopeningDay,
    saveAllocationEntries,
    saveEditedEntry,
    savingEditedEntry,
    savingEntries,
    startEditingEntry,
    submitDay,
    submittingDay,
    updateEditingEntry
  } = useEntryActions({
    confirmAction,
    currentUser,
    dayIsSubmitted,
    daySubmissions,
    draftsByPayItem,
    entries,
    remainingQuantitiesByPayItem,
    selectedProject,
    selectedProjectCrewMembers,
    setDayEntryNotesByKey,
    setDaySubmissions,
    setDraftsByPayItem,
    setEntries,
    setEntryNotice,
    userIsOffline,
    visibleEntries,
    workDate
  });
  const {
    setCurrentUserMyJobIds,
    toggleProjectArchive,
    toggleProjectBlacklist
  } = useProjectControlActions({
    cancelEditingEntry,
    currentUser,
    projects,
    selectedProjectId,
    setDraftsByPayItem,
    setEntryNotice,
    setMobileSelectedPayItemId,
    setMyJobsByUser,
    setProjectArchiveById,
    setProjectBlacklistById,
    setProjectLoadError,
    setSelectedProjectId
  });
  const {
    clearDailyReportDraftForCurrentContext,
    closeDailyReportModal,
    copyPreviousDailyReportCrewTime,
    copySavedEntriesToDailyReportWorkRows,
    currentDailyReport,
    currentDailyReportProcoreStatus,
    dailyReportDraft,
    dailyReportDraftNotice,
    dailyReportModalOpen,
    dailyReportNeedsUpload,
    dailyReportUploadPending,
    dailyReportsByKey,
    dailyReportUploadNotice,
    dailyReportUploadRetryQueue,
    dailyReportUploadsByKey,
    downloadDailyReportPdf,
    downloadingDailyReportPdf,
    normalizeDailyReportEmployeeTimeDraft,
    openDailyReportModal,
    previousDailyReportCrewTime,
    replaceDailyReportData,
    resetDailyReportState,
    retryDailyReportUpload,
    retryingDailyReportUploadKey,
    saveDailyReport,
    setDailyReportUploadNotice,
    showDailyReportDetails,
    updateDailyReportDraft,
    updateDailyReportEmployeeDraft,
    updateDailyReportItsfmDraft,
    updateDailyReportPayItemDraft,
    uploadDailyReportToProcoreDocuments,
    uploadingDailyReport
  } = useDailyReports({
    confirmAction,
    currentDayEntryNotes,
    currentUser,
    dayEntryNotesByKey,
    projects,
    selectedProject,
    setEntryNotice,
    userIsOffline,
    visibleEntries,
    workDate
  });
  const {
    crewSummaryRows,
    selectedDayTotalHours,
    totalHours
  } = useSelectedDaySummaries({
    currentDailyReport,
    selectedProjectCrewMembers,
    selectedProjectUsesPayItems,
    visibleEntries
  });
  const { reportDailyReportsByKey, reportEntries } = useWorkspaceReportScope({
    dailyReportsByKey,
    entries,
    projects
  });
  const {
    addJobImages,
    clearJobImageQueue,
    clearUploadedJobImagesFromQueue,
    currentJobImageUploads,
    failedJobImageUploads,
    failedQueuedJobImages,
    jobImageDailyLimitReached,
    jobImageHistoryExpanded,
    jobImageInputRef,
    jobImageNotice,
    jobImageQueue,
    loadingJobImageUploads,
    queuedJobImages,
    removeJobImageFromQueue,
    retryFailedJobImages,
    setJobImageHistoryExpanded,
    showJobImageDetails,
    uploadedJobImageCount,
    uploadingJobImages,
    uploadQueuedJobImages,
    updateJobImageCaption
  } = useJobImages({
    currentDayKey,
    currentUser,
    selectedProject,
    userIsOffline,
    workDate
  });
  const scrollPayItemEntryPanelToTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      payItemEntryPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, []);
  const {
    splitDraftCrewHoursEvenly,
    toggleDraftCrewMember,
    updateDraft,
    updateDraftCrewHours
  } = usePayItemDraftActions({
    setDraftsByPayItem,
    setEntryNotice,
    visibleEntries
  });
  const { exportAllEntryDetails } = useEntryExportActions({
    dayEntryNotesByKey,
    daySubmissions,
    entries,
    projectBlacklistById,
    projects: allProjects
  });
  const hasUnsavedPayItemDrafts = Object.values(draftsByPayItem).some(draftHasAnyInput);
  const hasUnsavedChanges =
    hasUnsavedPayItemDrafts ||
    Boolean(editingEntry) ||
    Boolean(editingCrewMember) ||
    dailyReportModalOpen ||
    queuedJobImages.length > 0;
  const currentUserCanManageMyProjects = currentUser?.role === "admin";
  const clearInvalidProjectEntryState = useCallback(() => {
    setMobileSelectedPayItemId("");
    cancelEditingEntry();
    clearCrewForms();
    setDraftsByPayItem({});
  }, [cancelEditingEntry, clearCrewForms]);

  useProjectSelectionGuards({
    enabled: Boolean(currentUser),
    jobPickerProjects,
    onSelectionInvalid: clearInvalidProjectEntryState,
    projects,
    selectedProjectId,
    setSelectedProjectId
  });
  useMyProjectsFilterDefault({
    appStateHydrated,
    enabled: Boolean(currentUser),
    myProjectCount: currentUserMyJobIds.length,
    setShowOnlyMyProjects,
    showOnlyMyProjects,
    userId: currentUser?.id
  });
  useMobilePayItemSelection({
    displayedPayItems,
    mobileSelectedPayItemId,
    setMobileSelectedPayItemId
  });
  useRetiredViewRedirect({
    enabled: Boolean(currentUser),
    setViewMode,
    viewMode
  });
  useUnsavedChangesWarning(hasUnsavedChanges);
  const {
    changeSelectedProject,
    changeViewMode,
    changeWorkDate,
    confirmDiscardUnsavedChanges,
    openDailyEntry
  } = useWorkspaceNavigationActions({
    cancelEditingEntry,
    clearCrewForms,
    clearDailyReportDraftForCurrentContext,
    clearJobImageQueue,
    confirmAction,
    hasUnsavedChanges,
    projects,
    selectedProject,
    selectedProjectId,
    setDraftsByPayItem,
    setMobileSelectedPayItemId,
    setSelectedProjectId,
    setViewMode,
    setWorkDate,
    viewMode,
    workDate
  });
  const connectProcore = useProcoreConnectAction({
    confirmDiscardUnsavedChanges,
    mobileSelectedPayItemId,
    selectedProject,
    selectedProjectId,
    setProjectLoadError,
    userIsOffline,
    viewMode,
    workDate
  });

  stagingOperationalDataClearedRef.current = () => {
    setEntries([]);
    setDaySubmissions({});
    setDayEntryNotesByKey({});
    resetDailyReportState({ clearAutosaves: true });
    resetCrewManagementState();
    cancelEditingEntry();
    setDraftsByPayItem({});
    setEntryNotice("Staging daily entry, daily report, and crew data cleared.");
  };

  projectCatalogClearedRef.current = () => {
    setAllProjects([]);
    setSelectedProjectId("");
    resetProjectSyncState();
    setDraftsByPayItem({});
    setProjectLoadError("");
    setConnectionStatus("No project catalog data");
  };

  saveDailyReportRef.current = saveDailyReport;
  saveAllocationEntriesRef.current = saveAllocationEntries;

  useWorkspaceKeyboardShortcuts({
    dailyReportModalOpen,
    dayIsSubmitted,
    draftEntryCount,
    enabled: Boolean(currentUser),
    matrixFullscreenOpen,
    saveAllocationEntriesRef,
    saveDailyReportRef,
    savingEntries,
    selectedProjectUsesPayItems,
    setMatrixFullscreenOpen,
    viewMode
  });

  const { applySharedAppState } = useSharedAppStateApplication({
    onCrewDataReplace: replaceCrewData,
    onDailyReportDataReplace: replaceDailyReportData,
    onDayEntryNotesByKeyChange: setDayEntryNotesByKey,
    onDaySubmissionsChange: setDaySubmissions,
    onEntriesChange: setEntries,
    onMyJobsByUserChange: setMyJobsByUser,
    onProjectArchiveByIdChange: setProjectArchiveById,
    onProjectBlacklistByIdChange: setProjectBlacklistById,
    onSyncLogReplace: replaceSyncLog
  });

  useCurrentUserSessionBootstrap({
    onAuthCheckedChange: setAuthChecked,
    onCurrentUserChange: setCurrentUser
  });

  useProjectCatalogBootstrap({
    currentUser,
    onConnectionStatus: setConnectionStatus,
    onDailyReportUploadNotice: setDailyReportUploadNotice,
    onLoadingProjectsChange: setLoadingProjects,
    onMobileSelectedPayItemIdChange: setMobileSelectedPayItemId,
    onProjectLoadError: setProjectLoadError,
    onProjectsChange: setAllProjects,
    onSelectedProjectChange: setSelectedProjectId,
    onSyncedAtChange: setSyncedAt,
    onViewModeChange: setViewMode,
    onWorkDateChange: setWorkDate
  });

  useLastSelectedProjectStorage(currentUser?.id, selectedProjectId);

  useSharedAppStatePersistence({
    appStateHydrated,
    crewDirectory,
    crewMembersByProject,
    currentUser,
    dailyReportUploadsByKey,
    dailyReportsByKey,
    dayEntryNotesByKey,
    daySubmissions,
    entries,
    myJobsByUser,
    onAppStateHydratedChange: setAppStateHydrated,
    onApplySharedAppState: applySharedAppState,
    projectArchiveById,
    projectBlacklistById,
    syncLog
  });

  useEntryProjectSnapshotRepair({
    enabled: Boolean(currentUser),
    entries,
    projects,
    setEntries
  });

  useSyncLogStorage(Boolean(currentUser), syncLog);

  const { logout } = useWorkspaceLogoutAction({
    confirmDiscardUnsavedChanges,
    onAllProjectsChange: setAllProjects,
    onCrewSetupExpandedChange: setCrewSetupExpanded,
    onCurrentUserChange: setCurrentUser,
    onDayEntryNotesByKeyChange: setDayEntryNotesByKey,
    onDaySubmissionsChange: setDaySubmissions,
    onEntriesChange: setEntries,
    onMyJobsByUserChange: setMyJobsByUser,
    onMyProjectsEditorOpenChange: setMyProjectsEditorOpen,
    onProjectArchiveByIdChange: setProjectArchiveById,
    onProjectBlacklistByIdChange: setProjectBlacklistById,
    onSelectedProjectIdChange: setSelectedProjectId,
    onShowOnlyMyProjectsChange: setShowOnlyMyProjects,
    onViewModeChange: setViewMode,
    resetAuthForms,
    resetCrewManagementState,
    resetDailyReportState
  });

  if (!authChecked) {
    return <AppLoadingShell />;
  }

  if (!currentUser) {
    return (
      <AuthShell
        closePasswordReset={closePasswordReset}
        login={login}
        loginError={loginError}
        loginPassword={loginPassword}
        loginUserId={loginUserId}
        openPasswordReset={openPasswordReset}
        passwordResetForm={passwordResetForm}
        passwordResetNotice={passwordResetNotice}
        passwordResetOpen={passwordResetOpen}
        resettingPassword={resettingPassword}
        setLoginPassword={setLoginPassword}
        setLoginUserId={setLoginUserId}
        submitPasswordReset={submitPasswordReset}
        updatePasswordResetForm={updatePasswordResetForm}
      />
    );
  }

  const userCanAccessDashboard = true;

  const renderAdminToolsDrawer = () => (
    <AdminToolsDrawer
      adminMaintenanceNotice={adminMaintenanceNotice}
      adminPasswordResetToken={adminPasswordResetToken}
      adminUserForm={adminUserForm}
      adminUsers={adminUsers}
      adminUsersNotice={adminUsersNotice}
      allNetSuiteVendors={allNetSuiteVendors}
      allProjects={allProjects}
      clearingProjectCatalog={clearingProjectCatalog}
      clearingStagingData={clearingStagingData}
      crewDirectory={crewDirectory}
      crewMembersByProject={crewMembersByProject}
      currentUser={currentUser}
      editingAdminUserId={editingAdminUserId}
      entries={entries}
      loadingAdminUsers={loadingAdminUsers}
      netSuiteProjectManagerOptions={netSuiteProjectManagerOptions}
      netSuiteVendorBlacklistById={netSuiteVendorBlacklistById}
      netSuiteVendorsSyncedAt={netSuiteVendorsSyncedAt}
      onAddOrUpdateProject={addOrUpdateProject}
      onCancelAdminUserEdit={resetAdminUserForm}
      onClearProjectCatalog={clearProjectCatalogData}
      onClearStagingData={clearStagingOperationalData}
      onConfigureProcoreUpload={() => connectProcore("connect")}
      onCreatePasswordResetToken={createAdminPasswordResetToken}
      onEditUser={startEditingAdminUser}
      onExportAllEntryDetails={exportAllEntryDetails}
      onOpenDailyEntry={openDailyEntry}
      onRefreshUsers={loadAdminUsers}
      onRetryDailyReportUpload={retryDailyReportUpload}
      onSaveUser={saveAdminUser}
      onSetUserActive={setAdminUserActive}
      onSyncAllProjects={syncAllProjects}
      onSyncNetSuiteVendors={syncNetSuiteVendorDirectory}
      onSyncNewProjects={syncNewProjects}
      onToggleProjectArchive={toggleProjectArchive}
      onToggleProjectBlacklist={toggleProjectBlacklist}
      onToggleVendorBlacklist={toggleVendorBlacklist}
      onUpdateAdminUserForm={updateAdminUserForm}
      projectArchiveById={projectArchiveById}
      projectBlacklistById={projectBlacklistById}
      retryingDailyReportUploadKey={retryingDailyReportUploadKey}
      savingAdminUser={savingAdminUser}
      syncLog={syncLog}
      syncing={syncing}
      syncingAll={syncingAll}
      syncingNetSuiteVendors={syncingNetSuiteVendors}
      syncSummary={syncSummary ?? undefined}
      updatingProject={updatingProject}
    />
  );

  return (
    <main className="app-shell">
      <WorkspaceHeader
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        userCanAccessDashboard={userCanAccessDashboard}
        viewMode={viewMode}
        onChangePassword={openChangePasswordModal}
        onChangeViewMode={changeViewMode}
        onLogout={logout}
      />

      {changePasswordOpen ? (
        <ChangePasswordModal
          form={changePasswordForm}
          notice={changePasswordNotice}
          onClose={closeChangePasswordModal}
          onSubmit={submitChangePassword}
          onUpdateForm={updateChangePasswordForm}
          saving={changingPassword}
        />
      ) : null}

      {mobileInstallPrompt.visible ? (
        <MobileInstallPrompt onDismiss={mobileInstallPrompt.dismiss} />
      ) : null}

      <NetworkStatusBanner status={networkStatus} />

      {matrixFullscreenOpen && selectedProject && selectedProjectUsesPayItems ? (
        <MatrixFullscreenModal
          crewMembers={selectedProjectCrewMembers}
          dayIsSubmitted={dayIsSubmitted}
          draftEntryCount={draftEntryCount}
          draftsByPayItem={draftsByPayItem}
          entryNotice={entryNotice}
          payItems={displayedPayItems}
          project={selectedProject}
          remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
          savedEntries={visibleEntries}
          savingEntries={savingEntries}
          workDate={workDate}
          onClearDraftInputs={clearDraftInputs}
          onClose={() => setMatrixFullscreenOpen(false)}
          onCrewHoursChange={updateDraftCrewHours}
          onCrewToggle={toggleDraftCrewMember}
          onDraftChange={updateDraft}
          onSaveEntries={saveAllocationEntries}
          onSplitEvenly={splitDraftCrewHoursEvenly}
        />
      ) : null}

      <div
        className={[
          "workspace",
          viewMode !== "entry" ? "dashboard-workspace" : "",
          jobSetupCollapsed && viewMode === "entry" ? "job-setup-collapsed" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {viewMode === "entry" ? (
          <JobSetupSidebar
            adminTools={currentUser.role === "admin" ? renderAdminToolsDrawer() : null}
            allProjects={allProjects}
            currentUser={currentUser}
            currentUserAutoMyJobIds={currentUserAutoMyJobIds}
            currentUserCanManageMyProjects={currentUserCanManageMyProjects}
            currentUserMyJobIds={currentUserMyJobIds}
            crewDirectory={crewDirectory}
            crewMemberJobTitle={crewMemberJobTitle}
            crewMemberLaborType={crewMemberLaborType}
            crewMemberName={crewMemberName}
            crewSetupExpanded={crewSetupExpanded}
            dateInputRef={dateInputRef}
            editingCrewMember={editingCrewMember}
            entries={entries}
            entryNotice={entryNotice}
            existingCrewMemberOptions={existingCrewMemberOptions}
            filteredSubcontractorVendors={filteredSubcontractorVendors}
            jobPickerProjects={jobPickerProjects}
            jobSetupCollapsed={jobSetupCollapsed}
            jobSetupExpanded={jobSetupExpanded}
            loadingNetSuiteVendors={loadingNetSuiteVendors}
            mergeSourceCrewMemberId={mergeSourceCrewMemberId}
            mergeTargetCrewMemberId={mergeTargetCrewMemberId}
            myProjectsEditorOpen={myProjectsEditorOpen}
            netSuiteVendors={netSuiteVendors}
            projectLoadError={projectLoadError}
            projects={projects}
            selectedExistingCrewMemberId={selectedExistingCrewMemberId}
            selectedProject={selectedProject}
            selectedProjectCrewMembers={selectedProjectCrewMembers}
            selectedProjectId={selectedProjectId}
            selectedSubcontractorVendorId={selectedSubcontractorVendorId}
            showOnlyMyProjects={showOnlyMyProjects}
            subcontractorVendorSearch={subcontractorVendorSearch}
            syncedAt={syncedAt}
            workDate={workDate}
            onAddCrewMember={addCrewMember}
            onAddExistingCrewMemberToProject={addExistingCrewMemberToProject}
            onAddSubcontractorVendorToProject={addSubcontractorVendorToProject}
            onCancelEditingCrewMember={cancelEditingCrewMember}
            onChangeSelectedProject={changeSelectedProject}
            onChangeWorkDate={changeWorkDate}
            onMergeCrewMembers={mergeCrewMembers}
            onRemoveCrewMember={removeCrewMember}
            onSaveEditedCrewMember={saveEditedCrewMember}
            onSelectSubcontractorVendor={selectSubcontractorVendor}
            onSetCrewMemberJobTitle={setCrewMemberJobTitle}
            onSetCrewMemberLaborType={setCrewMemberLaborType}
            onSetCrewMemberName={setCrewMemberName}
            onSetCrewSetupExpanded={setCrewSetupExpanded}
            onSetJobSetupCollapsed={setJobSetupCollapsed}
            onSetJobSetupExpanded={setJobSetupExpanded}
            onSetMergeSourceCrewMemberId={setMergeSourceCrewMemberId}
            onSetMergeTargetCrewMemberId={setMergeTargetCrewMemberId}
            onSetMyProjectsEditorOpen={setMyProjectsEditorOpen}
            onSetSelectedExistingCrewMemberId={setSelectedExistingCrewMemberId}
            onSetShowOnlyMyProjects={setShowOnlyMyProjects}
            onSetUserMyJobIds={setCurrentUserMyJobIds}
            onStartEditingCrewMember={startEditingCrewMember}
            onUpdateEditingCrewMember={updateEditingCrewMember}
            onUpdateSubcontractorVendorSearch={updateSubcontractorVendorSearch}
          />
        ) : null}

        {viewMode === "dashboard" ? (
          <DashboardView
            adminTools={currentUser.role === "admin" ? renderAdminToolsDrawer() : null}
            currentUser={currentUser}
            dailyReportUploadsByKey={dailyReportUploadsByKey}
            dailyReportsByKey={dailyReportsByKey}
            daySubmissions={daySubmissions}
            entries={entries}
            fieldAssignmentNotice={fieldAssignmentNotice}
            fieldUsers={fieldUsers}
            loading={loadingProjects || !appStateHydrated}
            myJobsByUser={myJobsByUser}
            onOpenDay={openDailyEntry}
            onSaveFieldAssignments={saveFieldProjectAssignments}
            projects={projects}
            savingFieldAssignmentProjectId={savingFieldAssignmentProjectId}
          />
        ) : viewMode === "entry" ? (
          <section className="allocation-grid entry-allocation-grid">
            <PageHeader
              icon={Edit3}
              kicker="Entry"
              meta={[
                selectedProject?.name ?? "No job selected",
                formatDate(workDate),
                getProjectWorkTypeLabel(selectedProject)
              ]}
              title="Daily Entry"
              titleOnly
            />
            <div className="summary-strip">
              <div className="metric">
                <span>Selected Job</span>
                <strong>{selectedProject?.name ?? "No job"}</strong>
              </div>
              <div className="metric">
                <span>Total Hours For Selected Day</span>
                <strong>{selectedDayTotalHours.toFixed(2)}</strong>
              </div>
            </div>
            <DailyStatusStrip
              dailyReportExists={Boolean(currentDailyReport)}
              dayIsSubmitted={dayIsSubmitted}
              draftEntryCount={draftEntryCount}
              entryCount={visibleEntries.length}
              procoreStatus={currentDailyReportProcoreStatus}
              showEntryStatus={selectedProjectUsesPayItems}
              uploadedImageCount={uploadedJobImageCount}
            />

            {selectedProjectUsesPayItems ? (
              <>
            <PayItemEntryPanel
              crewMembers={selectedProjectCrewMembers}
              dayIsSubmitted={dayIsSubmitted}
              displayedPayItems={displayedPayItems}
              draftEntryCount={draftEntryCount}
              draftsByPayItem={draftsByPayItem}
              entryNotice={entryNotice}
              mobileSelectedPayItem={mobileSelectedPayItem}
              panelRef={payItemEntryPanelRef}
              remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
              savedEntries={visibleEntries}
              savingEntries={savingEntries}
              selectedProject={selectedProject}
              onClearDraftInputs={clearDraftInputs}
              onCrewEditorClose={scrollPayItemEntryPanelToTop}
              onCrewHoursChange={updateDraftCrewHours}
              onCrewToggle={toggleDraftCrewMember}
              onDraftChange={updateDraft}
              onExpandMatrix={() => setMatrixFullscreenOpen(true)}
              onSaveEntries={saveAllocationEntries}
              onSelectedPayItemChange={setMobileSelectedPayItemId}
              onSplitEvenly={splitDraftCrewHoursEvenly}
            />

            <ReviewSubmitPanel
              canManageSubmittedDay={currentUser.role === "admin"}
              crewSummaryRows={crewSummaryRows}
              currentDailyReport={currentDailyReport}
              currentDaySubmission={currentDaySubmission}
              dayIsSubmitted={dayIsSubmitted}
              deletingSubmittedDay={deletingSubmittedDay}
              editingEntry={editingEntry}
              entries={visibleEntries}
              procoreStatus={currentDailyReportProcoreStatus}
              removingEntryId={removingEntryId}
              reopeningDay={reopeningDay}
              savingEditedEntry={savingEditedEntry}
              savingEntries={savingEntries}
              showPayItemEntries={selectedProjectUsesPayItems}
              submittingDay={submittingDay}
              totalHours={totalHours}
              onDeleteSubmittedDay={deleteSubmittedDay}
              onRemoveEntry={removeEntry}
              onReopenSubmittedDay={reopenSubmittedDay}
              onSaveEditedEntry={saveEditedEntry}
              onStartEditingEntry={startEditingEntry}
              onSubmitDay={submitDay}
              onUpdateEditingEntry={updateEditingEntry}
            />
              </>
            ) : null}

            <DailyWrapUpSection
              currentDailyReport={currentDailyReport}
              currentJobImageUploads={currentJobImageUploads}
              dailyReportNeedsUpload={dailyReportNeedsUpload}
              dailyReportUploadNotice={dailyReportUploadNotice}
              dailyReportUploadPending={dailyReportUploadPending}
              dailyReportUploadRetryQueue={dailyReportUploadRetryQueue}
              dayIsSubmitted={dayIsSubmitted}
              downloadingDailyReportPdf={downloadingDailyReportPdf}
              draftEntryCount={draftEntryCount}
              failedJobImageUploads={failedJobImageUploads}
              failedQueuedJobImages={failedQueuedJobImages}
              jobImageDailyLimitReached={jobImageDailyLimitReached}
              jobImageHistoryExpanded={jobImageHistoryExpanded}
              jobImageInputRef={jobImageInputRef}
              jobImageNotice={jobImageNotice}
              jobImageQueue={jobImageQueue}
              loadingJobImageUploads={loadingJobImageUploads}
              procoreStatus={currentDailyReportProcoreStatus}
              queuedJobImages={queuedJobImages}
              retryingDailyReportUploadKey={retryingDailyReportUploadKey}
              savingEntries={savingEntries}
              selectedProject={selectedProject}
              selectedProjectUsesPayItems={selectedProjectUsesPayItems}
              selectedProjectUsesTwoSeriesDailyReport={selectedProjectUsesTwoSeriesDailyReport}
              showDailyReportDetails={showDailyReportDetails}
              showJobImageDetails={showJobImageDetails}
              submittingDay={submittingDay}
              uploadedJobImageCount={uploadedJobImageCount}
              uploadingDailyReport={uploadingDailyReport}
              uploadingJobImages={uploadingJobImages}
              visibleEntryCount={visibleEntries.length}
              onAddJobImages={addJobImages}
              onClearJobImageQueue={clearJobImageQueue}
              onClearUploadedJobImagesFromQueue={clearUploadedJobImagesFromQueue}
              onDownloadDailyReportPdf={downloadDailyReportPdf}
              onOpenDailyEntry={openDailyEntry}
              onOpenDailyReportModal={openDailyReportModal}
              onRemoveJobImageFromQueue={removeJobImageFromQueue}
              onRetryDailyReportUpload={retryDailyReportUpload}
              onRetryFailedJobImages={retryFailedJobImages}
              onSaveAllocationEntries={saveAllocationEntries}
              onSubmitDay={submitDay}
              onToggleJobImageHistory={() => setJobImageHistoryExpanded((current) => !current)}
              onUpdateJobImageCaption={updateJobImageCaption}
              onUploadDailyReportToProcore={uploadDailyReportToProcoreDocuments}
              onUploadQueuedJobImages={uploadQueuedJobImages}
            />
          </section>
        ) : viewMode === "calendar" ? (
          <section className="allocation-grid">
            <PageHeader
              icon={CalendarDays}
              kicker="Calendar"
              meta={[calendarUseMyProjects ? "My Projects" : "Selected jobs", `Week of ${formatDate(calendarWeekStart)}`]}
              title="Project Calendar"
            />
            <div className="panel">
              <div className="panel-heading">
                <h2>Weekly Status</h2>
              </div>
              <WeeklyStatusReport
                canExportWeeklyDailyReports={canAccessReports(currentUser)}
                dailyReportUploadsByKey={dailyReportUploadsByKey}
                dailyReportsByKey={dailyReportsByKey}
                daySubmissions={daySubmissions}
                entries={entries}
                myJobIds={currentUserMyJobIds}
                onOpenDay={openDailyEntry}
                projects={projects}
                selectedProjectIds={calendarProjectIds}
                setSelectedProjectIds={setCalendarProjectIds}
                setUseMyJobs={setCalendarUseMyProjects}
                setWeekStart={setCalendarWeekStart}
                useMyJobs={calendarUseMyProjects}
                weekStart={calendarWeekStart}
              />
            </div>
          </section>
        ) : (
          <ReportsView
            currentUser={currentUser}
            dailyReportsByKey={reportDailyReportsByKey}
            entries={reportEntries}
            myJobIds={currentUserMyJobIds}
            projects={projects}
            reportProjectId={reportProjectId}
            reportStartDate={reportStartDate}
            reportEndDate={reportEndDate}
            setMyJobIds={setCurrentUserMyJobIds}
            setReportProjectId={setReportProjectId}
            setReportStartDate={setReportStartDate}
            setReportEndDate={setReportEndDate}
          />
        )}
      </div>
      <footer className="app-footer">
        <a href="https://fdot-field-app.streamlit.app/" rel="noopener noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" size={13} />
          FDOT Pay Items
        </a>
      </footer>
      {dailyReportModalOpen && selectedProject ? (
        <DailyReportModal
          canCopyPreviousCrewTime={Boolean(previousDailyReportCrewTime)}
          canUseSavedEntries={visibleEntries.length > 0}
          date={workDate}
          draft={dailyReportDraft}
          draftNotice={dailyReportDraftNotice}
          isTwoSeriesTemplate={selectedProjectUsesTwoSeriesDailyReport}
          payItems={selectedProject.payItems}
          previousCrewTimeLabel={
            previousDailyReportCrewTime ? `Copy Crew/Time from ${formatDate(previousDailyReportCrewTime.date)}` : "No Previous Crew/Time"
          }
          projectName={selectedProject.name}
          onChange={updateDailyReportDraft}
          onCopyPreviousCrewTime={copyPreviousDailyReportCrewTime}
          onCopySavedEntriesToWorkRows={copySavedEntriesToDailyReportWorkRows}
          onEmployeeChange={updateDailyReportEmployeeDraft}
          onEmployeeTimeBlur={normalizeDailyReportEmployeeTimeDraft}
          onItsfmChange={updateDailyReportItsfmDraft}
          onPayItemChange={updateDailyReportPayItemDraft}
          onClose={closeDailyReportModal}
          onSave={saveDailyReport}
        />
      ) : null}
      {confirmationDialog}
    </main>
  );
}
