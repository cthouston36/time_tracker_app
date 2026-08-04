"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Edit3,
  ExternalLink
} from "lucide-react";
import { todayInputValue } from "@/lib/date";
import { canAccessReports, getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
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
import {
  clearDatabaseProjectCatalog,
  clearDatabaseStagingOperationalData,
  loadDatabaseCrewData,
  loadDatabaseDailyReportData,
  loadDatabaseDayRecords,
  loadDatabaseEntries,
  loadDatabaseProjectControls,
  loadCurrentUserSession,
  loadProcoreUploadStatus,
  loadProjectCatalog,
  logoutCurrentUserSession,
  saveDatabaseMyJobs,
  saveDatabaseProjectArchive,
  saveDatabaseProjectBlacklist
} from "@/features/time-allocation/lib/api-client";
import {
  filterDailyReportsByProjectIds,
  getDailyReportEmployeeTotalHours
} from "@/features/time-allocation/lib/daily-report-helpers";
import { exportEntriesToCsv } from "@/features/time-allocation/lib/entry-csv-export";
import {
  buildSharedAppState,
  normalizeSharedAppState,
  readLocalSharedAppState,
  writeLocalSharedAppState
} from "@/features/time-allocation/lib/app-state-storage";
import {
  clearPendingProcoreReturn,
  getLastProjectStorageKey,
  readPendingProcoreReturn,
  writePendingProcoreReturn,
  type PendingProcoreReturn,
  type ViewMode
} from "@/features/time-allocation/lib/client-storage";
import { restoreWorkspaceSelection } from "@/features/time-allocation/lib/workspace-selection-helpers";
import {
  formatDate,
  getDayKey,
  getWeekStart
} from "@/features/time-allocation/lib/date-helpers";
import { getProjectWorkTypeLabel } from "@/features/time-allocation/lib/status-helpers";
import { buildRemainingQuantitiesByPayItem } from "@/features/time-allocation/lib/pay-item-helpers";
import { getDefaultViewModeForUser } from "@/features/time-allocation/lib/auth-ui-helpers";
import {
  buildCrewSummary,
  draftHasAnyInput,
  draftIsSaveable
} from "@/features/time-allocation/lib/crew-entry-helpers";
import {
  setPayItemDraftCrewMember,
  splitPayItemDraftCrewHoursEvenly,
  updatePayItemDraftCrewHours,
  updatePayItemDraftValue
} from "@/features/time-allocation/lib/pay-item-draft-updates";
import { populateEntryProjectSnapshots } from "@/features/time-allocation/lib/entry-snapshot-helpers";
import {
  buildNetSuiteProjectManagerOptions,
  filterActiveProjects,
  getDefaultMyJobIdsForUser,
  sortProjectsByName
} from "@/features/time-allocation/lib/selectors";
import type {
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  DraftsByPayItem,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById,
  SharedAppState
} from "@/features/time-allocation/types";
import { useNetworkStatus } from "@/features/time-allocation/hooks/use-network-status";
import { useAdminUserManagement } from "@/features/time-allocation/hooks/use-admin-user-management";
import { useAuthForms } from "@/features/time-allocation/hooks/use-auth-forms";
import { useCrewManagement } from "@/features/time-allocation/hooks/use-crew-management";
import { useDailyReports } from "@/features/time-allocation/hooks/use-daily-reports";
import { useEntryActions } from "@/features/time-allocation/hooks/use-entry-actions";
import { useConfirmationDialog } from "@/features/time-allocation/hooks/use-confirmation-dialog";
import { useFieldProjectAssignments } from "@/features/time-allocation/hooks/use-field-project-assignments";
import { useJobImages } from "@/features/time-allocation/hooks/use-job-images";
import { useMobileInstallPrompt } from "@/features/time-allocation/hooks/use-mobile-install-prompt";
import { useNetSuiteVendors } from "@/features/time-allocation/hooks/use-netsuite-vendors";
import { useProjectSync } from "@/features/time-allocation/hooks/use-project-sync";
import { useRetiredViewRedirect } from "@/features/time-allocation/hooks/use-retired-view-redirect";
import { useUnsavedChangesWarning } from "@/features/time-allocation/hooks/use-unsaved-changes-warning";
import { useWorkspaceKeyboardShortcuts } from "@/features/time-allocation/hooks/use-workspace-keyboard-shortcuts";
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
  const [clearingStagingData, setClearingStagingData] = useState(false);
  const [clearingProjectCatalog, setClearingProjectCatalog] = useState(false);
  const [adminMaintenanceNotice, setAdminMaintenanceNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
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
  const myProjectsFilterInitializedRef = useRef(false);
  const saveDailyReportRef = useRef<(() => Promise<void>) | null>(null);
  const saveAllocationEntriesRef = useRef<(() => Promise<void>) | null>(null);
  const { confirmAction, confirmationDialog } = useConfirmationDialog();

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

  const activeProjects = useMemo(
    () => filterActiveProjects(allProjects, projectBlacklistById, projectArchiveById),
    [allProjects, projectArchiveById, projectBlacklistById]
  );
  const projects = useMemo(
    () => (currentUser ? getAccessibleProjectsForUser(currentUser, activeProjects, { assignedProjectIdsByUser: myJobsByUser }) : []),
    [activeProjects, currentUser, myJobsByUser]
  );
  const visibleProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const reportEntries = entries.filter((entry) => visibleProjectIds.has(entry.projectId));
  const netSuiteProjectManagerOptions = useMemo(() => buildNetSuiteProjectManagerOptions(allProjects), [allProjects]);
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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const selectedProjectUsesTwoSeriesDailyReport = isTwoSeriesProject(selectedProject);
  const selectedProjectUsesPayItems = Boolean(selectedProject && !selectedProjectUsesTwoSeriesDailyReport);
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
  const selectedProjectEntries = useMemo(
    () => entries.filter((entry) => entry.projectId === selectedProject?.id),
    [entries, selectedProject?.id]
  );
  const visibleEntries = useMemo(
    () => selectedProjectEntries.filter((entry) => entry.date === workDate),
    [selectedProjectEntries, workDate]
  );
  const remainingQuantitiesByPayItem = useMemo(
    () =>
      selectedProject
        ? buildRemainingQuantitiesByPayItem(selectedProject.payItems, selectedProjectEntries, workDate)
        : {},
    [selectedProject, selectedProjectEntries, workDate]
  );
  const displayedPayItems = useMemo(() => selectedProject?.payItems ?? [], [selectedProject?.payItems]);
  const mobileSelectedPayItem = useMemo(
    () =>
      displayedPayItems.find((payItem) => payItem.id === mobileSelectedPayItemId) ??
      displayedPayItems[0] ??
      null,
    [displayedPayItems, mobileSelectedPayItemId]
  );
  const crewSummaryRows = buildCrewSummary(visibleEntries, selectedProjectCrewMembers);
  const currentDaySubmission: DaySubmission = selectedProject
    ? daySubmissions[getDayKey(selectedProject.id, workDate)] ?? { status: "draft" }
    : { status: "draft" };
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
  const currentDayEntryNotes = selectedProject
    ? dayEntryNotesByKey[getDayKey(selectedProject.id, workDate)] ?? { notes: "", inventory: "" }
    : { notes: "", inventory: "" };
  const currentDayKey = selectedProject ? getDayKey(selectedProject.id, workDate) : "";
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
  const reportDailyReportsByKey = useMemo(
    () => filterDailyReportsByProjectIds(dailyReportsByKey, visibleProjectIds),
    [dailyReportsByKey, visibleProjectIds]
  );
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
  const currentUserAutoMyJobIds = useMemo(
    () => (currentUser ? getDefaultMyJobIdsForUser(currentUser, projects) : []),
    [currentUser, projects]
  );
  const currentUserMyJobIds = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "project_manager") {
      return currentUserAutoMyJobIds;
    }

    const savedJobIds = (myJobsByUser[currentUser.id] ?? []).filter((projectId) => visibleProjectIds.has(projectId));
    const combinedJobIds = new Set([...currentUserAutoMyJobIds, ...savedJobIds]);

    return projects.filter((project) => combinedJobIds.has(project.id)).map((project) => project.id);
  }, [currentUser, currentUserAutoMyJobIds, myJobsByUser, projects, visibleProjectIds]);
  const myProjectIdSet = useMemo(() => new Set(currentUserMyJobIds), [currentUserMyJobIds]);
  const jobPickerProjects = useMemo(
    () =>
      showOnlyMyProjects && currentUserMyJobIds.length > 0
        ? projects.filter((project) => myProjectIdSet.has(project.id))
        : projects,
    [currentUserMyJobIds.length, myProjectIdSet, projects, showOnlyMyProjects]
  );
  const totalHours = visibleEntries.reduce((total, entry) => total + entry.hours, 0);
  const selectedDayTotalHours = selectedProjectUsesPayItems
    ? totalHours
    : currentDailyReport
      ? getDailyReportEmployeeTotalHours(currentDailyReport.employeeRows)
      : 0;
  const draftEntryCount = selectedProject
    ? selectedProject.payItems.filter((item) => draftIsSaveable(draftsByPayItem[item.id])).length
    : 0;
  const hasUnsavedPayItemDrafts = Object.values(draftsByPayItem).some(draftHasAnyInput);
  const hasUnsavedChanges =
    hasUnsavedPayItemDrafts ||
    Boolean(editingEntry) ||
    Boolean(editingCrewMember) ||
    dailyReportModalOpen ||
    queuedJobImages.length > 0;
  const currentUserCanManageMyProjects = currentUser?.role === "admin";
  useRetiredViewRedirect({
    enabled: Boolean(currentUser),
    setViewMode,
    viewMode
  });
  useUnsavedChangesWarning(hasUnsavedChanges);

  function shouldBlockOfflineAction(setNotice: (message: string) => void) {
    if (!userIsOffline) {
      return false;
    }

    setNotice("You appear to be offline. Reconnect before saving, syncing, or uploading.");
    return true;
  }

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

  const applySharedAppState = useCallback(
    (state: Partial<SharedAppState> | null) => {
      const normalizedState = normalizeSharedAppState(state);

      setEntries(normalizedState.entries);
      setDaySubmissions(normalizedState.daySubmissions);
      setDayEntryNotesByKey(normalizedState.dayEntryNotesByKey);
      replaceDailyReportData({
        dailyReportUploadsByKey: normalizedState.dailyReportUploadsByKey,
        dailyReportsByKey: normalizedState.dailyReportsByKey
      });
      replaceSyncLog(normalizedState.syncLog);
      replaceCrewData(normalizedState.crewDirectory, normalizedState.crewMembersByProject);
      setMyJobsByUser(normalizedState.myJobsByUser);
      setProjectArchiveById(normalizedState.projectArchiveById);
      setProjectBlacklistById(normalizedState.projectBlacklistById);
    },
    [replaceCrewData, replaceDailyReportData, replaceSyncLog]
  );

  function confirmDiscardUnsavedChanges(actionDescription: string) {
    if (!hasUnsavedChanges) {
      return Promise.resolve(true);
    }

    return confirmAction({
      cancelLabel: "Stay here",
      confirmLabel: "Discard changes",
      description: `You have unsaved changes. Continue to ${actionDescription}?`,
      details: ["Unsaved pay item inputs, queued images, or daily report edits will be discarded."],
      title: "Discard unsaved changes",
      tone: "warning"
    });
  }

  function clearTransientEntryState() {
    setMobileSelectedPayItemId("");
    cancelEditingEntry();
    clearCrewForms();
    setDraftsByPayItem({});
    clearJobImageQueue();
    clearDailyReportDraftForCurrentContext();
  }

  async function changeSelectedProject(nextProjectId: string) {
    if (nextProjectId === selectedProjectId) {
      return;
    }

    if (!(await confirmDiscardUnsavedChanges("change jobs"))) {
      return;
    }

    clearTransientEntryState();
    setSelectedProjectId(nextProjectId);
  }

  async function changeWorkDate(nextWorkDate: string) {
    if (nextWorkDate === workDate) {
      return;
    }

    if (!(await confirmDiscardUnsavedChanges("change dates"))) {
      return;
    }

    clearTransientEntryState();
    setWorkDate(nextWorkDate);
  }

  async function changeViewMode(nextViewMode: ViewMode) {
    if (nextViewMode === viewMode) {
      return;
    }

    if (nextViewMode !== "entry" && !(await confirmDiscardUnsavedChanges("leave the entry view"))) {
      return;
    }

    if (nextViewMode !== "entry") {
      clearTransientEntryState();
    }

    setViewMode(nextViewMode);
  }

  useEffect(() => {
    async function loadCurrentUser() {
      const data = await loadCurrentUserSession();

      setCurrentUser(data.user);
      setAuthChecked(true);
    }

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const procoreStatus = new URLSearchParams(window.location.search).get("procore");
    if (procoreStatus === "connected") {
      setConnectionStatus("Procore connected");
    } else if (procoreStatus) {
      setConnectionStatus("Procore connection needs attention");
    }

    const currentUserId = currentUser.id;

    async function loadProcoreConnectionStatus() {
      try {
        const data = await loadProcoreUploadStatus();

        if (data.connected && data.connectedBy) {
          setConnectionStatus(`Procore configured by ${data.connectedBy}`);
        }
      } catch {
        // Project catalog data can still load even if the Procore upload status check fails.
      }
    }

    async function loadProjects() {
      setLoadingProjects(true);
      setProjectLoadError("");

      try {
        const data = await loadProjectCatalog();
        const sortedProjects = sortProjectsByName(data.projects);
        const lastSelectedProjectId = window.localStorage.getItem(getLastProjectStorageKey(currentUserId));
        const pendingProcoreReturn = readPendingProcoreReturn();
        const restoredSelection = restoreWorkspaceSelection({
          lastSelectedProjectId,
          pendingProcoreReturn,
          projects: sortedProjects
        });

        setAllProjects(sortedProjects);
        setSelectedProjectId(restoredSelection.selectedProjectId);
        if (restoredSelection.workDate) {
          setWorkDate(restoredSelection.workDate);
        }
        if (restoredSelection.viewMode) {
          setViewMode(restoredSelection.viewMode);
        }
        if (restoredSelection.mobileSelectedPayItemId) {
          setMobileSelectedPayItemId(restoredSelection.mobileSelectedPayItemId);
        }
        if (pendingProcoreReturn) {
          clearPendingProcoreReturn();
        }
        if (procoreStatus === "connected" && pendingProcoreReturn?.intent === "upload_daily") {
          setDailyReportUploadNotice({
            message: "Procore connected. Click Upload Daily to Procore to finish sending this daily.",
            status: "success"
          });
        }
        setSyncedAt(data.syncedAt ?? null);
        setConnectionStatus(data.syncedAt ? "Project catalog loaded" : "No project catalog data");
      } catch (error) {
        setProjectLoadError(error instanceof Error ? error.message : "Unable to load projects.");
      } finally {
        setLoadingProjects(false);
      }
    }

    void loadProcoreConnectionStatus();
    void loadProjects();
  }, [currentUser, setDailyReportUploadNotice, setSyncedAt]);

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      setClearingStagingData(false);
      setAdminMaintenanceNotice(null);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (projects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId("");
        setMobileSelectedPayItemId("");
        cancelEditingEntry();
        clearCrewForms();
        setDraftsByPayItem({});
      }
      return;
    }

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      setMobileSelectedPayItemId("");
      cancelEditingEntry();
      clearCrewForms();
      setDraftsByPayItem({});
    }
  }, [cancelEditingEntry, clearCrewForms, currentUser, projects, selectedProjectId]);

  useEffect(() => {
    if (!currentUser || jobPickerProjects.length === 0) {
      return;
    }

    if (!jobPickerProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(jobPickerProjects[0].id);
      setMobileSelectedPayItemId("");
      cancelEditingEntry();
      clearCrewForms();
      setDraftsByPayItem({});
    }
  }, [cancelEditingEntry, clearCrewForms, currentUser, jobPickerProjects, selectedProjectId]);

  useEffect(() => {
    if (currentUserMyJobIds.length === 0 && showOnlyMyProjects) {
      setShowOnlyMyProjects(false);
    }
  }, [currentUserMyJobIds.length, showOnlyMyProjects]);

  useEffect(() => {
    myProjectsFilterInitializedRef.current = false;
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !appStateHydrated) {
      return;
    }

    if (currentUserMyJobIds.length === 0) {
      setShowOnlyMyProjects(false);
      return;
    }

    if (!myProjectsFilterInitializedRef.current) {
      myProjectsFilterInitializedRef.current = true;
      setShowOnlyMyProjects(true);
    }
  }, [appStateHydrated, currentUser, currentUserMyJobIds.length]);

  useEffect(() => {
    if (!currentUser || !selectedProjectId) {
      return;
    }

    window.localStorage.setItem(getLastProjectStorageKey(currentUser.id), selectedProjectId);
  }, [currentUser, selectedProjectId]);

  useEffect(() => {
    if (!displayedPayItems.length) {
      if (mobileSelectedPayItemId) {
        setMobileSelectedPayItemId("");
      }
      return;
    }

    if (!displayedPayItems.some((payItem) => payItem.id === mobileSelectedPayItemId)) {
      setMobileSelectedPayItemId(displayedPayItems[0].id);
    }
  }, [displayedPayItems, mobileSelectedPayItemId]);

  useEffect(() => {
    if (!currentUser) {
      setAppStateHydrated(false);
      return;
    }

    let cancelled = false;

    async function loadAppState() {
      setAppStateHydrated(false);

      try {
        const [
          databaseEntries,
          databaseCrewData,
          databaseDailyReportData,
          databaseDayRecords,
          databaseProjectControls
        ] = await Promise.all([
          loadDatabaseEntries(),
          loadDatabaseCrewData(),
          loadDatabaseDailyReportData(),
          loadDatabaseDayRecords(),
          loadDatabaseProjectControls()
        ]);

        if (cancelled) {
          return;
        }

        const sharedState = readLocalSharedAppState();
        const nextState = {
          ...sharedState,
          ...(databaseEntries ? { entries: databaseEntries } : {}),
          ...(databaseCrewData ?? {}),
          ...(databaseDailyReportData ?? {}),
          ...(databaseDayRecords ?? {}),
          ...(databaseProjectControls ?? {})
        };

        applySharedAppState(nextState);
      } catch {
        if (!cancelled) {
          applySharedAppState(readLocalSharedAppState());
        }
      } finally {
        if (!cancelled) {
          setAppStateHydrated(true);
        }
      }
    }

    void loadAppState();

    return () => {
      cancelled = true;
    };
  }, [applySharedAppState, currentUser]);

  useEffect(() => {
    if (!currentUser || !appStateHydrated) {
      return;
    }

    const sharedAppState = buildSharedAppState({
      crewDirectory,
      crewMembersByProject,
      dailyReportUploadsByKey,
      dailyReportsByKey,
      dayEntryNotesByKey,
      daySubmissions,
      entries,
      myJobsByUser,
      projectArchiveById,
      projectBlacklistById,
      syncLog
    });

    writeLocalSharedAppState(sharedAppState);
  }, [
    appStateHydrated,
    currentUser,
    crewDirectory,
    crewMembersByProject,
    dayEntryNotesByKey,
    daySubmissions,
    dailyReportUploadsByKey,
    dailyReportsByKey,
    entries,
    myJobsByUser,
    projectArchiveById,
    projectBlacklistById,
    syncLog
  ]);

  useEffect(() => {
    if (!currentUser || projects.length === 0 || entries.length === 0) {
      return;
    }

    const result = populateEntryProjectSnapshots(entries, projects);

    if (result.changed) {
      setEntries(result.entries);
    }
  }, [currentUser, entries, projects]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem("procore-sync-log", JSON.stringify(syncLog));
  }, [currentUser, syncLog]);

  async function logout() {
    if (!(await confirmDiscardUnsavedChanges("sign out"))) {
      return;
    }

    await logoutCurrentUserSession();

    setCurrentUser(null);
    setAllProjects([]);
    setSelectedProjectId("");
    setShowOnlyMyProjects(false);
    setMyProjectsEditorOpen(false);
    setCrewSetupExpanded(false);
    resetAuthForms();
    setEntries([]);
    setDaySubmissions({});
    setDayEntryNotesByKey({});
    resetDailyReportState();
    setMyJobsByUser({});
    setProjectArchiveById({});
    setProjectBlacklistById({});
    resetCrewManagementState();
    setViewMode("dashboard");
  }

  async function clearStagingOperationalData() {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineAction((message) => {
      setAdminMaintenanceNotice({ message, status: "error" });
    })) {
      return;
    }

    if (
      !(await confirmAction({
        cancelLabel: "Keep staging data",
        confirmLabel: "Clear staging data",
        description: "Clear staging daily data?",
        details: [
          "This permanently removes daily pay item entries, submitted/draft day statuses, daily notes, daily reports, daily report upload status, and all crew members/crew project assignments.",
          "It keeps user profiles/passwords, project catalog jobs/pay items, sync state/log, project blacklist, and My Projects."
        ],
        title: "Clear staging daily data",
        tone: "danger"
      }))
    ) {
      return;
    }

    setClearingStagingData(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await clearDatabaseStagingOperationalData();

      setEntries([]);
      setDaySubmissions({});
      setDayEntryNotesByKey({});
      resetDailyReportState({ clearAutosaves: true });
      resetCrewManagementState();
      cancelEditingEntry();
      setDraftsByPayItem({});
      setEntryNotice("Staging daily entry, daily report, and crew data cleared.");
      setAdminMaintenanceNotice({
        message: data.databaseConfigured
          ? "Staging data cleared. Users, project catalog jobs/pay items, sync state, blacklist, and My Projects were preserved."
          : "Local staging data cleared.",
        status: "success"
      });
    } catch (error) {
      setAdminMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to clear staging data.",
        status: "error"
      });
    } finally {
      setClearingStagingData(false);
    }
  }

  async function clearProjectCatalogData() {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineAction((message) => {
      setAdminMaintenanceNotice({ message, status: "error" });
    })) {
      return;
    }

    if (
      !(await confirmAction({
        cancelLabel: "Keep project catalog",
        confirmLabel: "Clear catalog",
        description: "Clear project catalog jobs and pay items?",
        details: [
          "This permanently removes the current project catalog jobs/pay items and the legacy catalog fallback.",
          "It keeps users, passwords, daily entries, daily reports, crew records, sync log, project blacklist, and My Projects."
        ],
        title: "Clear project catalog",
        tone: "danger"
      }))
    ) {
      return;
    }

    setClearingProjectCatalog(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await clearDatabaseProjectCatalog();
      const cleared = data.cleared;
      const projectCount = cleared?.projects ?? 0;
      const payItemCount = cleared?.payItems ?? 0;

      setAllProjects([]);
      setSelectedProjectId("");
      resetProjectSyncState();
      setDraftsByPayItem({});
      setProjectLoadError("");
      setConnectionStatus("No project catalog data");
      setAdminMaintenanceNotice({
        message: `Project catalog cleared. Removed ${projectCount} job${projectCount === 1 ? "" : "s"} and ${payItemCount} pay item${payItemCount === 1 ? "" : "s"}. Sync from NetSuite to reload jobs.`,
        status: "success"
      });
    } catch (error) {
      setAdminMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to clear the project catalog.",
        status: "error"
      });
    } finally {
      setClearingProjectCatalog(false);
    }
  }

  function setCurrentUserMyJobIds(jobIds: string[]) {
    if (!currentUser) {
      return;
    }

    const availableProjectIds = new Set(projects.map((project) => project.id));
    const automaticallyManagedJobIds = new Set(getDefaultMyJobIdsForUser(currentUser, projects));
    const uniqueJobIds = Array.from(new Set(jobIds)).filter(
      (jobId) => availableProjectIds.has(jobId) && !automaticallyManagedJobIds.has(jobId)
    );

    setMyJobsByUser((current) => ({
      ...current,
      [currentUser.id]: uniqueJobIds
    }));
    void saveDatabaseMyJobs(currentUser.id, uniqueJobIds).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "My Projects saved locally, but did not sync.");
    });
  }

  function toggleProjectBlacklist(projectId: string, blacklisted: boolean) {
    setProjectBlacklistById((current) => {
      if (blacklisted) {
        return {
          ...current,
          [projectId]: true
        };
      }

      const nextBlacklist = { ...current };
      delete nextBlacklist[projectId];
      return nextBlacklist;
    });
    void saveDatabaseProjectBlacklist(projectId, blacklisted).catch((error) => {
      setProjectLoadError(error instanceof Error ? error.message : "Project blacklist saved locally, but did not sync.");
    });
  }

  function toggleProjectArchive(projectId: string, archived: boolean) {
    setProjectArchiveById((current) => {
      if (archived) {
        return {
          ...current,
          [projectId]: true
        };
      }

      const nextArchive = { ...current };
      delete nextArchive[projectId];
      return nextArchive;
    });

    if (archived && selectedProjectId === projectId) {
      const nextProject = projects.find((project) => project.id !== projectId);

      setSelectedProjectId(nextProject?.id ?? "");
      setMobileSelectedPayItemId("");
      cancelEditingEntry();
      setDraftsByPayItem({});
    }

    void saveDatabaseProjectArchive(projectId, archived).catch((error) => {
      setProjectLoadError(error instanceof Error ? error.message : "Project archive saved locally, but did not sync.");
    });
  }

  async function openDailyEntry(projectId: string, date: string) {
    if (!projects.some((project) => project.id === projectId)) {
      return;
    }

    if (
      (projectId !== selectedProject?.id || date !== workDate || viewMode !== "entry") &&
      !(await confirmDiscardUnsavedChanges("open that day"))
    ) {
      return;
    }

    setSelectedProjectId(projectId);
    setWorkDate(date);
    setViewMode("entry");
    setMobileSelectedPayItemId("");
    cancelEditingEntry();
    clearCrewForms();
    setDraftsByPayItem({});
  }

  async function connectProcore(intent: PendingProcoreReturn["intent"] = "connect") {
    if (shouldBlockOfflineAction(setProjectLoadError)) {
      return;
    }

    if (!(await confirmDiscardUnsavedChanges("connect to Procore"))) {
      return;
    }

    writePendingProcoreReturn({
      date: workDate,
      intent,
      mobilePayItemId: mobileSelectedPayItemId,
      projectId: selectedProject?.id ?? selectedProjectId,
      viewMode
    });
    window.location.assign("/api/procore/oauth/login");
  }

  function updateDraft(payItemId: string, field: "hours" | "quantity", value: string) {
    setEntryNotice("");
    setDraftsByPayItem((current) => updatePayItemDraftValue(current, payItemId, visibleEntries, field, value));
  }

  function toggleDraftCrewMember(payItemId: string, crewMemberId: string, checked: boolean) {
    setEntryNotice("");
    setDraftsByPayItem((current) => setPayItemDraftCrewMember(current, payItemId, visibleEntries, crewMemberId, checked));
  }

  function updateDraftCrewHours(payItemId: string, crewMemberId: string, value: string) {
    setEntryNotice("");
    setDraftsByPayItem((current) => updatePayItemDraftCrewHours(current, payItemId, visibleEntries, crewMemberId, value));
  }

  function splitDraftCrewHoursEvenly(payItemId: string) {
    setDraftsByPayItem((current) => splitPayItemDraftCrewHoursEvenly(current, payItemId, visibleEntries));
  }

  function exportAllEntryDetails() {
    exportEntriesToCsv({
      dayEntryNotesByKey,
      daySubmissions,
      entries,
      projectBlacklistById,
      projects: allProjects
    });
  }

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
