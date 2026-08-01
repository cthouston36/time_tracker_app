"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Maximize2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { todayInputValue } from "@/lib/date";
import { canAccessReports, getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import {
  AppLoadingShell,
  EmptyState,
  InlineSpinner,
  PageHeader
} from "@/features/time-allocation/components/workspace-primitives";
import { DailyStatusStrip } from "@/features/time-allocation/components/daily-status-strip";
import { ChangePasswordModal } from "@/features/time-allocation/components/change-password-modal";
import { JobSetupSidebar } from "@/features/time-allocation/components/job-setup-sidebar";
import {
  MobileInstallPrompt,
  NetworkStatusBanner
} from "@/features/time-allocation/components/status-banners";
import { ReportsView } from "@/features/time-allocation/components/reports/reports-view";
import {
  DailyReportModal,
  DailyReportProcoreStatusValue
} from "@/features/time-allocation/components/daily-report/daily-report-ui";
import { DashboardView } from "@/features/time-allocation/components/dashboard/dashboard-view";
import {
  MobilePayItemEntry,
  PayItemMatrix
} from "@/features/time-allocation/components/entry/pay-item-entry-matrix";
import { SubmittedDayReview } from "@/features/time-allocation/components/entry/submitted-day-review";
import {
  clearDatabaseProjectCache,
  clearDatabaseStagingOperationalData,
  loadDatabaseCrewData,
  loadDatabaseDailyReportData,
  loadDatabaseDayRecords,
  loadDatabaseEntries,
  loadDatabaseProjectControls,
  readApiJson,
  saveDatabaseMyJobs,
  saveDatabaseProjectArchive,
  saveDatabaseProjectBlacklist
} from "@/features/time-allocation/lib/api-client";
import {
  filterDailyReportsByProjectIds,
  formatYesNoAnswer,
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
  dismissMobileInstallPrompt,
  getLastProjectStorageKey,
  hasDismissedMobileInstallPrompt,
  readPendingProcoreReturn,
  writePendingProcoreReturn,
  type PendingProcoreReturn,
  type ViewMode
} from "@/features/time-allocation/lib/client-storage";
import {
  formatDate,
  getDayKey,
  getWeekStart
} from "@/features/time-allocation/lib/date-helpers";
import { getProjectWorkTypeLabel } from "@/features/time-allocation/lib/status-helpers";
import {
  buildRemainingQuantitiesByPayItem,
  formatPayItemUnitOfMeasure
} from "@/features/time-allocation/lib/pay-item-helpers";
import { getEntryNoticeClassName } from "@/features/time-allocation/lib/notice-helpers";
import {
  formatRole,
  formatUserName,
  getDefaultViewModeForUser
} from "@/features/time-allocation/lib/auth-ui-helpers";
import {
  formatFileSize,
  formatJobImageQueueStatus,
  JOB_IMAGE_DAILY_UPLOAD_LIMIT
} from "@/features/time-allocation/lib/job-image-helpers";
import {
  buildCrewSummary,
  draftHasAnyInput,
  draftIsSaveable,
  formatEntryCrew,
  getExistingDraft,
  normalizeDraftCrewHours,
  splitCrewHoursEvenly
} from "@/features/time-allocation/lib/crew-entry-helpers";
import {
  buildNetSuiteProjectManagerOptions,
  filterActiveProjects,
  getDefaultMyJobIdsForUser,
  sortProjectsByName
} from "@/features/time-allocation/lib/selectors";
import type {
  AuthResponse,
  ProcoreStatusResponse
} from "@/features/time-allocation/lib/workspace-api-types";
import type {
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  DraftsByPayItem,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById,
  ProjectsResponse,
  SharedAppState
} from "@/features/time-allocation/types";
import { useNetworkStatus } from "@/features/time-allocation/hooks/use-network-status";
import { useAdminUserManagement } from "@/features/time-allocation/hooks/use-admin-user-management";
import { useAuthForms } from "@/features/time-allocation/hooks/use-auth-forms";
import { useCrewManagement } from "@/features/time-allocation/hooks/use-crew-management";
import { useDailyReports } from "@/features/time-allocation/hooks/use-daily-reports";
import { useEntryActions } from "@/features/time-allocation/hooks/use-entry-actions";
import { useFieldProjectAssignments } from "@/features/time-allocation/hooks/use-field-project-assignments";
import { useJobImages } from "@/features/time-allocation/hooks/use-job-images";
import { useNetSuiteVendors } from "@/features/time-allocation/hooks/use-netsuite-vendors";
import { useProjectSync } from "@/features/time-allocation/hooks/use-project-sync";
import { WeeklyStatusReport } from "@/features/time-allocation/components/dashboard/weekly-status-report";
import { AdminToolsDrawer } from "@/features/time-allocation/components/admin/admin-tools";
import type { AllocationEntry, Project } from "@/lib/procore/types";

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
  const [mobileInstallPromptVisible, setMobileInstallPromptVisible] = useState(false);
  const [myJobsByUser, setMyJobsByUser] = useState<MyJobsByUser>({});
  const [draftsByPayItem, setDraftsByPayItem] = useState<DraftsByPayItem>({});
  const [connectionStatus, setConnectionStatus] = useState("Mock data active");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [entryNotice, setEntryNotice] = useState("");
  const [clearingStagingData, setClearingStagingData] = useState(false);
  const [clearingProjectCache, setClearingProjectCache] = useState(false);
  const [adminMaintenanceNotice, setAdminMaintenanceNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const networkStatus = useNetworkStatus();
  const userIsOffline = networkStatus.checked && !networkStatus.online;
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

  function shouldBlockOfflineAction(setNotice: (message: string) => void) {
    if (!userIsOffline) {
      return false;
    }

    setNotice("You appear to be offline. Reconnect before saving, syncing, or uploading.");
    return true;
  }

  saveDailyReportRef.current = saveDailyReport;
  saveAllocationEntriesRef.current = saveAllocationEntries;

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

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (viewMode === "calendar") {
      setViewMode("dashboard");
    }
  }, [currentUser, viewMode]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();

        if (dailyReportModalOpen) {
          void saveDailyReportRef.current?.();
          return;
        }

        if (
          viewMode === "entry" &&
          selectedProjectUsesPayItems &&
          draftEntryCount > 0 &&
          !dayIsSubmitted &&
          !savingEntries
        ) {
          void saveAllocationEntriesRef.current?.();
        }
      }

      if (event.key === "Escape" && matrixFullscreenOpen) {
        event.preventDefault();
        setMatrixFullscreenOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [
    currentUser,
    dailyReportModalOpen,
    dayIsSubmitted,
    draftEntryCount,
    matrixFullscreenOpen,
    savingEntries,
    selectedProjectUsesPayItems,
    viewMode
  ]);

  function confirmDiscardUnsavedChanges(actionDescription: string) {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      `You have unsaved changes. Continue to ${actionDescription}? Unsaved pay item inputs, queued images, or daily report edits will be discarded.`
    );
  }

  function clearTransientEntryState() {
    setMobileSelectedPayItemId("");
    cancelEditingEntry();
    clearCrewForms();
    setDraftsByPayItem({});
    clearJobImageQueue();
    clearDailyReportDraftForCurrentContext();
  }

  function changeSelectedProject(nextProjectId: string) {
    if (nextProjectId === selectedProjectId) {
      return;
    }

    if (!confirmDiscardUnsavedChanges("change jobs")) {
      return;
    }

    clearTransientEntryState();
    setSelectedProjectId(nextProjectId);
  }

  function changeWorkDate(nextWorkDate: string) {
    if (nextWorkDate === workDate) {
      return;
    }

    if (!confirmDiscardUnsavedChanges("change dates")) {
      return;
    }

    clearTransientEntryState();
    setWorkDate(nextWorkDate);
  }

  function changeViewMode(nextViewMode: ViewMode) {
    if (nextViewMode === viewMode) {
      return;
    }

    if (nextViewMode !== "entry" && !confirmDiscardUnsavedChanges("leave the entry view")) {
      return;
    }

    if (nextViewMode !== "entry") {
      clearTransientEntryState();
    }

    setViewMode(nextViewMode);
  }

  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");
      const data = (await readApiJson(response)) as AuthResponse;

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
        const response = await fetch("/api/procore/status");
        const data = (await readApiJson(response)) as ProcoreStatusResponse;

        if (data.connected && data.connectedBy) {
          setConnectionStatus(`Procore configured by ${data.connectedBy}`);
        }
      } catch {
        // Cached project data can still load even if the Procore status check fails.
      }
    }

    async function loadProjects() {
      try {
        const response = await fetch("/api/procore/projects");
        const data = (await readApiJson(response)) as ProjectsResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load projects.");
        }

        const sortedProjects = sortProjectsByName(data.projects);
        const lastSelectedProjectId = window.localStorage.getItem(getLastProjectStorageKey(currentUserId));
        const pendingProcoreReturn = readPendingProcoreReturn();
        const nextSelectedProjectId = sortedProjects.some((project) => project.id === lastSelectedProjectId)
          ? lastSelectedProjectId ?? ""
          : sortedProjects[0]?.id ?? "";
        const restoredProjectId =
          pendingProcoreReturn?.projectId && sortedProjects.some((project) => project.id === pendingProcoreReturn.projectId)
            ? pendingProcoreReturn.projectId
            : nextSelectedProjectId;

        setAllProjects(sortedProjects);
        setSelectedProjectId(restoredProjectId);
        if (pendingProcoreReturn?.date) {
          setWorkDate(pendingProcoreReturn.date);
        }
        if (pendingProcoreReturn?.viewMode) {
          setViewMode(pendingProcoreReturn.viewMode);
        }
        if (pendingProcoreReturn?.mobilePayItemId) {
          setMobileSelectedPayItemId(pendingProcoreReturn.mobilePayItemId);
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
        setConnectionStatus(data.syncedAt ? "Cached project data loaded" : "No cached project data");
      } catch (error) {
        setProjectLoadError(error instanceof Error ? error.message : "Unable to load projects.");
      }
    }

    void loadProcoreConnectionStatus();
    void loadProjects();
  }, [currentUser, setDailyReportUploadNotice, setSyncedAt]);

  useEffect(() => {
    if (!currentUser || typeof window === "undefined") {
      setMobileInstallPromptVisible(false);
      return;
    }

    const dismissed = hasDismissedMobileInstallPrompt();
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    const isMobileWidth = window.matchMedia("(max-width: 820px)").matches;

    setMobileInstallPromptVisible(isMobileWidth && !dismissed && !isStandalone);
  }, [currentUser]);

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
    if (!hasUnsavedChanges) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!currentUser || projects.length === 0 || entries.length === 0) {
      return;
    }

    const projectSnapshotsById = new Map(
      projects.map((project) => [
        project.id,
        {
          name: project.name,
          payItemsById: new Map(project.payItems.map((payItem) => [payItem.id, payItem]))
        }
      ])
    );
    let changed = false;
    const entriesWithSnapshots = entries.map((entry) => {
      const projectSnapshot = projectSnapshotsById.get(entry.projectId);
      const payItemSnapshot = projectSnapshot?.payItemsById.get(entry.payItemId);

      if (
        entry.projectName &&
        entry.payItemBudgetedQuantity !== undefined &&
        entry.payItemUnitOfMeasure
      ) {
        return entry;
      }

      const nextProjectName = entry.projectName ?? projectSnapshot?.name;
      const nextPayItemBudgetedQuantity = entry.payItemBudgetedQuantity ?? payItemSnapshot?.budgetedQuantity;
      const nextPayItemUnitOfMeasure = entry.payItemUnitOfMeasure ?? formatPayItemUnitOfMeasure(payItemSnapshot);

      if (
        nextProjectName === entry.projectName &&
        nextPayItemBudgetedQuantity === entry.payItemBudgetedQuantity &&
        nextPayItemUnitOfMeasure === entry.payItemUnitOfMeasure
      ) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        projectName: nextProjectName,
        payItemBudgetedQuantity: nextPayItemBudgetedQuantity,
        payItemUnitOfMeasure: nextPayItemUnitOfMeasure
      };
    });

    if (changed) {
      setEntries(entriesWithSnapshots);
    }
  }, [currentUser, entries, projects]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem("procore-sync-log", JSON.stringify(syncLog));
  }, [currentUser, syncLog]);

  async function logout() {
    if (!confirmDiscardUnsavedChanges("sign out")) {
      return;
    }

    await fetch("/api/auth/logout", {
      method: "POST"
    });

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

    const confirmed = window.confirm(
      [
        "Clear staging daily data?",
        "",
        "This will permanently remove daily pay item entries, submitted/draft day statuses, daily notes, daily reports, daily report upload status, and all crew members/crew project assignments.",
        "",
        "It will keep user profiles/passwords, cached projects, cached pay items, sync state/log, project blacklist, and My Projects."
      ].join("\n")
    );

    if (!confirmed) {
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
          ? "Staging data cleared. Users, cached projects/pay items, sync state, blacklist, and My Projects were preserved."
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

  async function clearCachedProjectData() {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineAction((message) => {
      setAdminMaintenanceNotice({ message, status: "error" });
    })) {
      return;
    }

    const confirmed = window.confirm(
      [
        "Clear cached jobs and pay items?",
        "",
        "This will permanently remove the currently cached Procore-sourced jobs/pay items and the old project cache fallback.",
        "",
        "It will keep users, passwords, daily entries, daily reports, crew records, sync log, project blacklist, and My Projects."
      ].join("\n")
    );

    if (!confirmed) {
      return;
    }

    setClearingProjectCache(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await clearDatabaseProjectCache();
      const cleared = data.cleared;
      const projectCount = cleared?.projects ?? 0;
      const payItemCount = cleared?.payItems ?? 0;

      setAllProjects([]);
      setSelectedProjectId("");
      resetProjectSyncState();
      setDraftsByPayItem({});
      setProjectLoadError("");
      setConnectionStatus("No cached project data");
      setAdminMaintenanceNotice({
        message: `Cached project data cleared. Removed ${projectCount} job${projectCount === 1 ? "" : "s"} and ${payItemCount} pay item${payItemCount === 1 ? "" : "s"}. Sync from NetSuite to reload jobs.`,
        status: "success"
      });
    } catch (error) {
      setAdminMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to clear cached project data.",
        status: "error"
      });
    } finally {
      setClearingProjectCache(false);
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

  function openDailyEntry(projectId: string, date: string) {
    if (!projects.some((project) => project.id === projectId)) {
      return;
    }

    if (
      (projectId !== selectedProject?.id || date !== workDate || viewMode !== "entry") &&
      !confirmDiscardUnsavedChanges("open that day")
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

  function connectProcore(intent: PendingProcoreReturn["intent"] = "connect") {
    if (shouldBlockOfflineAction(setProjectLoadError)) {
      return;
    }

    if (!confirmDiscardUnsavedChanges("connect to Procore")) {
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
    setDraftsByPayItem((current) => {
      const draft = getExistingDraft(current[payItemId], payItemId, visibleEntries);

      return {
        ...current,
        [payItemId]: normalizeDraftCrewHours({
          ...draft,
          [field]: value
        })
      };
    });
  }

  function toggleDraftCrewMember(payItemId: string, crewMemberId: string, checked: boolean) {
    setEntryNotice("");
    setDraftsByPayItem((current) => {
      const draft = getExistingDraft(current[payItemId], payItemId, visibleEntries);
      const crewMemberIds = checked
        ? Array.from(new Set([...draft.crewMemberIds, crewMemberId]))
        : draft.crewMemberIds.filter((id) => id !== crewMemberId);
      const crewHours = { ...draft.crewHours };

      if (!checked) {
        delete crewHours[crewMemberId];
      }

      return {
        ...current,
        [payItemId]: normalizeDraftCrewHours({
          ...draft,
          crewMemberIds,
          crewHours
        })
      };
    });
  }

  function updateDraftCrewHours(payItemId: string, crewMemberId: string, value: string) {
    setEntryNotice("");
    setDraftsByPayItem((current) => {
      const draft = getExistingDraft(current[payItemId], payItemId, visibleEntries);

      return {
        ...current,
        [payItemId]: normalizeDraftCrewHours({
          ...draft,
          crewHours: {
            ...draft.crewHours,
            [crewMemberId]: value
          }
        })
      };
    });
  }

  function splitDraftCrewHoursEvenly(payItemId: string) {
    setDraftsByPayItem((current) => {
      const draft = getExistingDraft(current[payItemId], payItemId, visibleEntries);

      return {
        ...current,
        [payItemId]: splitCrewHoursEvenly(draft)
      };
    });
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
      <main className="app-shell centered-shell">
        {passwordResetOpen ? (
          <form
            className="panel auth-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPasswordReset();
            }}
          >
            <h1>Reset Password</h1>
            <p className="field-note">Enter the reset code provided by an admin.</p>
            <div className="field-group">
              <label htmlFor="reset-user-id">User ID</label>
              <input
                id="reset-user-id"
                value={passwordResetForm.userId}
                onChange={(event) => updatePasswordResetForm("userId", event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="reset-token">Reset Code</label>
              <input
                id="reset-token"
                value={passwordResetForm.token}
                onChange={(event) => updatePasswordResetForm("token", event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="reset-new-password">New Password</label>
              <input
                autoComplete="new-password"
                id="reset-new-password"
                type="password"
                value={passwordResetForm.newPassword}
                onChange={(event) => updatePasswordResetForm("newPassword", event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="reset-confirm-password">Confirm New Password</label>
              <input
                autoComplete="new-password"
                id="reset-confirm-password"
                type="password"
                value={passwordResetForm.confirmPassword}
                onChange={(event) => updatePasswordResetForm("confirmPassword", event.target.value)}
              />
            </div>
            {passwordResetNotice ? (
              <div className={passwordResetNotice.status === "error" ? "inline-alert" : "success-alert"}>
                {passwordResetNotice.message}
              </div>
            ) : null}
            <button className="primary-button" disabled={resettingPassword} type="submit">
              {resettingPassword ? "Resetting..." : "Reset password"}
            </button>
            <button className="secondary-button" disabled={resettingPassword} onClick={closePasswordReset} type="button">
              Back to sign in
            </button>
          </form>
        ) : (
          <form
            className="panel auth-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <h1>Crew Time Allocation</h1>
            <p className="field-note">Sign in to enter daily pay item production.</p>
            <div className="field-group">
              <label htmlFor="user-id">User ID</label>
              <input id="user-id" value={loginUserId} onChange={(event) => setLoginUserId(event.target.value)} />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </div>
            {loginError ? <div className="inline-alert">{loginError}</div> : null}
            <button className="primary-button" type="submit">
              Sign in
            </button>
            <button className="text-button auth-text-button" onClick={openPasswordReset} type="button">
              Forgot password?
            </button>
          </form>
        )}
      </main>
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
      clearingProjectCache={clearingProjectCache}
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
      onClearProjectCache={clearCachedProjectData}
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
      <header className="top-bar">
        <div className="brand-block">
          <NextImage
            alt="Chinchor Electric Inc."
            className="brand-logo"
            height={908}
            priority
            src="/chinchor-logo.png"
            width={3310}
          />
          <div className="brand-copy">
            <h1>Crew Time Allocation</h1>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {userCanAccessDashboard ? (
            <button
              className={viewMode === "dashboard" ? "tab-button active" : "tab-button"}
              onClick={() => changeViewMode("dashboard")}
              type="button"
            >
              <LayoutDashboard aria-hidden="true" size={16} />
              Dashboard
            </button>
          ) : null}
          <button
            className={viewMode === "entry" ? "tab-button active" : "tab-button"}
            onClick={() => changeViewMode("entry")}
            type="button"
          >
            <Edit3 aria-hidden="true" size={16} />
            Entry
          </button>
          {canAccessReports(currentUser) ? (
            <button
              className={viewMode === "reports" ? "tab-button active" : "tab-button"}
              onClick={() => changeViewMode("reports")}
              type="button"
            >
              <BarChart3 aria-hidden="true" size={16} />
              Reports
            </button>
          ) : null}
        </nav>
        <div className="header-actions">
          <details className="desktop-header-menu">
            <summary>
              <span>
                <strong>{formatUserName(currentUser)}</strong>
                <small>{formatRole(currentUser.role)}</small>
              </span>
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <div className="desktop-header-menu-body">
              <IconLabel icon={CheckCircle2} text={connectionStatus} />
              <button className="secondary-button" onClick={openChangePasswordModal} type="button">
                <KeyRound aria-hidden="true" size={18} />
                Change Password
              </button>
              <button className="secondary-button" onClick={logout} type="button">
                <LogOut aria-hidden="true" size={18} />
                Sign out
              </button>
            </div>
          </details>
        </div>
        <details className="mobile-header-menu">
          <summary>
            <span>
              <strong>{formatUserName(currentUser)}</strong>
              <small>{formatRole(currentUser.role)}</small>
            </span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className="mobile-header-menu-body">
            <IconLabel icon={CheckCircle2} text={connectionStatus} />
            <button className="secondary-button" onClick={openChangePasswordModal} type="button">
              <KeyRound aria-hidden="true" size={18} />
              Change Password
            </button>
            <button className="secondary-button" onClick={logout} type="button">
              <LogOut aria-hidden="true" size={18} />
              Sign out
            </button>
          </div>
        </details>
      </header>

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

      {mobileInstallPromptVisible ? (
        <MobileInstallPrompt
          onDismiss={() => {
            dismissMobileInstallPrompt();
            setMobileInstallPromptVisible(false);
          }}
        />
      ) : null}

      <NetworkStatusBanner status={networkStatus} />

      {matrixFullscreenOpen && selectedProject && selectedProjectUsesPayItems ? (
        <div className="modal-backdrop matrix-fullscreen-backdrop" role="presentation">
          <div aria-modal="true" className="modal-panel matrix-fullscreen-panel" role="dialog">
            <div className="modal-heading matrix-fullscreen-heading">
              <div>
                <h2>Pay Item Entry</h2>
                <span>
                  {selectedProject.name} - {formatDate(workDate)}
                </span>
              </div>
              <button
                aria-label="Close expanded pay item matrix"
                className="icon-button"
                onClick={() => setMatrixFullscreenOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="matrix-fullscreen-toolbar">
              <span className="field-note">
                {draftEntryCount} row{draftEntryCount === 1 ? "" : "s"} ready to save
              </span>
            </div>
            <div className="matrix-fullscreen-body">
              {displayedPayItems.length > 0 ? (
                <PayItemMatrix
                  ariaLabel="Expanded pay item entry matrix"
                  crewMembers={selectedProjectCrewMembers}
                  dayIsSubmitted={dayIsSubmitted}
                  draftsByPayItem={draftsByPayItem}
                  payItems={displayedPayItems}
                  remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
                  savedEntries={visibleEntries}
                  variant="fullscreen"
                  onCrewHoursChange={updateDraftCrewHours}
                  onCrewToggle={toggleDraftCrewMember}
                  onDraftChange={updateDraft}
                  onSplitEvenly={splitDraftCrewHoursEvenly}
                />
              ) : null}
            </div>
            <div className="matrix-fullscreen-actions">
              <button
                className="secondary-button"
                disabled={Object.keys(draftsByPayItem).length === 0 || dayIsSubmitted || savingEntries}
                onClick={clearDraftInputs}
                type="button"
              >
                Clear draft inputs
              </button>
              <button
                className="primary-button prominent-action"
                disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
                onClick={saveAllocationEntries}
                type="button"
              >
                {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
                {savingEntries ? "Saving..." : "Save entries"}
              </button>
            </div>
            {entryNotice ? <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div> : null}
          </div>
        </div>
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
            <div className="panel workflow-panel" ref={payItemEntryPanelRef}>
              <div className="panel-heading">
                <h2 className="workflow-title">
                  <span className="workflow-step">1</span>
                  Pay Item Entry
                </h2>
                <div className="panel-heading-actions">
                  <button
                    className="secondary-button matrix-expand-button"
                    disabled={!selectedProject?.payItems.length || displayedPayItems.length === 0}
                    onClick={() => setMatrixFullscreenOpen(true)}
                    type="button"
                  >
                    <Maximize2 aria-hidden="true" size={18} />
                    Expand Matrix
                  </button>
                </div>
              </div>
              {!selectedProject?.payItems.length ? (
                <EmptyState title="No pay items returned">This job can still use daily reports and image uploads.</EmptyState>
              ) : null}
              {selectedProject?.payItems.length && displayedPayItems.length > 0 ? (
                <PayItemMatrix
                  ariaLabel="Pay item entry matrix"
                  crewMembers={selectedProjectCrewMembers}
                  dayIsSubmitted={dayIsSubmitted}
                  draftsByPayItem={draftsByPayItem}
                  payItems={displayedPayItems}
                  remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
                  savedEntries={visibleEntries}
                  onCrewHoursChange={updateDraftCrewHours}
                  onCrewToggle={toggleDraftCrewMember}
                  onDraftChange={updateDraft}
                  onSplitEvenly={splitDraftCrewHoursEvenly}
                />
              ) : null}
              {displayedPayItems.length && mobileSelectedPayItem ? (
                <MobilePayItemEntry
                  dayIsSubmitted={dayIsSubmitted}
                  draftsByPayItem={draftsByPayItem}
                  payItems={displayedPayItems}
                  remainingQuantity={remainingQuantitiesByPayItem[mobileSelectedPayItem.id] ?? mobileSelectedPayItem.budgetedQuantity}
                  savedEntries={visibleEntries}
                  selectedPayItem={mobileSelectedPayItem}
                  crewMembers={selectedProjectCrewMembers}
                  onDraftChange={updateDraft}
                  onCrewHoursChange={updateDraftCrewHours}
                  onCrewToggle={toggleDraftCrewMember}
                  onSplitEvenly={splitDraftCrewHoursEvenly}
                  onSelectedPayItemChange={setMobileSelectedPayItemId}
                  onCrewEditorClose={scrollPayItemEntryPanelToTop}
                />
              ) : null}
              {selectedProject?.payItems.length ? (
                <div className="matrix-footer">
                  <span className="field-note">
                    {draftEntryCount} row{draftEntryCount === 1 ? "" : "s"} ready to save
                  </span>
                  <button
                    className="secondary-button"
                    disabled={Object.keys(draftsByPayItem).length === 0 || dayIsSubmitted || savingEntries}
                    onClick={clearDraftInputs}
                    type="button"
                  >
                    Clear draft inputs
                  </button>
                  <button
                    className="primary-button save-button prominent-action"
                    disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
                    onClick={saveAllocationEntries}
                    type="button"
                  >
                    {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
                    {savingEntries ? "Saving..." : "Save entries"}
                  </button>
                </div>
              ) : null}
              {entryNotice ? <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div> : null}
            </div>

            <div className="panel workflow-panel">
              <div className="panel-heading">
                <h2 className="workflow-title">
                  <span className="workflow-step">2</span>
                  {dayIsSubmitted ? "Submitted Day Summary" : "Review & Submit"}
                </h2>
                {!dayIsSubmitted ? (
                  <button
                    className="primary-button prominent-action"
                    disabled={visibleEntries.length === 0 || submittingDay || savingEntries}
                    onClick={submitDay}
                    type="button"
                  >
                    {submittingDay ? <InlineSpinner /> : <Send aria-hidden="true" size={18} />}
                    {submittingDay ? "Submitting..." : "Submit day"}
                  </button>
                ) : null}
              </div>
              <div className="daily-actions">
                <span className="field-note">
                  {dayIsSubmitted && currentDaySubmission.submittedByName && currentDaySubmission.submittedAt
                    ? `Submitted by ${currentDaySubmission.submittedByName} on ${formatDate(currentDaySubmission.submittedAt)}`
                    : "Draft day"}
                </span>
                {dayIsSubmitted && currentUser.role === "admin" ? (
                  <div className="admin-day-actions">
                    <button className="secondary-button" disabled={reopeningDay || deletingSubmittedDay} onClick={reopenSubmittedDay} type="button">
                      {reopeningDay ? <InlineSpinner /> : null}
                      {reopeningDay ? "Reopening..." : "Reopen day"}
                    </button>
                    <button className="secondary-button" disabled={reopeningDay || deletingSubmittedDay} onClick={deleteSubmittedDay} type="button">
                      {deletingSubmittedDay ? <InlineSpinner /> : <Trash2 aria-hidden="true" size={18} />}
                      {deletingSubmittedDay ? "Deleting..." : "Delete submitted day"}
                    </button>
                  </div>
                ) : null}
              </div>
              {dayIsSubmitted ? (
                <SubmittedDayReview
                  crewSummaryRows={crewSummaryRows}
                  dailyReport={currentDailyReport}
                  entries={visibleEntries}
                  procoreStatus={currentDailyReportProcoreStatus}
                  showPayItemEntries={selectedProjectUsesPayItems}
                  totalHours={totalHours}
                />
              ) : (
                <div className="entry-list">
                  {visibleEntries.length === 0 ? (
                    <EmptyState title="No saved pay item rows">
                      Saved rows for this job and date will appear here before submission.
                    </EmptyState>
                  ) : (
                    visibleEntries.map((entry) => (
                      <div className="entry-row" key={entry.id}>
                        <span>
                          <strong>{entry.payItemCode}</strong> {entry.payItemName}
                        </span>
                        {editingEntry?.entryId === entry.id ? (
                          <>
                            <input
                              aria-label={`Edit hours for ${entry.payItemCode}`}
                              className="compact-input number-entry"
                              min="0"
                              placeholder="Hours"
                              step="0.25"
                              type="number"
                              value={editingEntry.hours}
                              onChange={(event) => updateEditingEntry("hours", event.target.value)}
                              onWheel={(event) => event.currentTarget.blur()}
                            />
                            <input
                              aria-label={`Edit quantity for ${entry.payItemCode}`}
                              className="compact-input number-entry"
                              min="0"
                              placeholder="Quantity"
                              step="0.01"
                              type="number"
                              value={editingEntry.quantity}
                              onChange={(event) => updateEditingEntry("quantity", event.target.value)}
                              onWheel={(event) => event.currentTarget.blur()}
                            />
                            <button className="secondary-button" disabled={savingEditedEntry} onClick={saveEditedEntry} type="button">
                              {savingEditedEntry ? <InlineSpinner /> : null}
                              {savingEditedEntry ? "Saving..." : "Save"}
                            </button>
                          </>
                        ) : (
                          <>
                            <span>{entry.hours.toFixed(2)} hrs</span>
                            <span>{entry.quantityCompleted.toFixed(2)} qty</span>
                            <span className="entry-crew">{formatEntryCrew(entry)}</span>
                            <button
                              aria-label={`Edit ${entry.payItemCode}`}
                              className="icon-button"
                              disabled={dayIsSubmitted}
                              onClick={() => startEditingEntry(entry)}
                              type="button"
                            >
                              <Edit3 aria-hidden="true" size={17} />
                            </button>
                          </>
                        )}
                        <button
                          aria-label={`Remove ${entry.payItemCode}`}
                          className="icon-button"
                          disabled={dayIsSubmitted || removingEntryId === entry.id}
                          onClick={() => removeEntry(entry.id)}
                          type="button"
                        >
                          {removingEntryId === entry.id ? <InlineSpinner /> : <Trash2 aria-hidden="true" size={17} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
              </>
            ) : null}

            {selectedProjectUsesPayItems ? (
              <div className="workflow-section-heading">
                <h2 className="workflow-title">
                  <span className="workflow-step">3</span>
                  Daily Wrap-Up
                </h2>
              </div>
            ) : null}

            <input
              ref={jobImageInputRef}
              accept="image/*"
              className="job-image-file-input"
              multiple
              type="file"
              onChange={(event) => void addJobImages(event.target.files)}
            />
            {!showDailyReportDetails || !showJobImageDetails ? (
              <div className="wrap-up-action-strip" aria-label="Daily wrap-up actions">
                {!showDailyReportDetails ? (
                  <button
                    className="primary-button prominent-action"
                    disabled={!selectedProject}
                    onClick={openDailyReportModal}
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={18} />
                    Create Daily Report
                  </button>
                ) : null}
                {!showJobImageDetails ? (
                  <button
                    className="secondary-button"
                    disabled={!selectedProject || uploadingJobImages || jobImageDailyLimitReached}
                    onClick={() => jobImageInputRef.current?.click()}
                    type="button"
                  >
                    <UploadCloud aria-hidden="true" size={18} />
                    Add Images
                  </button>
                ) : null}
              </div>
            ) : null}

            {showDailyReportDetails ? (
            <div className="panel">
              <div className="panel-heading">
                <h2>Daily Report</h2>
                <div className="panel-heading-actions">
                  <button
                    className={!currentDailyReport ? "primary-button prominent-action" : "secondary-button"}
                    disabled={!selectedProject}
                    onClick={openDailyReportModal}
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={18} />
                    {currentDailyReport ? "Edit Daily Report" : "Create Daily Report"}
                  </button>
                  {currentDailyReport ? (
                    <button
                      className="secondary-button"
                      disabled={!selectedProject || downloadingDailyReportPdf}
                      onClick={downloadDailyReportPdf}
                      type="button"
                    >
                      {downloadingDailyReportPdf ? <InlineSpinner /> : <Download aria-hidden="true" size={18} />}
                      {downloadingDailyReportPdf ? "Downloading..." : "Download PDF"}
                    </button>
                  ) : null}
                  {currentDailyReport ? (
                    <button
                      className={dailyReportNeedsUpload ? "primary-button prominent-action" : "secondary-button"}
                      disabled={!selectedProject || uploadingDailyReport}
                      onClick={uploadDailyReportToProcoreDocuments}
                      type="button"
                    >
                      {uploadingDailyReport ? <InlineSpinner /> : <UploadCloud aria-hidden="true" size={18} />}
                      {uploadingDailyReport ? "Uploading..." : "Upload to Procore"}
                    </button>
                  ) : null}
                </div>
              </div>
              {currentDailyReport ? (
                <div className="daily-report-summary">
                  <div className="daily-report-summary-card">
                    <span>Status</span>
                    <strong>Saved</strong>
                  </div>
                  <div className="daily-report-summary-card">
                    <span>Procore Upload</span>
                    <DailyReportProcoreStatusValue status={currentDailyReportProcoreStatus} />
                  </div>
                  <div className="daily-report-summary-card">
                    <span>Updated</span>
                    <strong>{new Date(currentDailyReport.updatedAt).toLocaleString()}</strong>
                  </div>
                  {selectedProjectUsesTwoSeriesDailyReport ? (
                    <div className="daily-report-summary-card daily-report-summary-secondary">
                      <span>Template</span>
                      <strong>Field Report</strong>
                    </div>
                  ) : (
                    <>
                      <div className="daily-report-summary-card daily-report-summary-secondary">
                        <span>Inspector Quantities</span>
                        <strong>{formatYesNoAnswer(currentDailyReport.quantitiesTurnedIn)}</strong>
                      </div>
                      <div className="daily-report-summary-card daily-report-summary-secondary">
                        <span>Incidents</span>
                        <strong>{formatYesNoAnswer(currentDailyReport.incidentOccurred)}</strong>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              {currentDailyReport ? (
                <div className="daily-report-upload-status">
                  {dailyReportUploadNotice ? (
                    <div className={dailyReportUploadNotice.status === "error" ? "inline-alert" : "success-alert"}>
                      {dailyReportUploadNotice.message}
                    </div>
                  ) : (
                    <div
                      className={
                        currentDailyReportProcoreStatus.className === "failed"
                          ? "inline-alert"
                          : currentDailyReportProcoreStatus.className === "uploaded"
                            ? "success-alert"
                            : "field-note"
                      }
                    >
                      {currentDailyReportProcoreStatus.message}
                    </div>
                  )}
                </div>
              ) : null}
              {dailyReportUploadRetryQueue.length > 0 ? (
                <div className="daily-report-retry-queue">
                  <div className="retry-queue-heading">
                    <h3>Upload Retry Queue</h3>
                    <span>
                      {dailyReportUploadRetryQueue.length} failed upload
                      {dailyReportUploadRetryQueue.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="retry-queue-list">
                    {dailyReportUploadRetryQueue.map((item) => (
                      <div className="retry-queue-row" key={item.dayKey}>
                        <div>
                          <strong>{item.project.name}</strong>
                          <span>
                            {formatDate(item.date)}
                            {item.upload.attemptedAt ? ` - last tried ${new Date(item.upload.attemptedAt).toLocaleString()}` : ""}
                          </span>
                          <p>{item.upload.error ?? "Upload failed."}</p>
                        </div>
                        <div className="retry-queue-actions">
                          <button className="secondary-button" onClick={() => openDailyEntry(item.project.id, item.date)} type="button">
                            Open day
                          </button>
                          <button
                            className="primary-button"
                            disabled={retryingDailyReportUploadKey === item.dayKey}
                            onClick={() => retryDailyReportUpload(item.dayKey)}
                            type="button"
                          >
                            <UploadCloud aria-hidden="true" size={18} />
                            {retryingDailyReportUploadKey === item.dayKey ? "Retrying..." : "Retry upload"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            ) : null}

            {showJobImageDetails ? (
            <div className="panel job-images-panel">
              <div className="panel-heading">
                <h2>Job Images</h2>
                <div className="panel-heading-actions">
                  <button
                    className="secondary-button"
                    disabled={!selectedProject || uploadingJobImages || jobImageDailyLimitReached}
                    onClick={() => jobImageInputRef.current?.click()}
                    type="button"
                  >
                    <UploadCloud aria-hidden="true" size={18} />
                    Add Images
                  </button>
                  <button
                    className={queuedJobImages.length > 0 ? "primary-button prominent-action" : "primary-button"}
                    disabled={!selectedProject || queuedJobImages.length === 0 || uploadingJobImages || jobImageDailyLimitReached}
                    onClick={uploadQueuedJobImages}
                    type="button"
                  >
                    {uploadingJobImages ? <InlineSpinner /> : <UploadCloud aria-hidden="true" size={18} />}
                    {uploadingJobImages ? "Uploading..." : "Upload Images to Procore"}
                  </button>
                </div>
              </div>
              <div className="field-note job-image-help-text">
                {uploadedJobImageCount} of {JOB_IMAGE_DAILY_UPLOAD_LIMIT} images uploaded for this job/day. Selected images stay in a
                temporary queue until they are uploaded to Procore.
              </div>
              {jobImageNotice ? (
                <div className={jobImageNotice.status === "error" ? "inline-alert job-image-notice" : "success-alert job-image-notice"}>
                  {jobImageNotice.message}
                </div>
              ) : null}
              {jobImageQueue.length > 0 ? (
                <div className="job-image-queue">
                  <div className="job-image-section-heading">
                    <h3>Temporary Queue</h3>
                    <div className="job-image-section-actions">
                      {failedQueuedJobImages.length > 0 ? (
                        <button
                          className="secondary-button compact-action"
                          disabled={uploadingJobImages || jobImageDailyLimitReached}
                          onClick={() => void retryFailedJobImages()}
                          type="button"
                        >
                          <RotateCcw aria-hidden="true" size={16} />
                          Retry failed
                        </button>
                      ) : null}
                      {jobImageQueue.some((item) => item.status === "uploaded") ? (
                        <button className="text-button" onClick={clearUploadedJobImagesFromQueue} type="button">
                          Clear uploaded
                        </button>
                      ) : null}
                      <button className="text-button" disabled={uploadingJobImages} onClick={clearJobImageQueue} type="button">
                        Clear queue
                      </button>
                    </div>
                  </div>
                  <div className="job-image-grid">
                    {jobImageQueue.map((item) => (
                      <div className={`job-image-card ${item.status}`} key={item.id}>
                        <div
                          aria-label={item.originalName}
                          className="job-image-preview"
                          role="img"
                          style={{ backgroundImage: `url(${item.previewUrl})` }}
                        />
                        <div className="job-image-card-body">
                          <div>
                            <strong>{item.originalName}</strong>
                            <span>{formatFileSize(item.size)}</span>
                          </div>
                          <span className={`job-image-status ${item.status}`}>{formatJobImageQueueStatus(item)}</span>
                          <label className="job-image-caption-field">
                            <span>Caption</span>
                            <input
                              disabled={item.status === "uploading" || item.status === "uploaded"}
                              maxLength={160}
                              placeholder="Optional photo caption"
                              value={item.caption}
                              onChange={(event) => updateJobImageCaption(item.id, event.target.value)}
                            />
                          </label>
                          {item.uploadedFileName ? <span className="job-image-meta">{item.uploadedFileName}</span> : null}
                          {item.error ? <p>{item.error}</p> : null}
                        </div>
                        <button
                          aria-label={`Remove ${item.originalName}`}
                          className="icon-button"
                          disabled={item.status === "uploading"}
                          onClick={() => removeJobImageFromQueue(item.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {failedQueuedJobImages.length > 0 ? (
                    <div className="job-image-retry-queue">
                      <div>
                        <strong>{failedQueuedJobImages.length} failed image{failedQueuedJobImages.length === 1 ? "" : "s"} ready to retry</strong>
                        <span>Failed images stay in this temporary queue until you retry them, remove them, or refresh the page.</span>
                      </div>
                      <button
                        className="primary-button"
                        disabled={uploadingJobImages || jobImageDailyLimitReached}
                        onClick={() => void retryFailedJobImages()}
                        type="button"
                      >
                        <RotateCcw aria-hidden="true" size={17} />
                        Retry failed uploads
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={jobImageHistoryExpanded ? "job-image-history expanded" : "job-image-history"}>
                <button
                  aria-expanded={jobImageHistoryExpanded}
                  className="job-image-section-heading job-image-history-toggle"
                  onClick={() => setJobImageHistoryExpanded((current) => !current)}
                  type="button"
                >
                  <h3>Uploaded Images</h3>
                  <span>
                    {loadingJobImageUploads
                      ? "Loading..."
                      : `${uploadedJobImageCount}/${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded`}
                  </span>
                  <ChevronDown aria-hidden="true" className="job-image-history-chevron" size={18} />
                </button>
                {jobImageHistoryExpanded ? (
                  <>
                    {failedJobImageUploads.length > 0 ? (
                      <div className="field-note">
                        {failedJobImageUploads.length} failed upload attempt{failedJobImageUploads.length === 1 ? "" : "s"} recorded. If the
                        image is no longer in the temporary queue, reselect the original photo to retry it.
                      </div>
                    ) : null}
                    {currentJobImageUploads.length > 0 ? (
                      <div className="job-image-history-list">
                        {currentJobImageUploads.map((upload) => (
                          <div className={`job-image-history-row ${upload.status}`} key={upload.id}>
                            <div>
                              <strong>{upload.fileName}</strong>
                              <span>
                                {upload.status === "uploaded" ? "Uploaded" : "Failed"}
                                {upload.uploadedAt || upload.attemptedAt
                                  ? ` ${new Date(upload.uploadedAt ?? upload.attemptedAt ?? "").toLocaleString()}`
                                  : ""}
                                {upload.uploadedByName ? ` by ${upload.uploadedByName}` : ""}
                                {upload.fileSizeBytes ? ` - ${formatFileSize(upload.fileSizeBytes)}` : ""}
                              </span>
                              {upload.originalFileName ? <span>Original: {upload.originalFileName}</span> : null}
                              {upload.caption ? <span>Caption: {upload.caption}</span> : null}
                              {upload.error ? <p>{upload.error}</p> : null}
                            </div>
                            {upload.folderUrl ? (
                              <a className="secondary-button" href={upload.folderUrl} rel="noreferrer" target="_blank">
                                <ExternalLink aria-hidden="true" size={17} />
                                Open Folder
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No image upload history">
                        Uploaded or failed image attempts for this job and date will appear here.
                      </EmptyState>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            ) : null}

            <div className="mobile-sticky-action-bar" aria-label="Entry actions">
              {selectedProjectUsesPayItems ? (
                <>
                  <button
                    className="primary-button"
                    disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
                    onClick={saveAllocationEntries}
                    type="button"
                  >
                    {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={17} />}
                    {savingEntries ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={dayIsSubmitted || visibleEntries.length === 0 || submittingDay || savingEntries}
                    onClick={submitDay}
                    type="button"
                  >
                    {submittingDay ? <InlineSpinner /> : <Send aria-hidden="true" size={17} />}
                    {submittingDay ? "Submitting..." : "Submit"}
                  </button>
                </>
              ) : null}
              <button className="secondary-button" disabled={!selectedProject} onClick={openDailyReportModal} type="button">
                <Edit3 aria-hidden="true" size={17} />
                Daily
              </button>
            </div>
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
    </main>
  );
}
