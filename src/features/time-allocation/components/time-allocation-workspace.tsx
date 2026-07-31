"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Maximize2,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  WifiOff,
  type LucideIcon,
  X
} from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { todayInputValue } from "@/lib/date";
import { canAccessReports, getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import {
  getDailyReportTemplateForProject,
  isTwoSeriesProject
} from "@/lib/daily-report-templates";
import {
  AppLoadingShell,
  EmptyState,
  InlineSpinner,
  PageHeader
} from "@/features/time-allocation/components/workspace-primitives";
import { DailyStatusStrip } from "@/features/time-allocation/components/daily-status-strip";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import { MyJobsManager } from "@/features/time-allocation/components/my-jobs-manager";
import { ReportsView } from "@/features/time-allocation/components/reports/reports-view";
import {
  DailyReportModal,
  DailyReportProcoreStatusValue
} from "@/features/time-allocation/components/daily-report/daily-report-ui";
import {
  MobilePayItemEntry,
  PayItemMatrix
} from "@/features/time-allocation/components/entry/pay-item-entry-matrix";
import {
  addDatabaseCrewMemberToProject,
  clearDatabaseProjectCache,
  clearDatabaseStagingOperationalData,
  deleteDatabaseDailyReportUpload,
  deleteDatabaseDayEntries,
  deleteDatabaseDaySubmission,
  deleteDatabaseEntry,
  loadAssignableFieldUsers,
  loadDatabaseCrewData,
  loadDatabaseDailyReportData,
  loadDatabaseDayRecords,
  loadDatabaseEntries,
  loadDatabaseJobImageUploads,
  loadDatabaseNetSuiteVendors,
  loadDatabaseProjectControls,
  mergeDatabaseCrewMembers,
  postProjectsWithTimeout,
  readApiError,
  readApiJson,
  readDownloadFileName,
  removeDatabaseCrewMemberFromProject,
  saveDatabaseDailyReport,
  saveDatabaseDailyReportUpload,
  saveDatabaseDaySubmission,
  saveDatabaseEntries,
  saveDatabaseMyJobs,
  saveDatabaseNetSuiteVendorBlacklist,
  saveDatabaseProjectArchive,
  saveDatabaseProjectBlacklist,
  saveDatabaseProjectFieldUsers,
  saveDatabaseSyncLogEntry,
  syncDatabaseNetSuiteVendors,
  updateDatabaseCrewMember
} from "@/features/time-allocation/lib/api-client";
import {
  calculateDailyReportTotalHours,
  createEmptyDailyReportAnswers,
  createEmptyDailyReportPayItemRows,
  dailyReportEmployeeRowHasContent,
  dailyReportPayItemRowHasContent,
  findPreviousDailyReportWithCrewTime,
  formatDailyReportValidationMessage,
  formatYesNoAnswer,
  getDailyReportAnswers,
  getDailyReportEmployeeTotalHours,
  isDailyReportTimeField,
  normalizeDailyReportAnswersForSave,
  normalizeDailyReportEmployeeRows,
  normalizeDailyReportItsfmRows,
  normalizeDailyReportPayItemRows,
  normalizeDailyReportTimeInput,
  sanitizeDailyReportTimeInput,
  validateDailyReportAnswers
} from "@/features/time-allocation/lib/daily-report-helpers";
import { downloadBlob, openDatePicker } from "@/features/time-allocation/lib/browser-actions";
import {
  buildDailyReportConflictSignature,
  buildDaySubmissionConflictSignature,
  buildEntryConflictSignature
} from "@/features/time-allocation/lib/conflict-helpers";
import { exportEntriesToCsv } from "@/features/time-allocation/lib/entry-csv-export";
import {
  buildCrewDirectoryFromProjects,
  buildSharedAppState,
  mergeCrewDirectories,
  normalizeSharedAppState,
  readLocalSharedAppState,
  writeLocalSharedAppState
} from "@/features/time-allocation/lib/app-state-storage";
import {
  clearAllDailyReportAutosaveDrafts,
  clearDailyReportAutosaveDraft,
  clearPendingDailyReportAutosaveTimeout,
  clearPendingProcoreReturn,
  dismissMobileInstallPrompt,
  getLastProjectStorageKey,
  hasDismissedMobileInstallPrompt,
  readDailyReportAutosaveDraft,
  readPendingProcoreReturn,
  writeDailyReportAutosaveDraft,
  writePendingProcoreReturn,
  type PendingProcoreReturn,
  type ViewMode
} from "@/features/time-allocation/lib/client-storage";
import {
  addDaysToInputDate,
  buildDailyReportUploadFileName,
  formatDate,
  formatWeekDayLabel,
  formatWeekRange,
  getDayKey,
  getWeekDates,
  getWeekStart,
  parseDayKey
} from "@/features/time-allocation/lib/date-helpers";
import {
  buildEntryDayKeySet,
  buildProcoreDocumentsFolderUrl,
  getDailyReportCalendarStatus,
  getDailyReportProcoreStatus,
  getHasDailyEntryActivity,
  getProjectEntryCalendarStatus,
  getProjectWorkTypeLabel
} from "@/features/time-allocation/lib/status-helpers";
import {
  buildRemainingQuantitiesByPayItem,
  formatPayItemQuantity,
  formatPayItemUnitOfMeasure
} from "@/features/time-allocation/lib/pay-item-helpers";
import {
  entryNoticeIsCrewRelated,
  getEntryNoticeClassName
} from "@/features/time-allocation/lib/notice-helpers";
import {
  createEmptyAdminUserForm,
  createEmptyChangePasswordForm,
  createEmptyPasswordResetForm,
  formatRole,
  formatUserName,
  getDefaultViewModeForUser,
  type AdminUserFormState,
  type ChangePasswordFormState,
  type PasswordResetFormState,
  type PasswordResetResponse
} from "@/features/time-allocation/lib/auth-ui-helpers";
import {
  chunkJobImagesForUpload,
  formatFileSize,
  formatJobImageQueueStatus,
  JOB_IMAGE_CLIENT_BATCH_DELAY_MS,
  JOB_IMAGE_DAILY_UPLOAD_LIMIT,
  MAX_JOB_IMAGE_QUEUE_ITEMS,
  mergeJobImageUploads,
  prepareJobImageFileForUpload,
  uploadClientId,
  waitForClientDelay
} from "@/features/time-allocation/lib/job-image-helpers";
import {
  buildCrewAllocations,
  buildCrewSummary,
  confirmQuantityOverrun,
  crewMemberHasSavedAllocations,
  DEFAULT_CREW_LABOR_TYPE,
  draftHasAnyInput,
  draftIsIncomplete,
  draftIsSaveable,
  filterNetSuiteVendors,
  formatCrewMemberMeta,
  formatCrewMemberOption,
  formatEntryCrew,
  formatNetSuiteVendorOption,
  getCrewAllocationError,
  getCrewDisplayName,
  getCrewLaborType,
  getDraftQuantityOverrunWarnings,
  getDraftTotalHours,
  getExistingDraft,
  getNetSuiteVendorCrewMemberId,
  mergeDraftCrewMembers,
  mergeEntryCrewAllocations,
  mergeProjectCrewMembers,
  normalizeCrewName,
  normalizeDraftCrewHours,
  normalizeVendorSearchText,
  projectHasCrewMember,
  scaleCrewAllocations,
  sortCrewMembersByName,
  splitCrewHoursEvenly
} from "@/features/time-allocation/lib/crew-entry-helpers";
import {
  buildNetSuiteProjectManagerOptions,
  filterActiveProjects,
  getDefaultMyJobIdsForUser,
  normalizeSyncLogEntry,
  normalizeSyncSummary,
  projectMatchesIdentifier,
  resolveNetSuiteProjectManagerOption,
  sortProjectsByName
} from "@/features/time-allocation/lib/selectors";
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
  CrewMember,
  CrewMembersByProject,
  CrewSummaryRow,
  DailyReport,
  DailyReportAnswers,
  DailyReportEmployeeRow,
  DailyReportItsfmRow,
  DailyReportPayItemRow,
  DailyReportProcoreStatus,
  DailyReportsByKey,
  DailyReportTimeField,
  DailyReportUpload,
  DailyReportUploadsByKey,
  DayEntryNotes,
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  DraftsByPayItem,
  JobImageQueueItem,
  JobImageUpload,
  JobImageUploadsByDay,
  ManagedAppUser,
  MyJobsByUser,
  NetSuiteVendor,
  ProcoreSyncSummary,
  ProjectArchiveById,
  ProjectBlacklistById,
  ProjectsResponse,
  SharedAppState,
  SyncLogEntry,
  VendorBlacklistById
} from "@/features/time-allocation/types";
import {
  useNetworkStatus,
  type NetworkStatus
} from "@/features/time-allocation/hooks/use-network-status";
import {
  DashboardAttentionList,
  DashboardMetric,
  DashboardWeeklyCalendar,
  ExecutiveFieldAccessTools,
  ExecutiveProjectNavigator,
  ExecutiveReviewQueue,
  ExecutiveSummaryStrip,
  FieldProjectAssignmentPanel,
  PmComplianceRanking
} from "@/features/time-allocation/components/dashboard/dashboard-components";
import { AdminToolsDrawer } from "@/features/time-allocation/components/admin/admin-tools";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";
type DailyReportUploadResponse = {
  companyId?: string;
  fileName?: string;
  folderId?: string;
  folderPath?: string;
  folderUrl?: string;
  procoreFileId?: string;
  procoreUpload?: {
    createUploadPath?: string;
    createFilePath?: string;
    createFilePayload?: string;
  };
  error?: string;
};

type JobImageUploadResponse = {
  databaseConfigured?: boolean;
  error?: string;
  failedCount?: number;
  folderId?: string;
  folderPath?: string;
  folderUrl?: string;
  ok?: boolean;
  uploadedImageCount?: number;
  uploadedImageLimit?: number;
  uploadedCount?: number;
  uploads?: JobImageUpload[];
};

type AdminUsersResponse = {
  databaseConfigured?: boolean;
  error?: string;
  users?: ManagedAppUser[];
};

type AuthResponse = {
  user: AuthUser | null;
  error?: string;
};

type ChangePasswordResponse = {
  error?: string;
  ok?: boolean;
};

type ProcoreStatusResponse = {
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
};

type NetworkNotice = {
  icon: LucideIcon;
  message: string;
  tone: "offline" | "weak";
  title: string;
};

type EditingEntry = {
  entryId: string;
  hours: string;
  quantity: string;
};

type EditingCrewMember = {
  crewMemberId: string;
  laborType: CrewLaborType;
  name: string;
  jobTitle: string;
  subcontractorCompany: string;
};

export function TimeAllocationWorkspace() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetForm, setPasswordResetForm] = useState<PasswordResetFormState>(() => createEmptyPasswordResetForm());
  const [passwordResetNotice, setPasswordResetNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState<ChangePasswordFormState>(() => createEmptyChangePasswordForm());
  const [changePasswordNotice, setChangePasswordNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
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
  const [dailyReportsByKey, setDailyReportsByKey] = useState<DailyReportsByKey>({});
  const [dailyReportUploadsByKey, setDailyReportUploadsByKey] = useState<DailyReportUploadsByKey>({});
  const [dailyReportDraft, setDailyReportDraft] = useState<DailyReportAnswers>(() => createEmptyDailyReportAnswers());
  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [dailyReportDraftNotice, setDailyReportDraftNotice] = useState("");
  const [downloadingDailyReportPdf, setDownloadingDailyReportPdf] = useState(false);
  const [uploadingDailyReport, setUploadingDailyReport] = useState(false);
  const [retryingDailyReportUploadKey, setRetryingDailyReportUploadKey] = useState("");
  const [dailyReportUploadNotice, setDailyReportUploadNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [jobImageUploadsByDay, setJobImageUploadsByDay] = useState<JobImageUploadsByDay>({});
  const [jobImageQueue, setJobImageQueue] = useState<JobImageQueueItem[]>([]);
  const [jobImageNotice, setJobImageNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [loadingJobImageUploads, setLoadingJobImageUploads] = useState(false);
  const [uploadingJobImages, setUploadingJobImages] = useState(false);
  const [jobImageHistoryExpanded, setJobImageHistoryExpanded] = useState(false);
  const [mobileInstallPromptVisible, setMobileInstallPromptVisible] = useState(false);
  const [myJobsByUser, setMyJobsByUser] = useState<MyJobsByUser>({});
  const [crewDirectory, setCrewDirectory] = useState<CrewMember[]>([]);
  const [crewMembersByProject, setCrewMembersByProject] = useState<CrewMembersByProject>({});
  const [crewMemberName, setCrewMemberName] = useState("");
  const [crewMemberJobTitle, setCrewMemberJobTitle] = useState("");
  const [crewMemberLaborType, setCrewMemberLaborType] = useState<CrewLaborType>(DEFAULT_CREW_LABOR_TYPE);
  const [netSuiteVendors, setNetSuiteVendors] = useState<NetSuiteVendor[]>([]);
  const [allNetSuiteVendors, setAllNetSuiteVendors] = useState<NetSuiteVendor[]>([]);
  const [netSuiteVendorBlacklistById, setNetSuiteVendorBlacklistById] = useState<VendorBlacklistById>({});
  const [netSuiteVendorsSyncedAt, setNetSuiteVendorsSyncedAt] = useState<string | null>(null);
  const [loadingNetSuiteVendors, setLoadingNetSuiteVendors] = useState(false);
  const [syncingNetSuiteVendors, setSyncingNetSuiteVendors] = useState(false);
  const [subcontractorVendorSearch, setSubcontractorVendorSearch] = useState("");
  const [selectedSubcontractorVendorId, setSelectedSubcontractorVendorId] = useState("");
  const [selectedExistingCrewMemberId, setSelectedExistingCrewMemberId] = useState("");
  const [mergeSourceCrewMemberId, setMergeSourceCrewMemberId] = useState("");
  const [mergeTargetCrewMemberId, setMergeTargetCrewMemberId] = useState("");
  const [draftsByPayItem, setDraftsByPayItem] = useState<DraftsByPayItem>({});
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [savingEntries, setSavingEntries] = useState(false);
  const [savingEditedEntry, setSavingEditedEntry] = useState(false);
  const [submittingDay, setSubmittingDay] = useState(false);
  const [reopeningDay, setReopeningDay] = useState(false);
  const [deletingSubmittedDay, setDeletingSubmittedDay] = useState(false);
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);
  const [editingCrewMember, setEditingCrewMember] = useState<EditingCrewMember | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Mock data active");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [entryNotice, setEntryNotice] = useState("");
  const [adminUsers, setAdminUsers] = useState<ManagedAppUser[]>([]);
  const [adminUsersNotice, setAdminUsersNotice] = useState("");
  const [fieldUsers, setFieldUsers] = useState<AuthUser[]>([]);
  const [fieldAssignmentNotice, setFieldAssignmentNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [savingFieldAssignmentProjectId, setSavingFieldAssignmentProjectId] = useState("");
  const [adminPasswordResetToken, setAdminPasswordResetToken] = useState<PasswordResetResponse | null>(null);
  const [adminUserForm, setAdminUserForm] = useState<AdminUserFormState>(() => createEmptyAdminUserForm());
  const [editingAdminUserId, setEditingAdminUserId] = useState("");
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [savingAdminUser, setSavingAdminUser] = useState(false);
  const [clearingStagingData, setClearingStagingData] = useState(false);
  const [clearingProjectCache, setClearingProjectCache] = useState(false);
  const [adminMaintenanceNotice, setAdminMaintenanceNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [syncSummary, setSyncSummary] = useState<ProcoreSyncSummary | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const networkStatus = useNetworkStatus();
  const [appStateHydrated, setAppStateHydrated] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const jobImageInputRef = useRef<HTMLInputElement>(null);
  const payItemEntryPanelRef = useRef<HTMLDivElement>(null);
  const jobImagePreviewUrlsRef = useRef<Set<string>>(new Set());
  const myProjectsFilterInitializedRef = useRef(false);
  const dailyReportDraftAutosaveTimeoutRef = useRef<number | null>(null);
  const saveDailyReportRef = useRef<(() => Promise<void>) | null>(null);
  const saveAllocationEntriesRef = useRef<(() => Promise<void>) | null>(null);

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
  const reportDailyReportsByKey = useMemo(
    () => filterDailyReportsByProjectIds(dailyReportsByKey, visibleProjectIds),
    [dailyReportsByKey, visibleProjectIds]
  );
  const netSuiteProjectManagerOptions = useMemo(() => buildNetSuiteProjectManagerOptions(allProjects), [allProjects]);
  const selectedSubcontractorVendor = useMemo(
    () => netSuiteVendors.find((vendor) => vendor.id === selectedSubcontractorVendorId) ?? null,
    [netSuiteVendors, selectedSubcontractorVendorId]
  );
  const filteredSubcontractorVendors = useMemo(
    () => filterNetSuiteVendors(netSuiteVendors, subcontractorVendorSearch).slice(0, 20),
    [netSuiteVendors, subcontractorVendorSearch]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const selectedProjectUsesTwoSeriesDailyReport = isTwoSeriesProject(selectedProject);
  const selectedProjectUsesPayItems = Boolean(selectedProject && !selectedProjectUsesTwoSeriesDailyReport);
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
  const selectedProjectCrewMembers = selectedProject
    ? sortCrewMembersByName(crewMembersByProject[selectedProject.id] ?? [])
    : [];
  const existingCrewMemberOptions = selectedProject
    ? crewDirectory.filter((member) => !projectHasCrewMember(selectedProjectCrewMembers, member.id))
    : [];
  const crewSummaryRows = buildCrewSummary(visibleEntries, selectedProjectCrewMembers);
  const currentDaySubmission: DaySubmission = selectedProject
    ? daySubmissions[getDayKey(selectedProject.id, workDate)] ?? { status: "draft" }
    : { status: "draft" };
  const currentDayEntryNotes = selectedProject
    ? dayEntryNotesByKey[getDayKey(selectedProject.id, workDate)] ?? { notes: "", inventory: "" }
    : { notes: "", inventory: "" };
  const currentDayKey = selectedProject ? getDayKey(selectedProject.id, workDate) : "";
  const currentDailyReport = selectedProject ? dailyReportsByKey[currentDayKey] : undefined;
  const currentDailyReportUpload = selectedProject ? dailyReportUploadsByKey[currentDayKey] : undefined;
  const currentDailyReportProcoreStatus = getDailyReportProcoreStatus(
    currentDailyReport,
    currentDailyReportUpload,
    selectedProject?.id,
    currentUser?.role ?? "standard"
  );
  const dailyReportNeedsUpload = Boolean(currentDailyReport && currentDailyReportProcoreStatus.className !== "uploaded");
  const currentJobImageUploads = selectedProject ? jobImageUploadsByDay[currentDayKey] ?? [] : [];
  const queuedJobImages = jobImageQueue.filter((image) => image.status !== "uploaded");
  const failedQueuedJobImages = jobImageQueue.filter((image) => image.status === "failed");
  const failedJobImageUploads = currentJobImageUploads.filter((upload) => upload.status === "failed");
  const uploadedJobImageCount = currentJobImageUploads.filter((upload) => upload.status === "uploaded").length;
  const remainingJobImageSlots = Math.max(0, JOB_IMAGE_DAILY_UPLOAD_LIMIT - uploadedJobImageCount);
  const remainingQueueableJobImageSlots = Math.max(0, remainingJobImageSlots - queuedJobImages.length);
  const jobImageDailyLimitReached = remainingJobImageSlots === 0;
  const previousDailyReportCrewTime = useMemo(
    () => (selectedProject ? findPreviousDailyReportWithCrewTime(dailyReportsByKey, selectedProject.id, workDate) : null),
    [dailyReportsByKey, selectedProject, workDate]
  );
  const dailyReportUploadRetryQueue = useMemo(
    () =>
      Object.entries(dailyReportUploadsByKey)
        .flatMap(([dayKey, upload]) => {
          if (upload.status !== "failed") {
            return [];
          }

          const dayKeyParts = parseDayKey(dayKey);
          const report = dailyReportsByKey[dayKey];
          const project = dayKeyParts ? projects.find((candidate) => candidate.id === dayKeyParts.projectId) : undefined;

          if (!dayKeyParts || !report || !project) {
            return [];
          }

          return [
            {
              date: dayKeyParts.date,
              dayKey,
              project,
              report,
              upload
            }
          ];
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.project.name.localeCompare(b.project.name)),
    [dailyReportUploadsByKey, dailyReportsByKey, projects]
  );
  const showDailyReportDetails = Boolean(
    currentDailyReport ||
      dailyReportUploadNotice ||
      uploadingDailyReport ||
      downloadingDailyReportPdf ||
      dailyReportUploadRetryQueue.length > 0
  );
  const showJobImageDetails = Boolean(
    jobImageQueue.length > 0 || currentJobImageUploads.length > 0 || jobImageNotice || uploadingJobImages
  );

  const scrollPayItemEntryPanelToTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      payItemEntryPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, []);
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
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
  const userIsOffline = networkStatus.checked && !networkStatus.online;
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

  function clearDailyReportDraftForCurrentContext() {
    if (dailyReportModalOpen && selectedProject && currentUser) {
      clearDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    }

    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
  }

  function clearTransientEntryState() {
    setMobileSelectedPayItemId("");
    setEditingEntry(null);
    setEditingCrewMember(null);
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    setSelectedSubcontractorVendorId("");
    setSubcontractorVendorSearch("");
    setSelectedExistingCrewMemberId("");
    setDraftsByPayItem({});
    clearJobImageQueue();
    clearDailyReportDraftForCurrentContext();
  }

  const applyNetSuiteVendorData = useCallback((data: {
    allVendors?: NetSuiteVendor[];
    syncedAt?: string | null;
    vendorBlacklistById?: VendorBlacklistById;
    vendors: NetSuiteVendor[];
  }) => {
    const visibleVendors = data.vendors;
    const allVendors = data.allVendors ?? visibleVendors;
    const vendorIds = new Set(visibleVendors.map((vendor) => vendor.id));

    setNetSuiteVendors(visibleVendors);
    setAllNetSuiteVendors(allVendors);
    setNetSuiteVendorBlacklistById(data.vendorBlacklistById ?? {});
    setNetSuiteVendorsSyncedAt(data.syncedAt ?? null);
    setSelectedSubcontractorVendorId((currentVendorId) => {
      const nextVendorId = vendorIds.has(currentVendorId) ? currentVendorId : "";
      const selectedVendor = visibleVendors.find((vendor) => vendor.id === nextVendorId);

      setSubcontractorVendorSearch((currentSearch) =>
        selectedVendor ? formatNetSuiteVendorOption(selectedVendor) : currentVendorId ? "" : currentSearch
      );

      return nextVendorId;
    });
  }, []);

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

  function replaceEntriesForDay(projectId: string, date: string, dayEntries: AllocationEntry[]) {
    setEntries((current) => [
      ...current.filter((entry) => !(entry.projectId === projectId && entry.date === date)),
      ...dayEntries
    ]);
  }

  async function ensureEntriesAreCurrent(projectId: string, date: string) {
    const databaseEntries = await loadDatabaseEntries();

    if (!databaseEntries) {
      return true;
    }

    const databaseDayEntries = databaseEntries.filter((entry) => entry.projectId === projectId && entry.date === date);
    const currentDayEntries = entries.filter((entry) => entry.projectId === projectId && entry.date === date);

    if (buildEntryConflictSignature(databaseDayEntries) === buildEntryConflictSignature(currentDayEntries)) {
      return true;
    }

    replaceEntriesForDay(projectId, date, databaseDayEntries);
    setEditingEntry(null);
    setEntryNotice("This job/day was changed by another user. Review the latest entries before saving again.");
    return false;
  }

  async function ensureDaySubmissionIsCurrent(projectId: string, date: string) {
    const databaseDayRecords = await loadDatabaseDayRecords();

    if (!databaseDayRecords) {
      return true;
    }

    const dayKey = getDayKey(projectId, date);
    const databaseSubmission = databaseDayRecords.daySubmissions[dayKey] ?? { status: "draft" };
    const currentSubmission = daySubmissions[dayKey] ?? { status: "draft" };

    if (buildDaySubmissionConflictSignature(databaseSubmission) === buildDaySubmissionConflictSignature(currentSubmission)) {
      return true;
    }

    setDaySubmissions(databaseDayRecords.daySubmissions);
    setDayEntryNotesByKey(databaseDayRecords.dayEntryNotesByKey);
    setDraftsByPayItem({});
    setEditingEntry(null);
    setEntryNotice("This day status was changed by another user. Review the latest status before trying again.");
    return false;
  }

  async function ensureDailyReportIsCurrent(projectId: string, date: string) {
    const databaseDailyReportData = await loadDatabaseDailyReportData();

    if (!databaseDailyReportData) {
      return true;
    }

    const dayKey = getDayKey(projectId, date);
    const databaseDailyReport = databaseDailyReportData.dailyReportsByKey[dayKey];
    const currentDailyReportForDay = dailyReportsByKey[dayKey];

    if (
      !databaseDailyReport ||
      buildDailyReportConflictSignature(databaseDailyReport) === buildDailyReportConflictSignature(currentDailyReportForDay)
    ) {
      return true;
    }

    setDailyReportsByKey(databaseDailyReportData.dailyReportsByKey);
    setDailyReportUploadsByKey(databaseDailyReportData.dailyReportUploadsByKey);
    setDailyReportDraft(getDailyReportAnswers(databaseDailyReport));
    setDailyReportDraftNotice("This daily report was changed by another user. Review the latest saved version before saving again.");
    setEntryNotice("This daily report was changed by another user. Review the latest saved version before saving again.");
    return false;
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
  }, [currentUser]);

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
    if (!currentUser || typeof window === "undefined") {
      setJobImageHistoryExpanded(false);
      return;
    }

    setJobImageHistoryExpanded(window.matchMedia("(min-width: 861px)").matches);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNetSuiteVendors([]);
      setAllNetSuiteVendors([]);
      setNetSuiteVendorBlacklistById({});
      setNetSuiteVendorsSyncedAt(null);
      setSubcontractorVendorSearch("");
      setSelectedSubcontractorVendorId("");
      return;
    }

    let cancelled = false;

    async function loadVendors() {
      setLoadingNetSuiteVendors(true);

      try {
        const data = await loadDatabaseNetSuiteVendors();

        if (!cancelled && data) {
          applyNetSuiteVendorData(data);
        }
      } finally {
        if (!cancelled) {
          setLoadingNetSuiteVendors(false);
        }
      }
    }

    void loadVendors();

    return () => {
      cancelled = true;
    };
  }, [applyNetSuiteVendorData, currentUser]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void loadAdminUsers();
      return;
    }

    setAdminUsers([]);
    setAdminUsersNotice("");
    setAdminUserForm(createEmptyAdminUserForm());
    setEditingAdminUserId("");
    setClearingStagingData(false);
    setAdminMaintenanceNotice(null);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !canAccessReports(currentUser)) {
      setFieldUsers([]);
      setFieldAssignmentNotice(null);
      setSavingFieldAssignmentProjectId("");
      return;
    }

    let cancelled = false;

    async function loadFieldUsers() {
      try {
        const users = await loadAssignableFieldUsers();

        if (!cancelled) {
          setFieldUsers(users);
        }
      } catch (error) {
        if (!cancelled) {
          setFieldAssignmentNotice({
            message: error instanceof Error ? error.message : "Unable to load Field users.",
            status: "error"
          });
        }
      }
    }

    void loadFieldUsers();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (projects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId("");
        setMobileSelectedPayItemId("");
        setEditingEntry(null);
        setEditingCrewMember(null);
        setDraftsByPayItem({});
      }
      return;
    }

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      setMobileSelectedPayItemId("");
      setEditingEntry(null);
      setEditingCrewMember(null);
      setDraftsByPayItem({});
    }
  }, [currentUser, projects, selectedProjectId]);

  useEffect(() => {
    if (!currentUser || jobPickerProjects.length === 0) {
      return;
    }

    if (!jobPickerProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(jobPickerProjects[0].id);
      setMobileSelectedPayItemId("");
      setEditingEntry(null);
      setEditingCrewMember(null);
      setDraftsByPayItem({});
    }
  }, [currentUser, jobPickerProjects, selectedProjectId]);

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
    if (!currentUser || !selectedProject) {
      return;
    }

    let cancelled = false;
    const dayKey = getDayKey(selectedProject.id, workDate);

    async function loadJobImagesForDay() {
      setLoadingJobImageUploads(true);

      try {
        const uploads = await loadDatabaseJobImageUploads(selectedProject.id, workDate);

        if (!cancelled && uploads) {
          setJobImageUploadsByDay((current) => ({
            ...current,
            [dayKey]: uploads
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingJobImageUploads(false);
        }
      }
    }

    void loadJobImagesForDay();

    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProject, workDate]);

  useEffect(
    () => () => {
      for (const previewUrl of jobImagePreviewUrlsRef.current) {
        URL.revokeObjectURL(previewUrl);
      }

      jobImagePreviewUrlsRef.current.clear();
    },
    []
  );

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
  }, [currentUser]);

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
    if (!dailyReportModalOpen || !currentUser || !selectedProject) {
      clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
      return;
    }

    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);

    const draftToSave = dailyReportDraft;
    const projectId = selectedProject.id;
    const date = workDate;
    const userId = currentUser.id;

    function saveDraft(showNotice: boolean) {
      const updatedAt = new Date().toISOString();

      writeDailyReportAutosaveDraft({
        date,
        draft: draftToSave,
        projectId,
        updatedAt,
        userId
      });

      if (showNotice) {
        setDailyReportDraftNotice(
          `Draft autosaved ${new Date(updatedAt).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit"
          })}.`
        );
      }
    }

    function saveDraftBeforeUnload() {
      saveDraft(false);
    }

    dailyReportDraftAutosaveTimeoutRef.current = window.setTimeout(() => {
      saveDraft(true);
      dailyReportDraftAutosaveTimeoutRef.current = null;
    }, 700);
    window.addEventListener("beforeunload", saveDraftBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", saveDraftBeforeUnload);
      clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    };
  }, [currentUser, dailyReportDraft, dailyReportModalOpen, selectedProject, workDate]);

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

  async function login() {
    setLoginError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: loginUserId,
        password: loginPassword
      })
    });
    const data = (await readApiJson(response)) as AuthResponse;

    if (!response.ok || !data.user) {
      setLoginError(data.error ?? "Unable to sign in.");
      return;
    }

    setCurrentUser(data.user);
    setViewMode(getDefaultViewModeForUser());
    setLoginPassword("");
  }

  function updatePasswordResetForm(field: keyof PasswordResetFormState, value: string) {
    setPasswordResetNotice(null);
    setPasswordResetForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function openPasswordReset() {
    setPasswordResetOpen(true);
    setPasswordResetNotice(null);
    setPasswordResetForm((current) => ({
      ...current,
      userId: current.userId || loginUserId
    }));
  }

  function closePasswordReset() {
    if (resettingPassword) {
      return;
    }

    setPasswordResetOpen(false);
    setPasswordResetForm(createEmptyPasswordResetForm());
    setPasswordResetNotice(null);
  }

  async function submitPasswordReset() {
    const { confirmPassword, newPassword, token, userId } = passwordResetForm;

    if (!userId.trim() || !token.trim() || !newPassword || !confirmPassword) {
      setPasswordResetNotice({ message: "Enter user ID, reset code, new password, and confirmation.", status: "error" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordResetNotice({ message: "New password must be at least 8 characters.", status: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordResetNotice({ message: "New password and confirmation do not match.", status: "error" });
      return;
    }

    setResettingPassword(true);
    setPasswordResetNotice(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({
          newPassword,
          token,
          userId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as PasswordResetResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to reset password.");
      }

      setLoginUserId(userId.trim().toLowerCase());
      setPasswordResetForm(createEmptyPasswordResetForm());
      setPasswordResetNotice({ message: "Password reset. Sign in with the new password.", status: "success" });
    } catch (error) {
      setPasswordResetNotice({
        message: error instanceof Error ? error.message : "Unable to reset password.",
        status: "error"
      });
    } finally {
      setResettingPassword(false);
    }
  }

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
    setAdminUsers([]);
    setAdminUsersNotice("");
    setAdminUserForm(createEmptyAdminUserForm());
    setEditingAdminUserId("");
    setChangePasswordOpen(false);
    setChangePasswordForm(createEmptyChangePasswordForm());
    setChangePasswordNotice(null);
    setChangingPassword(false);
    setPasswordResetOpen(false);
    setPasswordResetForm(createEmptyPasswordResetForm());
    setPasswordResetNotice(null);
    setResettingPassword(false);
    setEntries([]);
    setDaySubmissions({});
    setDayEntryNotesByKey({});
    setDailyReportsByKey({});
    setDailyReportUploadsByKey({});
    setDailyReportModalOpen(false);
    setDailyReportUploadNotice(null);
    setDownloadingDailyReportPdf(false);
    setUploadingDailyReport(false);
    setMyJobsByUser({});
    setProjectArchiveById({});
    setProjectBlacklistById({});
    setCrewDirectory([]);
    setCrewMembersByProject({});
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    setNetSuiteVendors([]);
    setAllNetSuiteVendors([]);
    setNetSuiteVendorBlacklistById({});
    setNetSuiteVendorsSyncedAt(null);
    setSubcontractorVendorSearch("");
    setSelectedSubcontractorVendorId("");
    setSelectedExistingCrewMemberId("");
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId("");
    setEditingCrewMember(null);
    setViewMode("dashboard");
  }

  async function loadAdminUsers() {
    setLoadingAdminUsers(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse;

      if (!response.ok || data.databaseConfigured === false) {
        throw new Error(data.error ?? "User management requires the database.");
      }

      setAdminUsers(data.users ?? []);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoadingAdminUsers(false);
    }
  }

  function updateAdminUserForm(field: keyof AdminUserFormState, value: string | boolean) {
    setAdminUsersNotice("");
    setAdminUserForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function startEditingAdminUser(user: ManagedAppUser) {
    setEditingAdminUserId(user.id);
    setAdminUsersNotice("");
    setAdminUserForm({
      active: user.active,
      firstName: user.firstName,
      lastName: user.lastName,
      netSuiteProjectManagerId: user.netSuiteProjectManagerId ?? "",
      netSuiteProjectManagerName: user.netSuiteProjectManagerName ?? "",
      password: "",
      role: user.role,
      userId: user.id
    });
  }

  function resetAdminUserForm() {
    setEditingAdminUserId("");
    setAdminUsersNotice("");
    setAdminUserForm(createEmptyAdminUserForm());
  }

  async function saveAdminUser() {
    if (currentUser?.role !== "admin") {
      return;
    }

    const userId = adminUserForm.userId.trim().toLowerCase();
    const firstName = adminUserForm.firstName.trim();
    const lastName = adminUserForm.lastName.trim();
    const netSuiteProjectManager = resolveNetSuiteProjectManagerOption(
      adminUserForm.netSuiteProjectManagerId,
      netSuiteProjectManagerOptions
    );
    const password = adminUserForm.password.trim();

    if (!userId || !firstName || !lastName) {
      setAdminUsersNotice("Enter user ID, first name, and last name.");
      return;
    }

    if (!editingAdminUserId && !password) {
      setAdminUsersNotice("Enter a temporary password for new users.");
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          active: adminUserForm.active,
          firstName,
          lastName,
          netSuiteProjectManagerId: adminUserForm.role === "project_manager" ? netSuiteProjectManager?.id : undefined,
          netSuiteProjectManagerName: adminUserForm.role === "project_manager" ? netSuiteProjectManager?.name : undefined,
          password: password || undefined,
          role: adminUserForm.role,
          userId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse & { ok?: boolean };

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to save user.");
      }

      setAdminUsers(data.users ?? []);
      resetAdminUserForm();
      setAdminUsersNotice(`${firstName} ${lastName} saved.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  async function setAdminUserActive(user: ManagedAppUser, active: boolean) {
    if (currentUser?.role !== "admin") {
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          active,
          firstName: user.firstName,
          lastName: user.lastName,
          netSuiteProjectManagerId: user.netSuiteProjectManagerId,
          netSuiteProjectManagerName: user.netSuiteProjectManagerName,
          role: user.role,
          userId: user.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse & { ok?: boolean };

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to update user.");
      }

      setAdminUsers(data.users ?? []);
      setAdminUsersNotice(`${formatUserName(user)} ${active ? "reactivated" : "deactivated"}.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  async function createAdminPasswordResetToken(user: ManagedAppUser) {
    if (currentUser?.role !== "admin") {
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");
    setAdminPasswordResetToken(null);

    try {
      const response = await fetch("/api/admin/users/reset-token", {
        body: JSON.stringify({
          userId: user.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as PasswordResetResponse;

      if (!response.ok || data.ok === false || !data.token) {
        throw new Error(data.error ?? "Unable to create reset code.");
      }

      setAdminPasswordResetToken(data);
      setAdminUsersNotice(`Reset code created for ${formatUserName(user)}. It expires in 24 hours.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to create reset code.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  async function syncNetSuiteVendorDirectory() {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineAction((message) => {
      setAdminMaintenanceNotice({ message, status: "error" });
    })) {
      return;
    }

    setSyncingNetSuiteVendors(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await syncDatabaseNetSuiteVendors();

      applyNetSuiteVendorData(data);
      setAdminMaintenanceNotice({
        message: `Loaded ${data.vendors.length} NetSuite vendor${data.vendors.length === 1 ? "" : "s"} with default addresses.`,
        status: "success"
      });
      addSyncLog({
        action: "Get Vendors",
        status: "success",
        message: `Loaded ${data.vendors.length} NetSuite vendor${data.vendors.length === 1 ? "" : "s"}.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync NetSuite vendors.";

      setAdminMaintenanceNotice({
        message,
        status: "error"
      });
      addSyncLog({
        action: "Get Vendors",
        status: "error",
        message
      });
    } finally {
      setSyncingNetSuiteVendors(false);
    }
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

      clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
      clearAllDailyReportAutosaveDrafts();

      setEntries([]);
      setDaySubmissions({});
      setDayEntryNotesByKey({});
      setDailyReportsByKey({});
      setDailyReportUploadsByKey({});
      setDailyReportDraft(createEmptyDailyReportAnswers());
      setDailyReportModalOpen(false);
      setDailyReportDraftNotice("");
      setDailyReportUploadNotice(null);
      setRetryingDailyReportUploadKey("");
      setCrewDirectory([]);
      setCrewMembersByProject({});
      setCrewMemberName("");
      setCrewMemberJobTitle("");
      setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
      setSubcontractorVendorSearch("");
      setSelectedSubcontractorVendorId("");
      setSelectedExistingCrewMemberId("");
      setMergeSourceCrewMemberId("");
      setMergeTargetCrewMemberId("");
      setEditingCrewMember(null);
      setEditingEntry(null);
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
      setSyncedAt(null);
      setSyncSummary(null);
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

  function updateChangePasswordForm(field: keyof ChangePasswordFormState, value: string) {
    setChangePasswordNotice(null);
    setChangePasswordForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function closeChangePasswordModal() {
    if (changingPassword) {
      return;
    }

    setChangePasswordOpen(false);
    setChangePasswordForm(createEmptyChangePasswordForm());
    setChangePasswordNotice(null);
  }

  async function submitChangePassword() {
    const { confirmPassword, currentPassword, newPassword } = changePasswordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordNotice({ message: "Enter your current password, new password, and confirmation.", status: "error" });
      return;
    }

    if (newPassword.length < 8) {
      setChangePasswordNotice({ message: "New password must be at least 8 characters.", status: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordNotice({ message: "New password and confirmation do not match.", status: "error" });
      return;
    }

    setChangingPassword(true);
    setChangePasswordNotice(null);

    try {
      const response = await fetch("/api/auth/change-password", {
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as ChangePasswordResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to change password.");
      }

      setChangePasswordForm(createEmptyChangePasswordForm());
      setChangePasswordNotice({ message: "Password changed.", status: "success" });
    } catch (error) {
      setChangePasswordNotice(error instanceof Error
        ? { message: error.message, status: "error" }
        : { message: "Unable to change password.", status: "error" });
    } finally {
      setChangingPassword(false);
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

  async function saveFieldProjectAssignments(projectId: string, fieldUserIds: string[]) {
    if (!currentUser || !canAccessReports(currentUser)) {
      return;
    }

    setSavingFieldAssignmentProjectId(projectId);
    setFieldAssignmentNotice(null);

    try {
      const assignedFieldUserIds = await saveDatabaseProjectFieldUsers(projectId, fieldUserIds);
      const assignedFieldUserIdSet = new Set(assignedFieldUserIds);

      setMyJobsByUser((current) => ({
        ...fieldUsers.reduce<MyJobsByUser>((next, fieldUser) => {
          const currentProjectIds = next[fieldUser.id] ?? [];
          const nextProjectIds = currentProjectIds.filter((candidateProjectId) => candidateProjectId !== projectId);

          if (assignedFieldUserIdSet.has(fieldUser.id)) {
            nextProjectIds.push(projectId);
          }

          next[fieldUser.id] = Array.from(new Set(nextProjectIds));

          return next;
        }, { ...current })
      }));
      setFieldAssignmentNotice({
        message: "Field project access updated.",
        status: "success"
      });
    } catch (error) {
      setFieldAssignmentNotice({
        message: error instanceof Error ? error.message : "Unable to save Field project access.",
        status: "error"
      });
    } finally {
      setSavingFieldAssignmentProjectId("");
    }
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
      setEditingEntry(null);
      setDraftsByPayItem({});
    }

    void saveDatabaseProjectArchive(projectId, archived).catch((error) => {
      setProjectLoadError(error instanceof Error ? error.message : "Project archive saved locally, but did not sync.");
    });
  }

  function toggleVendorBlacklist(vendorId: string, blacklisted: boolean) {
    const nextBlacklist = {
      ...netSuiteVendorBlacklistById
    };

    if (blacklisted) {
      nextBlacklist[vendorId] = true;
    } else {
      delete nextBlacklist[vendorId];
    }

    const visibleVendors = allNetSuiteVendors.filter((vendor) => !nextBlacklist[vendor.id]);

    setNetSuiteVendorBlacklistById(nextBlacklist);
    setNetSuiteVendors(visibleVendors);
    if (blacklisted && selectedSubcontractorVendorId === vendorId) {
      setSelectedSubcontractorVendorId("");
      setSubcontractorVendorSearch("");
    }

    void saveDatabaseNetSuiteVendorBlacklist(vendorId, blacklisted)
      .then((data) => {
        if (data) {
          applyNetSuiteVendorData(data);
        }
      })
      .catch((error) => {
        setAdminMaintenanceNotice({
          message: error instanceof Error ? error.message : "Vendor blacklist saved locally, but did not sync.",
          status: "error"
        });
      });
  }

  function updateSubcontractorVendorSearch(value: string) {
    setSubcontractorVendorSearch(value);

    const normalizedValue = normalizeVendorSearchText(value);
    const exactMatch = netSuiteVendors.find((vendor) =>
      [formatNetSuiteVendorOption(vendor), vendor.name, vendor.entityId ?? ""].some(
        (candidate) => normalizeVendorSearchText(candidate) === normalizedValue
      )
    );
    setSelectedSubcontractorVendorId(exactMatch?.id ?? "");
  }

  function selectSubcontractorVendor(vendor: NetSuiteVendor) {
    setSelectedSubcontractorVendorId(vendor.id);
    setSubcontractorVendorSearch(formatNetSuiteVendorOption(vendor));
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
    setEditingEntry(null);
    setEditingCrewMember(null);
    setDraftsByPayItem({});
  }

  function openDailyReportModal() {
    if (!selectedProject || !currentUser) {
      return;
    }

    const autosavedDraft = readDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    const defaultDailyReportAnswers = createEmptyDailyReportAnswers();

    setDailyReportDraft(
      autosavedDraft
        ? autosavedDraft.draft
        : currentDailyReport
        ? getDailyReportAnswers(currentDailyReport)
        : {
            ...defaultDailyReportAnswers,
            workDetails: currentDayEntryNotes.notes,
            itsfmCabinetEquipment: currentDayEntryNotes.inventory
          }
    );
    setDailyReportDraftNotice(
      autosavedDraft
        ? `Restored autosaved draft from ${new Date(autosavedDraft.updatedAt).toLocaleString()}.`
        : "Draft autosaves while this form is open."
    );
    setDailyReportModalOpen(true);
  }

  function closeDailyReportModal() {
    if (!window.confirm("Close the daily report without saving? Unsaved report edits will be discarded.")) {
      return;
    }

    if (selectedProject && currentUser) {
      clearDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    }

    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
  }

  function updateDailyReportDraft(field: keyof DailyReportAnswers, value: string) {
    setDailyReportDraft((current) => {
      const updatedDraft = {
        ...current,
        [field]: value
      };

      if (field === "quantitiesTurnedIn" && value !== "yes") {
        updatedDraft.inspectorName = "";
        updatedDraft.inspectorQuantityDetails = "";
      }

      if (field === "incidentOccurred" && value !== "yes") {
        updatedDraft.accidentReportFiled = "";
        updatedDraft.incidentDetails = "";
      }

      return updatedDraft;
    });
  }

  function updateDailyReportEmployeeDraft(
    rowIndex: number,
    field: keyof DailyReportEmployeeRow,
    value: string | boolean
  ) {
    setDailyReportDraft((current) => ({
      ...current,
      employeeRows: current.employeeRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const updatedRow = {
          ...row,
          [field]: isDailyReportTimeField(field) && typeof value === "string" ? sanitizeDailyReportTimeInput(value) : value
        };

        return {
          ...updatedRow,
          totalHours: isDailyReportTimeField(field) ? calculateDailyReportTotalHours(updatedRow) : updatedRow.totalHours
        };
      })
    }));
  }

  function normalizeDailyReportEmployeeTimeDraft(rowIndex: number, field: DailyReportTimeField) {
    setDailyReportDraft((current) => ({
      ...current,
      employeeRows: current.employeeRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const updatedRow = {
          ...row,
          [field]: normalizeDailyReportTimeInput(row[field])
        };

        return {
          ...updatedRow,
          totalHours: calculateDailyReportTotalHours(updatedRow)
        };
      })
    }));
  }

  function updateDailyReportPayItemDraft(rowIndex: number, field: keyof DailyReportPayItemRow, value: string) {
    setDailyReportDraft((current) => ({
      ...current,
      payItemRows: current.payItemRows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    }));
  }

  function updateDailyReportItsfmDraft(
    itemKey: string,
    field: keyof Omit<DailyReportItsfmRow, "itemKey">,
    value: string
  ) {
    setDailyReportDraft((current) => ({
      ...current,
      itsfmRows: normalizeDailyReportItsfmRows(current.itsfmRows).map((row) =>
        row.itemKey === itemKey
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    }));
  }

  function copyPreviousDailyReportCrewTime() {
    if (!previousDailyReportCrewTime) {
      setEntryNotice("No previous crew/time setup found for this job.");
      return;
    }

    const currentHasCrewTime = dailyReportDraft.employeeRows.some(dailyReportEmployeeRowHasContent);
    if (
      currentHasCrewTime &&
      !window.confirm(`Replace current crew/time rows with the setup from ${formatDate(previousDailyReportCrewTime.date)}?`)
    ) {
      return;
    }

    setDailyReportDraft((current) => ({
      ...current,
      employeeRows: normalizeDailyReportEmployeeRows(previousDailyReportCrewTime.report.employeeRows).map((row) => ({
        ...row,
        totalHours: row.totalHours || calculateDailyReportTotalHours(row)
      }))
    }));
    setEntryNotice(`Copied crew/time from ${formatDate(previousDailyReportCrewTime.date)}.`);
  }

  function copySavedEntriesToDailyReportWorkRows() {
    if (!selectedProject || visibleEntries.length === 0) {
      setDailyReportDraftNotice("No saved pay item entries are available for this job/day.");
      return;
    }

    const currentHasWorkRows = dailyReportDraft.payItemRows.some(dailyReportPayItemRowHasContent);

    if (
      currentHasWorkRows &&
      !window.confirm("Replace current Work Performed pay item rows with the saved entries for this job/day?")
    ) {
      return;
    }

    const sortedEntries = selectedProject.payItems.flatMap((payItem) =>
      visibleEntries.filter((entry) => entry.payItemId === payItem.id)
    );

    setDailyReportDraft((current) => ({
      ...current,
      payItemRows: normalizeDailyReportPayItemRows(
        sortedEntries.map((entry) => ({
          notes: "",
          payItemId: entry.payItemId,
          quantity: Number.isFinite(entry.quantityCompleted) ? String(entry.quantityCompleted) : ""
        }))
      )
    }));
    setDailyReportDraftNotice(
      sortedEntries.length > createEmptyDailyReportPayItemRows().length
        ? "Copied the first 8 saved pay item entries. Add remaining items manually if needed."
        : "Copied saved pay item entries into Work Performed rows."
    );
  }

  async function saveDailyReport() {
    if (!selectedProject || !currentUser) {
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      return;
    }

    const dayKey = getDayKey(selectedProject.id, workDate);
    const existingReport = dailyReportsByKey[dayKey];
    const now = new Date().toISOString();
    const normalizedDraft = normalizeDailyReportAnswersForSave(dailyReportDraft);
    const dailyReport: DailyReport = {
      ...(existingReport ?? {
        projectId: selectedProject.id,
        date: workDate,
        createdByUserId: currentUser.id,
        createdByName: formatUserName(currentUser),
        createdAt: now
      }),
      ...normalizedDraft,
      updatedAt: now
    };
    const hadUploadedDailyReport = Boolean(dailyReportUploadsByKey[dayKey]);

    setDailyReportsByKey((current) => ({
      ...current,
      [dayKey]: dailyReport
    }));
    setDailyReportUploadsByKey((current) => {
      if (!current[dayKey]) {
        return current;
      }

      const remainingUploads = { ...current };
      delete remainingUploads[dayKey];

      return remainingUploads;
    });
    void saveDatabaseDailyReport(selectedProject.id, workDate, dailyReport).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Daily report saved locally, but did not sync.");
    });
    if (hadUploadedDailyReport) {
      void deleteDatabaseDailyReportUpload(selectedProject.id, workDate).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Daily upload status cleared locally, but did not sync.");
      });
    }
    clearDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
    setDailyReportUploadNotice(null);
    setEntryNotice("Daily report saved.");
  }

  async function downloadDailyReportPdf() {
    if (!selectedProject || !currentDailyReport) {
      setDailyReportUploadNotice({
        message: "Create and save a daily report before downloading the PDF.",
        status: "error"
      });
      return;
    }

    if (userIsOffline) {
      setDailyReportUploadNotice({
        message: "You appear to be offline. Reconnect before downloading the daily report PDF.",
        status: "error"
      });
      return;
    }

    const validation = validateDailyReportAnswers(currentDailyReport, selectedProject.payItems, {
      template: getDailyReportTemplateForProject(selectedProject)
    });

    if (validation.errors.length > 0) {
      setDailyReportUploadNotice({
        message: formatDailyReportValidationMessage(validation.errors),
        status: "error"
      });
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      setDailyReportUploadNotice({
        message: "The daily report changed in the database. Review the latest version before downloading.",
        status: "error"
      });
      return;
    }

    setDownloadingDailyReportPdf(true);
    setDailyReportUploadNotice(null);

    try {
      const response = await fetch("/api/daily-reports/pdf", {
        body: JSON.stringify({
          date: workDate,
          dayNotes: currentDayEntryNotes,
          project: selectedProject,
          report: currentDailyReport
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to download daily report PDF."));
      }

      const blob = await response.blob();
      const fileName = readDownloadFileName(response.headers) ?? `daily-report-${workDate}.pdf`;

      downloadBlob(blob, fileName);
      setDailyReportUploadNotice({
        message: `Downloaded ${fileName}.`,
        status: "success"
      });
    } catch (error) {
      setDailyReportUploadNotice({
        message: error instanceof Error ? error.message : "Unable to download daily report PDF.",
        status: "error"
      });
    } finally {
      setDownloadingDailyReportPdf(false);
    }
  }

  async function uploadDailyReportToProcoreDocuments() {
    if (!selectedProject || !currentDailyReport) {
      setDailyReportUploadNotice({
        message: "Create and save a daily report before uploading to Procore.",
        status: "error"
      });
      return;
    }

    if (userIsOffline) {
      setDailyReportUploadNotice({
        message: "You appear to be offline. Reconnect before uploading the daily report to Procore.",
        status: "error"
      });
      return;
    }

    const validation = validateDailyReportAnswers(currentDailyReport, selectedProject.payItems, {
      template: getDailyReportTemplateForProject(selectedProject)
    });

    if (validation.errors.length > 0) {
      setDailyReportUploadNotice({
        message: formatDailyReportValidationMessage(validation.errors),
        status: "error"
      });
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      setDailyReportUploadNotice({
        message: "The daily report changed in the database. Review the latest version before uploading to Procore.",
        status: "error"
      });
      return;
    }

    setUploadingDailyReport(true);
    setDailyReportUploadNotice(null);

    try {
      await uploadDailyReportForDay({
        date: workDate,
        dayNotes: currentDayEntryNotes,
        project: selectedProject,
        report: currentDailyReport,
        showCurrentDayNotice: true
      });
    } finally {
      setUploadingDailyReport(false);
    }
  }

  async function retryDailyReportUpload(dayKey: string) {
    const dayKeyParts = parseDayKey(dayKey);

    if (!dayKeyParts) {
      return;
    }

    const project = projects.find((candidate) => candidate.id === dayKeyParts.projectId);
    const report = dailyReportsByKey[dayKey];

    if (!project || !report) {
      setEntryNotice("Unable to retry upload because the report or project is no longer available.");
      return;
    }

    if (shouldBlockOfflineAction(setEntryNotice)) {
      return;
    }

    if (!(await ensureDailyReportIsCurrent(project.id, dayKeyParts.date))) {
      return;
    }

    setRetryingDailyReportUploadKey(dayKey);
    setEntryNotice("");

    try {
      await uploadDailyReportForDay({
        date: dayKeyParts.date,
        dayNotes: dayEntryNotesByKey[dayKey] ?? { inventory: "", notes: "" },
        project,
        report,
        showCurrentDayNotice: selectedProject?.id === project.id && workDate === dayKeyParts.date
      });
    } finally {
      setRetryingDailyReportUploadKey("");
    }
  }

  async function uploadDailyReportForDay({
    date,
    dayNotes,
    project,
    report,
    showCurrentDayNotice
  }: {
    date: string;
    dayNotes: DayEntryNotes;
    project: Project;
    report: DailyReport;
    showCurrentDayNotice: boolean;
  }) {
    const dayKey = getDayKey(project.id, date);
    const validation = validateDailyReportAnswers(report, project.payItems, {
      template: getDailyReportTemplateForProject(project)
    });

    if (validation.errors.length > 0) {
      showDailyReportUploadMessage(formatDailyReportValidationMessage(validation.errors), "error", showCurrentDayNotice);
      return;
    }

    try {
      const response = await fetch("/api/procore/daily-reports/upload", {
        body: JSON.stringify({
          date,
          dayNotes,
          project,
          report
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as DailyReportUploadResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to upload daily report to Procore.");
      }

      const dailyReportUpload: DailyReportUpload = {
        companyId: data.companyId,
        fileName: data.fileName ?? "daily report",
        folderId: data.folderId,
        folderPath: data.folderPath ?? "Daily Reports",
        folderUrl: data.folderUrl ?? buildProcoreDocumentsFolderUrl(data.companyId, project.id, data.folderId),
        procoreFileId: data.procoreFileId,
        status: "uploaded",
        uploadedAt: new Date().toISOString()
      };

      setDailyReportUploadsByKey((current) => ({
        ...current,
        [dayKey]: dailyReportUpload
      }));
      try {
        await saveDatabaseDailyReportUpload(project.id, date, dailyReportUpload);
      } catch (syncError) {
        showDailyReportUploadMessage(
          syncError instanceof Error ? syncError.message : "Daily uploaded, but upload status did not sync.",
          "error",
          showCurrentDayNotice
        );
        return;
      }
      showDailyReportUploadMessage(
        getDailyReportProcoreStatus(report, dailyReportUpload, project.id, currentUser?.role ?? "standard").message,
        "success",
        showCurrentDayNotice
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload daily report to Procore.";
      const failedDailyReportUpload: DailyReportUpload = {
        attemptedAt: new Date().toISOString(),
        error: message,
        fileName: buildDailyReportUploadFileName(project.name, date),
        folderPath: "Daily Reports",
        status: "failed"
      };

      setDailyReportUploadsByKey((current) => ({
        ...current,
        [dayKey]: failedDailyReportUpload
      }));
      try {
        await saveDatabaseDailyReportUpload(project.id, date, failedDailyReportUpload);
      } catch (syncError) {
        showDailyReportUploadMessage(
          syncError instanceof Error ? syncError.message : "Upload failed, but failure status did not sync.",
          "error",
          showCurrentDayNotice
        );
        return;
      }
      showDailyReportUploadMessage(message, "error", showCurrentDayNotice);
    }
  }

  function showDailyReportUploadMessage(message: string, status: "error" | "success", showCurrentDayNotice: boolean) {
    if (showCurrentDayNotice) {
      setDailyReportUploadNotice({
        message,
        status
      });
      return;
    }

    setEntryNotice(message);
  }

  async function createJobImageQueueItem(file: File): Promise<JobImageQueueItem> {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${file.name || "Selected file"} is not an image.`);
    }

    const preparedFile = await prepareJobImageFileForUpload(file);
    const previewUrl = URL.createObjectURL(preparedFile);

    jobImagePreviewUrlsRef.current.add(previewUrl);

    return {
      caption: "",
      file: preparedFile,
      id: crypto.randomUUID(),
      originalName: file.name || preparedFile.name,
      previewUrl,
      size: preparedFile.size,
      status: "queued"
    };
  }

  function updateJobImageCaption(imageId: string, caption: string) {
    setJobImageQueue((current) => current.map((item) => (item.id === imageId ? { ...item, caption } : item)));
  }

  function revokeJobImagePreview(previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    jobImagePreviewUrlsRef.current.delete(previewUrl);
  }

  async function addJobImages(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    if (!selectedProject) {
      setJobImageNotice({
        message: "Select a job before adding images.",
        status: "error"
      });
      return;
    }

    const remainingQueueSlots = Math.max(0, MAX_JOB_IMAGE_QUEUE_ITEMS - jobImageQueue.length);
    const remainingSlots = Math.min(remainingQueueSlots, remainingQueueableJobImageSlots);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    if (remainingSlots === 0) {
      if (remainingQueueableJobImageSlots === 0) {
        setJobImageNotice({
          message: jobImageDailyLimitReached
            ? `This job/day already has the maximum ${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded images.`
            : `Upload or remove queued images before adding more. ${remainingJobImageSlots} upload slot${
                remainingJobImageSlots === 1 ? "" : "s"
              } remain for this job/day.`,
          status: "error"
        });
        return;
      }

      setJobImageNotice({
        message: `Upload or remove queued images before adding more. The temporary queue holds ${MAX_JOB_IMAGE_QUEUE_ITEMS} images.`,
        status: "error"
      });
      return;
    }

    setJobImageNotice(null);

    try {
      const queueItems = await Promise.all(selectedFiles.map(createJobImageQueueItem));

      setJobImageQueue((current) => [...current, ...queueItems]);

      if (selectedFiles.length < files.length) {
        setJobImageNotice({
          message: `Added ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}. Extra selected images were not added because of the job/day limit or temporary queue limit.`,
          status: "success"
        });
      }
    } catch (error) {
      setJobImageNotice({
        message: error instanceof Error ? error.message : "Unable to prepare selected images.",
        status: "error"
      });
    } finally {
      if (jobImageInputRef.current) {
        jobImageInputRef.current.value = "";
      }
    }
  }

  function removeJobImageFromQueue(imageId: string) {
    setJobImageQueue((current) => {
      const removedItem = current.find((item) => item.id === imageId);

      if (removedItem) {
        revokeJobImagePreview(removedItem.previewUrl);
      }

      return current.filter((item) => item.id !== imageId);
    });
  }

  function clearUploadedJobImagesFromQueue() {
    setJobImageQueue((current) => {
      const uploadedItems = current.filter((item) => item.status === "uploaded");

      for (const item of uploadedItems) {
        revokeJobImagePreview(item.previewUrl);
      }

      return current.filter((item) => item.status !== "uploaded");
    });
  }

  function clearJobImageQueue() {
    setJobImageQueue((current) => {
      for (const item of current) {
        revokeJobImagePreview(item.previewUrl);
      }

      return [];
    });
    setJobImageNotice(null);
  }

  async function uploadQueuedJobImages() {
    await uploadJobImageItems(
      jobImageQueue.filter((image) => image.status === "queued" || image.status === "failed"),
      "Add at least one image before uploading."
    );
  }

  async function retryFailedJobImages() {
    await uploadJobImageItems(failedQueuedJobImages, "No failed images are waiting to retry.");
  }

  async function uploadJobImageItems(imagesToUpload: JobImageQueueItem[], emptyMessage: string) {
    if (!selectedProject) {
      setJobImageNotice({
        message: "Select a job before uploading images.",
        status: "error"
      });
      return;
    }

    if (userIsOffline) {
      setJobImageNotice({
        message: "You appear to be offline. Reconnect before uploading images to Procore.",
        status: "error"
      });
      return;
    }

    if (imagesToUpload.length === 0) {
      setJobImageNotice({
        message: emptyMessage,
        status: "error"
      });
      return;
    }

    if (remainingJobImageSlots === 0) {
      setJobImageNotice({
        message: `This job/day already has the maximum ${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded images.`,
        status: "error"
      });
      return;
    }

    if (imagesToUpload.length > remainingJobImageSlots) {
      setJobImageNotice({
        message: `Only ${remainingJobImageSlots} image${remainingJobImageSlots === 1 ? "" : "s"} can still be uploaded for this job/day. Remove extra queued images before uploading.`,
        status: "error"
      });
      return;
    }

    setUploadingJobImages(true);
    setJobImageNotice(null);
    setJobImageQueue((current) =>
      current.map((item) =>
        imagesToUpload.some((image) => image.id === item.id)
          ? {
              ...item,
              error: undefined,
              status: "uploading"
            }
          : item
      )
    );

    let uploadedCount = 0;
    let failedCount = 0;

    try {
      const batches = chunkJobImagesForUpload(imagesToUpload);

      for (const [batchIndex, batch] of batches.entries()) {
        if (batchIndex > 0) {
          await waitForClientDelay(JOB_IMAGE_CLIENT_BATCH_DELAY_MS);
        }

        const formData = new FormData();

        formData.set("date", workDate);
        formData.set(
          "project",
          JSON.stringify({
            id: selectedProject.id,
            name: selectedProject.name,
            payItems: [],
            procoreProjectId: selectedProject.procoreProjectId
          } satisfies Project)
        );

        for (const item of batch) {
          formData.append("images", item.file, item.file.name);
          formData.append("imageClientIds", item.id);
          formData.append("imageCaptions", item.caption);
          formData.append("originalFileNames", item.originalName);
        }

        try {
          const response = await fetch("/api/procore/job-images/upload", {
            body: formData,
            method: "POST"
          });
          const data = (await readApiJson(response)) as JobImageUploadResponse;

          if (!response.ok) {
            throw new Error(data.error ?? "Unable to upload job images to Procore.");
          }

          const uploadedByClientId = new Map((data.uploads ?? []).map((upload) => [uploadClientId(upload), upload]));
          const returnedUploads = data.uploads ?? [];

          uploadedCount += returnedUploads.filter((upload) => upload.status === "uploaded").length;
          failedCount += returnedUploads.filter((upload) => upload.status === "failed").length;

          setJobImageQueue((current) =>
            current.map((item) => {
              const upload = uploadedByClientId.get(item.id);

              if (!upload) {
                return item;
              }

              return {
                ...item,
                error: upload.error,
                status: upload.status,
                uploadedFileName: upload.fileName
              };
            })
          );
          setJobImageUploadsByDay((current) => ({
            ...current,
            [currentDayKey]: mergeJobImageUploads(current[currentDayKey] ?? [], returnedUploads)
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to upload job images to Procore.";

          failedCount += batch.length;
          setJobImageQueue((current) =>
            current.map((item) =>
              batch.some((image) => image.id === item.id)
                ? {
                    ...item,
                    error: message,
                    status: "failed"
                  }
                : item
            )
          );
        }
      }

      if (uploadedCount > 0 && failedCount === 0) {
        setJobImageNotice({
          message: `Uploaded ${uploadedCount} job image${uploadedCount === 1 ? "" : "s"} to Procore.`,
          status: "success"
        });
      } else if (uploadedCount > 0) {
        setJobImageNotice({
          message: `Uploaded ${uploadedCount} image${uploadedCount === 1 ? "" : "s"}; ${failedCount} failed and can be retried.`,
          status: "error"
        });
      } else {
        setJobImageNotice({
          message: "No images were uploaded. Review the failed image messages and try again.",
          status: "error"
        });
      }
    } finally {
      setUploadingJobImages(false);
    }
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

  function applySharedAppState(state: Partial<SharedAppState> | null) {
    const normalizedState = normalizeSharedAppState(state);

    setEntries(normalizedState.entries);
    setDaySubmissions(normalizedState.daySubmissions);
    setDayEntryNotesByKey(normalizedState.dayEntryNotesByKey);
    setDailyReportsByKey(normalizedState.dailyReportsByKey);
    setDailyReportUploadsByKey(normalizedState.dailyReportUploadsByKey);
    setSyncLog(normalizedState.syncLog);
    setCrewMembersByProject(normalizedState.crewMembersByProject);
    setCrewDirectory(
      mergeCrewDirectories(
        normalizedState.crewDirectory,
        buildCrewDirectoryFromProjects(normalizedState.crewMembersByProject)
      )
    );
    setMyJobsByUser(normalizedState.myJobsByUser);
    setProjectArchiveById(normalizedState.projectArchiveById);
    setProjectBlacklistById(normalizedState.projectBlacklistById);
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

  function addCrewMember() {
    if (!selectedProject) {
      return;
    }

    const name = crewMemberName.trim();
    const jobTitle = crewMemberJobTitle.trim();
    const laborType = crewMemberLaborType === "temp_employee" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE;

    if (!name || !jobTitle) {
      setEntryNotice("Enter both crew member name and job title.");
      return;
    }

    const matchingCrewMember = crewDirectory.find((member) => normalizeCrewName(member.name) === normalizeCrewName(name));

    if (matchingCrewMember) {
      setEntryNotice(`A crew member named ${matchingCrewMember.name} already exists. Select them from existing crew instead.`);
      return;
    }

    const crewMember = {
      id: crypto.randomUUID(),
      laborType,
      name,
      jobTitle
    };

    setCrewDirectory((current) => sortCrewMembersByName([...current, crewMember]));
    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: [
        ...(current[selectedProject.id] ?? []),
        crewMember
      ]
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member added locally, but did not sync.");
    });
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    setSubcontractorVendorSearch("");
    setSelectedSubcontractorVendorId("");
    setSelectedExistingCrewMemberId("");
    setEditingCrewMember(null);
    setEntryNotice(`${name} added to ${selectedProject.name}.`);
  }

  function addSubcontractorVendorToProject() {
    if (!selectedProject) {
      return;
    }

    const vendor =
      selectedSubcontractorVendor ??
      (filteredSubcontractorVendors.length === 1 ? filteredSubcontractorVendors[0] : null);

    if (!vendor) {
      setEntryNotice("Select a NetSuite vendor to add as a subcontractor.");
      return;
    }

    const companyName = vendor.name.trim();
    const vendorCrewMemberId = getNetSuiteVendorCrewMemberId(vendor.id);
    const matchingSubcontractor = crewDirectory.find(
      (member) =>
        getCrewLaborType(member) === "subcontractor" &&
        (member.id === vendorCrewMemberId ||
          member.netSuiteVendorId === vendor.id ||
          normalizeCrewName(getCrewDisplayName(member)) === normalizeCrewName(companyName))
    );

    const crewMember = {
      ...(matchingSubcontractor ?? {}),
      id: matchingSubcontractor?.id ?? vendorCrewMemberId,
      laborType: "subcontractor" as CrewLaborType,
      name: companyName,
      jobTitle: "Subcontractor",
      netSuiteVendorEntityId: vendor.entityId,
      netSuiteVendorId: vendor.id,
      subcontractorCompany: companyName
    };

    const alreadyOnProject = projectHasCrewMember(selectedProjectCrewMembers, crewMember.id);

    setCrewDirectory((current) =>
      sortCrewMembersByName(
        current.some((member) => member.id === crewMember.id)
          ? current.map((member) => (member.id === crewMember.id ? crewMember : member))
          : [...current, crewMember]
      )
    );
    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: alreadyOnProject
        ? sortCrewMembersByName(
            (current[selectedProject.id] ?? []).map((member) => (member.id === crewMember.id ? crewMember : member))
          )
        : sortCrewMembersByName([...(current[selectedProject.id] ?? []), crewMember])
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Subcontractor added locally, but did not sync.");
    });
    setSubcontractorVendorSearch("");
    setSelectedSubcontractorVendorId("");
    setSelectedExistingCrewMemberId("");
    setEditingCrewMember(null);
    setEntryNotice(
      alreadyOnProject ? `${companyName} is already saved to this job.` : `${companyName} added to ${selectedProject.name}.`
    );
  }

  function addExistingCrewMemberToProject() {
    if (!selectedProject || !selectedExistingCrewMemberId) {
      return;
    }

    const crewMember = crewDirectory.find((member) => member.id === selectedExistingCrewMemberId);

    if (!crewMember) {
      setEntryNotice("Select an existing crew member to add.");
      return;
    }

    if (projectHasCrewMember(selectedProjectCrewMembers, crewMember.id)) {
      setEntryNotice(`${getCrewDisplayName(crewMember)} is already saved to this job.`);
      return;
    }

    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: sortCrewMembersByName([...(current[selectedProject.id] ?? []), crewMember])
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member added locally, but did not sync.");
    });
    setSelectedExistingCrewMemberId("");
    setEntryNotice(`${getCrewDisplayName(crewMember)} added to ${selectedProject.name}.`);
  }

  function startEditingCrewMember(member: CrewMember) {
    setEntryNotice("");
    const laborType = getCrewLaborType(member);
    const displayName = getCrewDisplayName(member);

    setEditingCrewMember({
      crewMemberId: member.id,
      laborType,
      name: displayName,
      jobTitle: laborType === "subcontractor" ? "Subcontractor" : member.jobTitle,
      subcontractorCompany: laborType === "subcontractor" ? displayName : ""
    });
  }

  function saveEditedCrewMember() {
    if (!selectedProject || !editingCrewMember) {
      return;
    }

    const laborType = editingCrewMember.laborType;
    const subcontractorCompany = laborType === "subcontractor" ? editingCrewMember.subcontractorCompany.trim() : "";
    const name = laborType === "subcontractor" ? subcontractorCompany : editingCrewMember.name.trim();
    const jobTitle = laborType === "subcontractor" ? "Subcontractor" : editingCrewMember.jobTitle.trim();

    if (!name || !jobTitle) {
      setEntryNotice(laborType === "subcontractor" ? "Enter the subcontractor company name." : "Enter both crew member name and job title.");
      return;
    }

    const matchingCrewMember = crewDirectory.find(
      (member) =>
        member.id !== editingCrewMember.crewMemberId &&
        normalizeCrewName(getCrewDisplayName(member)) === normalizeCrewName(name)
    );

    if (matchingCrewMember) {
      setEntryNotice(`A crew member or subcontractor named ${getCrewDisplayName(matchingCrewMember)} already exists. Use that existing record instead.`);
      return;
    }

    setCrewDirectory((current) =>
      sortCrewMembersByName(
        current.map((member) =>
          member.id === editingCrewMember.crewMemberId
            ? {
                ...member,
                laborType,
                name,
                jobTitle,
                subcontractorCompany: subcontractorCompany || undefined
              }
            : member
        )
      )
    );
    setCrewMembersByProject((current) =>
      Object.fromEntries(
        Object.entries(current).map(([projectId, crewMembers]) => [
          projectId,
          sortCrewMembersByName(
            crewMembers.map((member) =>
              member.id === editingCrewMember.crewMemberId
                ? {
                    ...member,
                    laborType,
                    name,
                    jobTitle,
                    subcontractorCompany: subcontractorCompany || undefined
                  }
                : member
            )
          )
        ])
      ) as CrewMembersByProject
    );
    const originalCrewMember = crewDirectory.find((member) => member.id === editingCrewMember.crewMemberId);
    const updatedCrewMember = {
      ...(originalCrewMember ?? {}),
      id: editingCrewMember.crewMemberId,
      laborType,
      name,
      jobTitle,
      subcontractorCompany: subcontractorCompany || undefined
    };
    const nextEntries = entries.map((entry) => {
      if (!entry.crewAllocations?.length) {
        return entry;
      }

      let entryChanged = false;
      const crewAllocations = entry.crewAllocations.map((allocation) => {
        if (allocation.crewMemberId !== editingCrewMember.crewMemberId) {
          return allocation;
        }

        entryChanged = true;
        return {
          ...allocation,
          crewMemberName: name,
          jobTitle,
          laborType,
          subcontractorCompany: subcontractorCompany || undefined
        };
      });

      if (!entryChanged) {
        return entry;
      }

      return {
        ...entry,
        crewAllocations
      };
    });
    const changedEntries = nextEntries.filter((entry, index) => entry !== entries[index]);

    setEntries(nextEntries);
    void updateDatabaseCrewMember(updatedCrewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member updated locally, but did not sync.");
    });
    if (changedEntries.length > 0) {
      void saveDatabaseEntries(changedEntries).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Crew member updated locally, but saved entry rows did not sync.");
      });
    }
    setEditingCrewMember(null);
    setEntryNotice(`${name} updated across saved days.`);
  }

  function removeCrewMember(crewMemberId: string) {
    if (!selectedProject) {
      return;
    }

    if (crewMemberHasSavedAllocations(crewMemberId, selectedProject.id, entries)) {
      setEntryNotice("Crew member is already assigned to saved pay item hours and cannot be deleted.");
      return;
    }

    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: (current[selectedProject.id] ?? []).filter((member) => member.id !== crewMemberId)
    }));
    void removeDatabaseCrewMemberFromProject(selectedProject.id, crewMemberId).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member removed locally, but did not sync.");
    });
    setDraftsByPayItem((current) =>
      Object.fromEntries(
        Object.entries(current).map(([payItemId, draft]) => [
          payItemId,
          {
            ...draft,
            crewMemberIds: draft.crewMemberIds.filter((id) => id !== crewMemberId),
            crewHours: Object.fromEntries(
              Object.entries(draft.crewHours).filter(([id]) => id !== crewMemberId)
            )
          }
        ])
      )
    );
    setEditingCrewMember((current) => (current?.crewMemberId === crewMemberId ? null : current));
  }

  function mergeCrewMembers() {
    if (currentUser?.role !== "admin") {
      return;
    }

    const sourceCrewMember = crewDirectory.find((member) => member.id === mergeSourceCrewMemberId);
    const targetCrewMember = crewDirectory.find((member) => member.id === mergeTargetCrewMemberId);

    if (!sourceCrewMember || !targetCrewMember) {
      setEntryNotice("Select both crew members before merging.");
      return;
    }

    if (sourceCrewMember.id === targetCrewMember.id) {
      setEntryNotice("Select two different crew members before merging.");
      return;
    }

    const confirmed = window.confirm(
      `Merge ${getCrewDisplayName(sourceCrewMember)} into ${getCrewDisplayName(targetCrewMember)}? This updates saved entries, reports, project crew lists, and draft allocations.`
    );

    if (!confirmed) {
      return;
    }

    const nextEntries = entries.map((entry) => mergeEntryCrewAllocations(entry, sourceCrewMember.id, targetCrewMember));
    const changedEntries = nextEntries.filter((entry, index) => entry !== entries[index]);

    setCrewDirectory((current) => current.filter((member) => member.id !== sourceCrewMember.id));
    setCrewMembersByProject((current) => mergeProjectCrewMembers(current, sourceCrewMember.id, targetCrewMember));
    setEntries(nextEntries);
    void mergeDatabaseCrewMembers(sourceCrewMember.id, targetCrewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew members merged locally, but crew records did not sync.");
    });
    if (changedEntries.length > 0) {
      void saveDatabaseEntries(changedEntries).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Crew members merged locally, but saved entry rows did not sync.");
      });
    }
    setDraftsByPayItem((current) => mergeDraftCrewMembers(current, sourceCrewMember.id, targetCrewMember.id));
    setSelectedExistingCrewMemberId((current) => (current === sourceCrewMember.id ? "" : current));
    setEditingCrewMember((current) => (current?.crewMemberId === sourceCrewMember.id ? null : current));
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId(targetCrewMember.id);
    setEntryNotice(`${getCrewDisplayName(sourceCrewMember)} merged into ${getCrewDisplayName(targetCrewMember)}.`);
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

  function addSyncLog(entry: Omit<SyncLogEntry, "id" | "createdAt">) {
    const syncLogEntry = normalizeSyncLogEntry({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry
    });

    if (!syncLogEntry) {
      return;
    }

    setSyncLog((current) =>
      [syncLogEntry, ...current].slice(0, 25)
    );
    void saveDatabaseSyncLogEntry(syncLogEntry).catch((error) => {
      setProjectLoadError(error instanceof Error ? error.message : "Sync log saved locally, but did not sync.");
    });
  }

  async function syncProcoreData() {
    if (shouldBlockOfflineAction(setProjectLoadError)) {
      return;
    }

    setSyncing(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/procore/sync",
        "Sync New Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync NetSuite project data.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const nextProjectArchiveById = data.projectArchiveById ?? projectArchiveById;
      const visibleSyncedProjects = filterActiveProjects(sortedProjects, projectBlacklistById, nextProjectArchiveById);
      setAllProjects(sortedProjects);
      setProjectArchiveById(nextProjectArchiveById);
      setSelectedProjectId((currentProjectId) =>
        visibleSyncedProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : visibleSyncedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      const summary = normalizeSyncSummary(data.summary);
      setSyncSummary(summary ?? null);
      const message = buildSyncStatus("New project sync", summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync New Projects",
        status: hasSyncWarnings(summary) ? "warning" : "success",
        message,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync NetSuite project data.";
      setProjectLoadError(message);
      setConnectionStatus("Project sync failed");
      addSyncLog({
        action: "Sync New Projects",
        status: "error",
        message
      });
    } finally {
      setSyncing(false);
    }
  }

  async function syncAllProcoreData() {
    if (shouldBlockOfflineAction(setProjectLoadError)) {
      return;
    }

    setSyncingAll(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/procore/sync-all",
        "Sync All Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync all NetSuite projects.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const nextProjectArchiveById = data.projectArchiveById ?? projectArchiveById;
      const visibleSyncedProjects = filterActiveProjects(sortedProjects, projectBlacklistById, nextProjectArchiveById);
      setAllProjects(sortedProjects);
      setProjectArchiveById(nextProjectArchiveById);
      setSelectedProjectId((currentProjectId) =>
        visibleSyncedProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : visibleSyncedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      const summary = normalizeSyncSummary(data.summary);
      setSyncSummary(summary ?? null);
      const message = buildSyncStatus("Full sync", summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync All Projects",
        status: hasSyncWarnings(summary) ? "warning" : "success",
        message,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync all NetSuite projects.";
      setProjectLoadError(message);
      setConnectionStatus("Full sync failed");
      addSyncLog({
        action: "Sync All Projects",
        status: "error",
        message
      });
    } finally {
      setSyncingAll(false);
    }
  }

  async function addOrUpdateProject() {
    if (shouldBlockOfflineAction(setProjectLoadError)) {
      return;
    }

    const projectId = window.prompt("Enter the NetSuite project ID or Procore project ID to add or update.", selectedProjectId);
    const trimmedProjectId = projectId?.trim();

    if (!trimmedProjectId) {
      return;
    }

    setUpdatingProject(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const response = await fetch(`/api/procore/projects/${encodeURIComponent(trimmedProjectId)}/sync`, {
        method: "POST"
      });
      const data = (await readApiJson(response)) as ProjectsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add or update project.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const nextProjectArchiveById = data.projectArchiveById ?? projectArchiveById;
      const visibleSyncedProjects = filterActiveProjects(sortedProjects, projectBlacklistById, nextProjectArchiveById);
      const syncedProject = visibleSyncedProjects.find((project) => projectMatchesIdentifier(project, trimmedProjectId));
      setAllProjects(sortedProjects);
      setProjectArchiveById(nextProjectArchiveById);
      setSelectedProjectId((currentProjectId) => syncedProject?.id ?? currentProjectId);
      setSyncedAt(data.syncedAt ?? null);
      setConnectionStatus("Project added or updated");
      setDraftsByPayItem({});
      addSyncLog({
        action: "Add/Update Project",
        status: "success",
        message: `Project ${trimmedProjectId} added or updated`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add or update project.";
      setProjectLoadError(message);
      setConnectionStatus("Project add/update failed");
      addSyncLog({
        action: "Add/Update Project",
        status: "error",
        message
      });
    } finally {
      setUpdatingProject(false);
    }
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

  async function saveAllocationEntries() {
    if (!selectedProject || !currentUser || dayIsSubmitted || savingEntries) {
      return;
    }

    if (shouldBlockOfflineAction(setEntryNotice)) {
      return;
    }

    const incompleteCount = selectedProject.payItems.filter((payItem) =>
      draftIsIncomplete(draftsByPayItem[payItem.id])
    ).length;

    if (incompleteCount > 0) {
      setEntryNotice("Allocate crew hours and enter quantity before saving a row.");
      return;
    }

    const crewAllocationError = selectedProject.payItems
      .map((payItem) => getCrewAllocationError(draftsByPayItem[payItem.id], selectedProjectCrewMembers))
      .find(Boolean);

    if (crewAllocationError) {
      setEntryNotice(crewAllocationError);
      return;
    }

    const overrunWarnings = getDraftQuantityOverrunWarnings(
      selectedProject.payItems,
      draftsByPayItem,
      visibleEntries,
      remainingQuantitiesByPayItem
    );

    if (overrunWarnings.length > 0 && !confirmQuantityOverrun(overrunWarnings)) {
      setEntryNotice("Save cancelled. Adjust quantities or save again to confirm the overrun.");
      return;
    }

    setSavingEntries(true);
    setEntryNotice("Saving entries...");

    try {
      if (!(await ensureEntriesAreCurrent(selectedProject.id, workDate))) {
        return;
      }

      const nextEntries = selectedProject.payItems.flatMap((payItem) => {
        const draft = draftsByPayItem[payItem.id];
        const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItem.id);

        if (!draftIsSaveable(draft)) {
          return [];
        }

        const hours = getDraftTotalHours(draft, existingEntry);
        const quantity = draft?.quantity ? Number(draft.quantity) : existingEntry?.quantityCompleted ?? 0;

        return [
          {
            id: existingEntry?.id ?? crypto.randomUUID(),
            projectId: selectedProject.id,
            projectName: existingEntry?.projectName ?? selectedProject.name,
            date: workDate,
            payItemId: payItem.id,
            payItemCode: existingEntry?.payItemCode ?? payItem.code,
            payItemName: existingEntry?.payItemName ?? payItem.name,
            payItemBudgetedQuantity: existingEntry?.payItemBudgetedQuantity ?? payItem.budgetedQuantity,
            payItemUnitOfMeasure: existingEntry?.payItemUnitOfMeasure ?? formatPayItemUnitOfMeasure(payItem),
            hours,
            quantityCompleted: quantity,
            crewAllocations: buildCrewAllocations(draft, selectedProjectCrewMembers, hours),
            savedByUserId: currentUser.id,
            savedByName: formatUserName(currentUser),
            savedAt: new Date().toISOString()
          }
        ];
      });

      if (nextEntries.length === 0) {
        return;
      }

      setEntries((current) => {
        const upsertIds = new Set(nextEntries.map((entry) => entry.id));
        return [...current.filter((entry) => !upsertIds.has(entry.id)), ...nextEntries];
      });
      try {
        await saveDatabaseEntries(nextEntries);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Rows saved locally, but did not sync to the database.");
        return;
      }

      setDraftsByPayItem({});
      setEntryNotice(`${nextEntries.length} row${nextEntries.length === 1 ? "" : "s"} saved for ${formatDate(workDate)}.`);
    } finally {
      setSavingEntries(false);
    }
  }

  function clearDraftInputs() {
    setDraftsByPayItem({});
    setEntryNotice("Draft inputs cleared.");
  }

  async function removeEntry(entryId: string) {
    if (dayIsSubmitted || removingEntryId) {
      return;
    }

    const entryToRemove = entries.find((entry) => entry.id === entryId);

    setRemovingEntryId(entryId);
    setEntryNotice("Removing entry...");

    try {
      if (!entryToRemove || !(await ensureEntriesAreCurrent(entryToRemove.projectId, entryToRemove.date))) {
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      try {
        await deleteDatabaseEntry(entryId);
        setEntryNotice("Entry removed.");
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Entry deleted locally, but did not sync to the database.");
      }
    } finally {
      setRemovingEntryId(null);
    }
  }

  async function deleteSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject || deletingSubmittedDay) {
      return;
    }

    setDeletingSubmittedDay(true);
    setEntryNotice("Deleting submitted day...");

    try {
      if (
        !(await ensureEntriesAreCurrent(selectedProject.id, workDate)) ||
        !(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))
      ) {
        return;
      }

      const dayKey = getDayKey(selectedProject.id, workDate);

      setEntries((current) =>
        current.filter((entry) => !(entry.projectId === selectedProject.id && entry.date === workDate))
      );
      try {
        await deleteDatabaseDayEntries(selectedProject.id, workDate);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but entries did not sync.");
        return;
      }
      setDaySubmissions((current) => {
        const next = { ...current };
        delete next[dayKey];
        return next;
      });
      try {
        await deleteDatabaseDaySubmission(selectedProject.id, workDate);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but day status did not sync.");
        return;
      }
      setEditingEntry(null);
      setDraftsByPayItem({});
      setEntryNotice("Submitted day deleted.");
    } finally {
      setDeletingSubmittedDay(false);
    }
  }

  function startEditingEntry(entry: AllocationEntry) {
    setEditingEntry({
      entryId: entry.id,
      hours: String(entry.hours),
      quantity: String(entry.quantityCompleted)
    });
  }

  async function saveEditedEntry() {
    if (!editingEntry || dayIsSubmitted || !currentUser || savingEditedEntry) {
      return;
    }

    const entryToEdit = entries.find((entry) => entry.id === editingEntry.entryId);

    setSavingEditedEntry(true);
    setEntryNotice("Saving edited row...");

    try {
      if (!entryToEdit || !(await ensureEntriesAreCurrent(entryToEdit.projectId, entryToEdit.date))) {
        return;
      }

      const hours = Number(editingEntry.hours);
      const quantity = Number(editingEntry.quantity);

      if (hours < 0 || quantity < 0 || !Number.isFinite(hours) || !Number.isFinite(quantity)) {
        return;
      }

      const remainingQuantity = selectedProject?.id === entryToEdit.projectId
        ? remainingQuantitiesByPayItem[entryToEdit.payItemId]
        : undefined;

      if (
        remainingQuantity !== undefined &&
        quantity > remainingQuantity + 0.0001 &&
        !confirmQuantityOverrun([
          `${entryToEdit.payItemCode}: ${formatPayItemQuantity(quantity)} entered, ${formatPayItemQuantity(remainingQuantity)} remaining.`
        ])
      ) {
        setEntryNotice("Update cancelled. Adjust the quantity or save again to confirm the overrun.");
        return;
      }

      let updatedEntry: AllocationEntry | null = null;
      const nextEntries = entries.map((entry) => {
        if (entry.id !== editingEntry.entryId) {
          return entry;
        }

        updatedEntry = {
          ...entry,
          hours,
          quantityCompleted: quantity,
          crewAllocations: scaleCrewAllocations(entry.crewAllocations ?? [], hours),
          savedByUserId: currentUser.id,
          savedByName: formatUserName(currentUser),
          savedAt: new Date().toISOString()
        };

        return updatedEntry;
      });

      setEntries(nextEntries);
      if (updatedEntry) {
        try {
          await saveDatabaseEntries([updatedEntry]);
        } catch (error) {
          setEntryNotice(error instanceof Error ? error.message : "Daily allocation updated locally, but did not sync.");
          return;
        }
      }
      setEditingEntry(null);
      setEntryNotice("Daily allocation row updated.");
    } finally {
      setSavingEditedEntry(false);
    }
  }

  async function submitDay() {
    if (!selectedProject || !currentUser || visibleEntries.length === 0 || submittingDay) {
      return;
    }

    setSubmittingDay(true);

    try {
      if (
        !(await ensureEntriesAreCurrent(selectedProject.id, workDate)) ||
        !(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))
      ) {
        return;
      }

      if (!window.confirm(`Submit ${selectedProject.name} for ${formatDate(workDate)}? This will lock the day for field edits.`)) {
        return;
      }

      setEntryNotice("Submitting day...");

      const daySubmission: DaySubmission = {
        status: "submitted",
        submittedByUserId: currentUser.id,
        submittedByName: formatUserName(currentUser),
        submittedAt: new Date().toISOString()
      };

      setDaySubmissions((current) => ({
        ...current,
        [getDayKey(selectedProject.id, workDate)]: daySubmission
      }));
      try {
        await saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Day submitted locally, but did not sync.");
        return;
      }
      setEditingEntry(null);
      setDraftsByPayItem({});
      setEntryNotice("Day submitted.");
    } finally {
      setSubmittingDay(false);
    }
  }

  async function reopenSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject || !dayIsSubmitted || reopeningDay) {
      return;
    }

    setReopeningDay(true);
    setEntryNotice("Reopening submitted day...");

    try {
      if (!(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))) {
        return;
      }

      const dayKey = getDayKey(selectedProject.id, workDate);

      const daySubmission: DaySubmission = {
        status: "draft"
      };

      setDaySubmissions((current) => ({
        ...current,
        [dayKey]: daySubmission
      }));
      try {
        await saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day reopened locally, but did not sync.");
        return;
      }
      setEntryNotice("Submitted day reopened.");
    } finally {
      setReopeningDay(false);
    }
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
      onSyncAllProjects={syncAllProcoreData}
      onSyncNetSuiteVendors={syncNetSuiteVendorDirectory}
      onSyncNewProjects={syncProcoreData}
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
              <button className="secondary-button" onClick={() => setChangePasswordOpen(true)} type="button">
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
            <button className="secondary-button" onClick={() => setChangePasswordOpen(true)} type="button">
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
        <aside
          className={[
            "panel",
            "job-setup-panel",
            jobSetupExpanded ? "expanded" : "",
            jobSetupCollapsed ? "collapsed" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <button
            aria-controls="job-setup-body"
            aria-expanded={jobSetupExpanded}
            className="job-setup-mobile-toggle"
            onClick={() => setJobSetupExpanded((current) => !current)}
            type="button"
          >
            <span>
              <strong>Job Setup</strong>
              <small>
                {selectedProject?.name ?? "No job selected"} - {formatDate(workDate)}
              </small>
            </span>
            <ChevronDown aria-hidden="true" size={18} />
          </button>
          <div className="job-setup-desktop-heading">
            <h2 className="job-setup-desktop-title">Job Setup</h2>
            <button
              aria-label={jobSetupCollapsed ? "Expand Job Setup sidebar" : "Collapse Job Setup sidebar"}
              className="job-setup-desktop-toggle"
              onClick={() => setJobSetupCollapsed((current) => !current)}
              title={jobSetupCollapsed ? "Expand Job Setup" : "Collapse Job Setup"}
              type="button"
            >
              {jobSetupCollapsed ? (
                <ChevronRight aria-hidden="true" size={18} />
              ) : (
                <ChevronLeft aria-hidden="true" size={18} />
              )}
            </button>
          </div>
          <div className="job-setup-body" id="job-setup-body">
            <div className="field-group">
              <label htmlFor="project">Job</label>
              <select
                className="desktop-select"
                id="project"
                disabled={jobPickerProjects.length === 0}
                value={selectedProjectId}
                onChange={(event) => {
                  changeSelectedProject(event.target.value);
                }}
              >
                {jobPickerProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <MobileOptionPicker
                disabled={jobPickerProjects.length === 0}
                label="Job"
                options={jobPickerProjects.map((project) => ({
                  value: project.id,
                  label: project.name
                }))}
                value={selectedProjectId}
                onChange={(value) => {
                  changeSelectedProject(value);
                }}
              />
            </div>
          {currentUserCanManageMyProjects ? (
            <div className="my-project-sidebar-tools">
              <button
                aria-expanded={myProjectsEditorOpen}
                className="secondary-button"
                onClick={() => setMyProjectsEditorOpen((current) => !current)}
                type="button"
              >
                <ListChecks aria-hidden="true" size={18} />
                Create/Update My Projects ({currentUserMyJobIds.length})
              </button>
              <label className="compact-check-row">
                <input
                  checked={showOnlyMyProjects}
                  disabled={currentUserMyJobIds.length === 0}
                  onChange={(event) => setShowOnlyMyProjects(event.target.checked)}
                  type="checkbox"
                />
                <span>Show My Projects only</span>
              </label>
            </div>
          ) : currentUser.role === "project_manager" ? (
            <div className="field-note">Your projects are assigned from the NetSuite Project Manager field.</div>
          ) : null}
          {myProjectsEditorOpen ? (
            <MyJobsManager
              automaticJobIds={currentUserAutoMyJobIds}
              description="Tag projects you work on so they are easier to find in entry and dashboard views."
              myJobIds={currentUserMyJobIds}
              projects={projects}
              setMyJobIds={setCurrentUserMyJobIds}
              title="My Projects"
            />
          ) : null}
          {projects.length === 0 && !projectLoadError ? (
            <EmptyState title={allProjects.length > 0 ? "No selectable projects" : "No projects loaded"}>
              {allProjects.length > 0
                ? "All cached projects are currently hidden by admin controls."
                : currentUser.role === "admin"
                  ? "Use Admin Tools to load NetSuite jobs and pay items."
                  : "Projects will appear after an admin syncs NetSuite data."}
            </EmptyState>
          ) : null}
          {projectLoadError ? <div className="inline-alert">{projectLoadError}</div> : null}
          {currentUser.role === "admin" ? (
            syncedAt ? (
              <div className="field-note">Last synced {new Date(syncedAt).toLocaleString()}</div>
            ) : (
              <div className="field-note">Use Admin Tools to load uncached NetSuite jobs and pay items.</div>
            )
          ) : null}

          <div className="field-group">
            <label htmlFor="work-date">Date</label>
            <div className="date-input-wrap">
              <input
                id="work-date"
                ref={dateInputRef}
                type="date"
                value={workDate}
                onChange={(event) => {
                  changeWorkDate(event.target.value);
                }}
              />
              <button
                aria-label="Open date picker"
                className="date-input-button"
                onClick={() => openDatePicker(dateInputRef.current)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          <div className="crew-setup">
            <button
              aria-controls="crew-setup-body"
              aria-expanded={crewSetupExpanded}
              className="crew-setup-heading"
              onClick={() => setCrewSetupExpanded((current) => !current)}
              type="button"
            >
              <span className="crew-setup-title">Crew Members</span>
              <span className="crew-setup-meta">
                <span>{selectedProjectCrewMembers.length}</span>
                <ChevronDown aria-hidden="true" className="crew-setup-chevron" size={18} />
              </span>
            </button>
            {crewSetupExpanded ? (
              <div className="crew-setup-body" id="crew-setup-body">
                <div className="crew-existing-picker">
                  <div className="field-group">
                    <label htmlFor="existing-crew-member">Add Existing Crew Member</label>
                    <select
                      id="existing-crew-member"
                      disabled={!selectedProject || existingCrewMemberOptions.length === 0}
                      value={selectedExistingCrewMemberId}
                      onChange={(event) => setSelectedExistingCrewMemberId(event.target.value)}
                    >
                      <option value="">
                        {existingCrewMemberOptions.length === 0 ? "No existing crew available" : "Select crew member"}
                      </option>
                      {existingCrewMemberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatCrewMemberOption(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={!selectedProject || !selectedExistingCrewMemberId}
                    onClick={addExistingCrewMemberToProject}
                    type="button"
                  >
                    Add to job
                  </button>
                </div>
                <div className="field-note">Add people as crew members. Add subcontractors as company names only.</div>
                {entryNotice && entryNoticeIsCrewRelated(entryNotice) ? (
                  <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div>
                ) : null}
                <div className="crew-form-section">
                  <h3>Crew Member</h3>
                  <div className="field-group">
                    <label htmlFor="crew-member-temp">Temp Employee?</label>
                    <select
                      id="crew-member-temp"
                      disabled={!selectedProject}
                      value={crewMemberLaborType === "temp_employee" ? "yes" : "no"}
                      onChange={(event) =>
                        setCrewMemberLaborType(event.target.value === "yes" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE)
                      }
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="crew-member-name">Name</label>
                    <input
                      id="crew-member-name"
                      disabled={!selectedProject}
                      value={crewMemberName}
                      onChange={(event) => setCrewMemberName(event.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="crew-member-job-title">Job Title</label>
                    <input
                      id="crew-member-job-title"
                      disabled={!selectedProject}
                      value={crewMemberJobTitle}
                      onChange={(event) => setCrewMemberJobTitle(event.target.value)}
                    />
                  </div>
                  <button
                    className="secondary-button crew-add-button"
                    disabled={!selectedProject}
                    onClick={addCrewMember}
                    type="button"
                  >
                    <UserPlus aria-hidden="true" size={18} />
                    Add crew member
                  </button>
                </div>

                <div className="crew-form-section">
                  <h3>Subcontractor</h3>
                  <div className="field-group">
                    <label htmlFor="crew-member-subcontractor-vendor">NetSuite Vendor</label>
                    <div className="vendor-search-picker">
                      <input
                        autoComplete="off"
                        disabled={!selectedProject || loadingNetSuiteVendors || netSuiteVendors.length === 0}
                        id="crew-member-subcontractor-vendor"
                        placeholder={
                          loadingNetSuiteVendors
                            ? "Loading vendors..."
                            : netSuiteVendors.length === 0
                              ? "No vendors loaded"
                              : "Search vendor"
                        }
                        value={subcontractorVendorSearch}
                        onChange={(event) => updateSubcontractorVendorSearch(event.target.value)}
                      />
                      {netSuiteVendors.length > 0 ? (
                        <div className="vendor-search-results" role="listbox">
                          {filteredSubcontractorVendors.length === 0 ? (
                            <div className="vendor-search-empty">No matching vendors.</div>
                          ) : (
                            filteredSubcontractorVendors.map((vendor) => (
                              <button
                                aria-selected={selectedSubcontractorVendorId === vendor.id}
                                className={selectedSubcontractorVendorId === vendor.id ? "vendor-search-option selected" : "vendor-search-option"}
                                key={vendor.id}
                                onClick={() => selectSubcontractorVendor(vendor)}
                                role="option"
                                type="button"
                              >
                                <span>{formatNetSuiteVendorOption(vendor)}</span>
                                <small>{vendor.defaultAddress}</small>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {netSuiteVendors.length === 0 ? (
                    <div className="field-note">
                      Admins can use Get Vendors in Admin Tools to load NetSuite vendors with default addresses.
                    </div>
                  ) : null}
                  <button
                    className="secondary-button crew-add-button"
                    disabled={!selectedProject || (!selectedSubcontractorVendorId && filteredSubcontractorVendors.length !== 1)}
                    onClick={addSubcontractorVendorToProject}
                    type="button"
                  >
                    <UserPlus aria-hidden="true" size={18} />
                    Add subcontractor
                  </button>
                </div>
                <div className="crew-list">
                  {selectedProjectCrewMembers.length === 0 ? (
                    <EmptyState icon={Users} title="No crew assigned">
                      Add crew members or subcontractors to make pay item hour allocation available.
                    </EmptyState>
                  ) : (
                    selectedProjectCrewMembers.map((member) => {
                      const memberIsUsed = selectedProject
                        ? crewMemberHasSavedAllocations(member.id, selectedProject.id, entries)
                        : false;

                      return (
                        <div className="crew-list-row" key={member.id}>
                          {editingCrewMember?.crewMemberId === member.id ? (
                            <div className="crew-edit-form">
                              {editingCrewMember.laborType === "subcontractor" ? (
                                <input
                                  aria-label={`Edit company name for ${getCrewDisplayName(member)}`}
                                  placeholder="Company name"
                                  value={editingCrewMember.subcontractorCompany}
                                  onChange={(event) =>
                                    setEditingCrewMember((current) =>
                                      current ? { ...current, subcontractorCompany: event.target.value } : current
                                    )
                                  }
                                />
                              ) : (
                                <>
                                  <input
                                    aria-label={`Edit name for ${getCrewDisplayName(member)}`}
                                    value={editingCrewMember.name}
                                    onChange={(event) =>
                                      setEditingCrewMember((current) =>
                                        current ? { ...current, name: event.target.value } : current
                                      )
                                    }
                                  />
                                  <input
                                    aria-label={`Edit job title for ${getCrewDisplayName(member)}`}
                                    value={editingCrewMember.jobTitle}
                                    onChange={(event) =>
                                      setEditingCrewMember((current) =>
                                        current ? { ...current, jobTitle: event.target.value } : current
                                      )
                                    }
                                  />
                                  <select
                                    aria-label={`Edit temp employee status for ${getCrewDisplayName(member)}`}
                                    value={editingCrewMember.laborType === "temp_employee" ? "yes" : "no"}
                                    onChange={(event) =>
                                      setEditingCrewMember((current) =>
                                        current
                                          ? {
                                              ...current,
                                              laborType:
                                                event.target.value === "yes" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE
                                            }
                                          : current
                                      )
                                    }
                                  >
                                    <option value="no">Temp Employee? No</option>
                                    <option value="yes">Temp Employee? Yes</option>
                                  </select>
                                </>
                              )}
                              <div className="crew-edit-actions">
                                <button className="secondary-button" onClick={saveEditedCrewMember} type="button">
                                  Save
                                </button>
                                <button className="icon-button" onClick={() => setEditingCrewMember(null)} type="button">
                                  <X aria-hidden="true" size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>
                                <strong>{getCrewDisplayName(member)}</strong>
                                {formatCrewMemberMeta(member)}
                              </span>
                              <div className="crew-row-actions">
                                <button
                                  aria-label={`Edit ${getCrewDisplayName(member)}`}
                                  className="icon-button"
                                  onClick={() => startEditingCrewMember(member)}
                                  type="button"
                                >
                                  <Edit3 aria-hidden="true" size={16} />
                                </button>
                                <button
                                  aria-label={`Remove ${getCrewDisplayName(member)}`}
                                  className="icon-button"
                                  disabled={memberIsUsed}
                                  onClick={() => removeCrewMember(member.id)}
                                  title={
                                    memberIsUsed
                                      ? "This crew member is already assigned to saved pay item hours."
                                      : undefined
                                  }
                                  type="button"
                                >
                                  <Trash2 aria-hidden="true" size={16} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {currentUser.role === "admin" ? (
                  <div className="admin-crew-merge">
                    <div className="admin-crew-merge-heading">
                      <strong>Admin Crew Merge</strong>
                      <span>Use this when the same person was created twice because of spelling or nickname differences.</span>
                    </div>
                    <div className="field-group">
                      <label htmlFor="merge-source-crew-member">Duplicate Crew Member</label>
                      <select
                        id="merge-source-crew-member"
                        disabled={crewDirectory.length < 2}
                        value={mergeSourceCrewMemberId}
                        onChange={(event) => setMergeSourceCrewMemberId(event.target.value)}
                      >
                        <option value="">Select duplicate</option>
                        {sortCrewMembersByName(crewDirectory).map((member) => (
                          <option key={member.id} value={member.id}>
                            {formatCrewMemberOption(member)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="merge-target-crew-member">Keep Crew Member</label>
                      <select
                        id="merge-target-crew-member"
                        disabled={crewDirectory.length < 2}
                        value={mergeTargetCrewMemberId}
                        onChange={(event) => setMergeTargetCrewMemberId(event.target.value)}
                      >
                        <option value="">Select crew member to keep</option>
                        {sortCrewMembersByName(crewDirectory).map((member) => (
                          <option key={member.id} value={member.id}>
                            {formatCrewMemberOption(member)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="secondary-button"
                      disabled={
                        crewDirectory.length < 2 ||
                        !mergeSourceCrewMemberId ||
                        !mergeTargetCrewMemberId ||
                        mergeSourceCrewMemberId === mergeTargetCrewMemberId
                      }
                      onClick={mergeCrewMembers}
                      type="button"
                    >
                      Merge crew members
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {currentUser.role === "admin" ? renderAdminToolsDrawer() : null}
          </div>
        </aside>
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
                              onChange={(event) =>
                                setEditingEntry((current) => (current ? { ...current, hours: event.target.value } : current))
                              }
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
                              onChange={(event) =>
                                setEditingEntry((current) => (current ? { ...current, quantity: event.target.value } : current))
                              }
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

function DashboardView({
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
              <h2>{currentUser.role === "standard" ? "Assigned Project Calendar" : isProjectManager ? "My Project Calendar" : "Weekly Project Status"}</h2>
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
    </section>
  );
}

function MobileInstallPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mobile-install-prompt">
      <Smartphone aria-hidden="true" size={18} />
      <div>
        <strong>Install Chinchor Daily</strong>
        <span>On iPhone/iPad: tap Share, then Add to Home Screen for faster field access.</span>
      </div>
      <button className="icon-button" aria-label="Dismiss install prompt" onClick={onDismiss} type="button">
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

function NetworkStatusBanner({ status }: { status: NetworkStatus }) {
  const notice = getNetworkNotice(status);

  if (!notice) {
    return null;
  }

  const NoticeIcon = notice.icon;

  return (
    <div className={`network-status-banner ${notice.tone}`}>
      <NoticeIcon aria-hidden="true" size={18} />
      <div>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
    </div>
  );
}

function SubmittedDayReview({
  crewSummaryRows,
  dailyReport,
  entries,
  procoreStatus,
  showPayItemEntries,
  totalHours
}: {
  crewSummaryRows: CrewSummaryRow[];
  dailyReport: DailyReport | undefined;
  entries: AllocationEntry[];
  procoreStatus: DailyReportProcoreStatus;
  showPayItemEntries: boolean;
  totalHours: number;
}) {
  return (
    <div className="submitted-day-review">
      <div className="submitted-day-summary">
        <div>
          <span>{showPayItemEntries ? "Pay Item Rows" : "Entry Status"}</span>
          <strong>{showPayItemEntries ? entries.length : "N/A"}</strong>
        </div>
        <div>
          <span>Total Hours</span>
          <strong>{totalHours.toFixed(2)}</strong>
        </div>
        <div>
          <span>Daily Report</span>
          <strong>{dailyReport ? "Saved" : "Not created"}</strong>
        </div>
        <div>
          <span>Procore Upload</span>
          <DailyReportProcoreStatusValue status={procoreStatus} />
        </div>
      </div>

      <div className="submitted-review-grid">
        <section className="submitted-review-section">
          <h3>Crew Hours</h3>
          {crewSummaryRows.length === 0 ? (
            <div className="field-note">No crew hours are tied to saved pay item entries for this day.</div>
          ) : (
            <div className="submitted-crew-list">
              {crewSummaryRows.map((row) => (
                <div className="submitted-crew-row" key={row.crewMemberId}>
                  <span>
                    <strong>{getCrewDisplayName(row)}</strong>
                    {formatCrewMemberMeta(row)}
                  </span>
                  <strong>{row.hours.toFixed(2)} hrs</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showPayItemEntries ? (
        entries.length > 0 ? (
          <SubmittedDayEntryTable entries={entries} />
        ) : (
          <div className="empty-state">No pay item entries for this job and date.</div>
        )
      ) : (
        <div className="field-note">This job uses daily reports and photos only, so pay item entry status is not applicable.</div>
      )}
    </div>
  );
}

function SubmittedDayEntryTable({ entries }: { entries: AllocationEntry[] }) {
  return (
    <div className="submitted-entry-table" role="table" aria-label="Submitted pay item entries">
      <div className="submitted-entry-row submitted-entry-header" role="row">
        <span>Code</span>
        <span>Pay Item</span>
        <span>Hours</span>
        <span>Quantity</span>
        <span>Crew</span>
      </div>
      {entries.map((entry) => (
        <div className="submitted-entry-row" key={entry.id} role="row">
          <span data-label="Code">
            <strong>{entry.payItemCode}</strong>
          </span>
          <span data-label="Pay Item">{entry.payItemName}</span>
          <span data-label="Hours">{entry.hours.toFixed(2)}</span>
          <span data-label="Quantity">{entry.quantityCompleted.toFixed(2)}</span>
          <SubmittedEntryCrewCell entry={entry} />
        </div>
      ))}
    </div>
  );
}

function SubmittedEntryCrewCell({ entry }: { entry: AllocationEntry }) {
  if (!entry.crewAllocations?.length) {
    return (
      <div className="submitted-entry-crew" data-label="Crew">
        <span>Unassigned</span>
      </div>
    );
  }

  return (
    <div className="submitted-entry-crew" data-label="Crew">
      {entry.crewAllocations.map((allocation, index) => (
        <span key={`${allocation.crewMemberId}-${index}`}>
          {getCrewDisplayName(allocation)} {allocation.hours.toFixed(2)}h
        </span>
      ))}
    </div>
  );
}

function WeeklyStatusReport({
  canExportWeeklyDailyReports,
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entries,
  myJobIds,
  onOpenDay,
  projects,
  selectedProjectIds,
  setSelectedProjectIds,
  setUseMyJobs,
  setWeekStart,
  useMyJobs,
  weekStart
}: {
  canExportWeeklyDailyReports: boolean;
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  myJobIds: string[];
  onOpenDay: (projectId: string, date: string) => void;
  projects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (projectIds: string[]) => void;
  setUseMyJobs: (useMyJobs: boolean) => void;
  setWeekStart: (weekStart: string) => void;
  useMyJobs: boolean;
  weekStart: string;
}) {
  const [calendarStatusMode, setCalendarStatusMode] = useState<CalendarStatusMode>("entry_status");
  const [exportingWeeklyDailyReportsPdf, setExportingWeeklyDailyReportsPdf] = useState(false);
  const [weeklyDailyReportsNotice, setWeeklyDailyReportsNotice] = useState<{ message: string; status: "error" | "success" } | null>(null);
  const sortedProjects = sortProjectsByName(projects);
  const weekDates = getWeekDates(weekStart);
  const activeProjectIds = useMyJobs ? myJobIds : selectedProjectIds;
  const activeProjectIdSet = new Set(activeProjectIds);
  const visibleProjects = sortedProjects.filter((project) => activeProjectIdSet.has(project.id));
  const entryDayKeys = useMemo(() => buildEntryDayKeySet(entries), [entries]);
  const savedDailyReportCount = visibleProjects.reduce(
    (total, project) => total + weekDates.filter((date) => dailyReportsByKey[getDayKey(project.id, date)]).length,
    0
  );
  const selectedLabel = useMyJobs
    ? `My Projects (${myJobIds.length})`
    : selectedProjectIds.length === 0
      ? "Select jobs"
      : `${selectedProjectIds.length} selected`;

  function toggleProject(projectId: string, checked: boolean) {
    const nextSelectedProjectIds = new Set(selectedProjectIds);

    if (checked) {
      nextSelectedProjectIds.add(projectId);
    } else {
      nextSelectedProjectIds.delete(projectId);
    }

    setSelectedProjectIds(
      sortedProjects.filter((project) => nextSelectedProjectIds.has(project.id)).map((project) => project.id)
    );
  }

  async function downloadWeeklyDailyReportsPdf() {
    if (visibleProjects.length === 0) {
      setWeeklyDailyReportsNotice({
        message: "Select one or more projects before exporting weekly daily reports.",
        status: "error"
      });
      return;
    }

    if (savedDailyReportCount === 0) {
      setWeeklyDailyReportsNotice({
        message: "No saved daily reports are available for this week.",
        status: "error"
      });
      return;
    }

    setExportingWeeklyDailyReportsPdf(true);
    setWeeklyDailyReportsNotice(null);

    try {
      const response = await fetch("/api/daily-reports/weekly-pdf", {
        body: JSON.stringify({
          projectIds: visibleProjects.map((project) => project.id),
          weekStart
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export weekly daily reports."));
      }

      const blob = await response.blob();
      const fileName = readDownloadFileName(response.headers) ?? `weekly-daily-reports-${weekStart}.pdf`;

      downloadBlob(blob, fileName);
      setWeeklyDailyReportsNotice({
        message: `Downloaded ${fileName}.`,
        status: "success"
      });
    } catch (error) {
      setWeeklyDailyReportsNotice({
        message: error instanceof Error ? error.message : "Unable to export weekly daily reports.",
        status: "error"
      });
    } finally {
      setExportingWeeklyDailyReportsPdf(false);
    }
  }

  return (
    <div className="weekly-status-report">
      <div className="weekly-status-controls">
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
        <details className="job-multi-select">
          <summary>
            <span>{selectedLabel}</span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className="job-multi-select-panel">
            <label className="job-checkbox-row emphasized">
              <input
                checked={useMyJobs}
                disabled={myJobIds.length === 0 && !useMyJobs}
                onChange={(event) => setUseMyJobs(event.target.checked)}
                type="checkbox"
              />
              <span>My Projects{myJobIds.length === 0 ? " (none tagged)" : ""}</span>
            </label>
            <div className="job-multi-actions">
              <button
                className="secondary-button"
                disabled={useMyJobs || selectedProjectIds.length === sortedProjects.length}
                onClick={() => setSelectedProjectIds(sortedProjects.map((project) => project.id))}
                type="button"
              >
                Select all
              </button>
              <button
                className="secondary-button"
                disabled={useMyJobs || selectedProjectIds.length === 0}
                onClick={() => setSelectedProjectIds([])}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="job-checkbox-list">
              {sortedProjects.map((project) => (
                <label className="job-checkbox-row" key={project.id}>
                  <input
                    checked={!useMyJobs && selectedProjectIds.includes(project.id)}
                    disabled={useMyJobs}
                    onChange={(event) => toggleProject(project.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
        <div className="calendar-status-toggle" aria-label="Calendar status type">
          <button
            className={calendarStatusMode === "entry_status" ? "active" : ""}
            onClick={() => setCalendarStatusMode("entry_status")}
            type="button"
          >
            Entry Status
          </button>
          <button
            className={calendarStatusMode === "daily_reports" ? "active" : ""}
            onClick={() => setCalendarStatusMode("daily_reports")}
            type="button"
          >
            Daily Reports
          </button>
        </div>
        {canExportWeeklyDailyReports ? (
          <div className="weekly-export-actions">
            <button
              className="primary-button"
              disabled={exportingWeeklyDailyReportsPdf || visibleProjects.length === 0 || savedDailyReportCount === 0}
              onClick={downloadWeeklyDailyReportsPdf}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              {exportingWeeklyDailyReportsPdf
                ? "Exporting..."
                : savedDailyReportCount > 0
                  ? `Export Week PDF (${savedDailyReportCount})`
                  : "Export Week PDF"}
            </button>
          </div>
        ) : null}
      </div>
      {weeklyDailyReportsNotice ? (
        <div className={weeklyDailyReportsNotice.status === "error" ? "inline-alert" : "success-alert"}>
          {weeklyDailyReportsNotice.message}
        </div>
      ) : null}
      {visibleProjects.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No calendar projects selected">
          Select one or more projects, or tag My Projects, to view weekly status.
        </EmptyState>
      ) : (
        <div className="weekly-calendar">
          <div className="weekly-calendar-row weekly-calendar-header">
            <span>Job</span>
            {weekDates.map((date) => (
              <span key={date}>{formatWeekDayLabel(date)}</span>
            ))}
          </div>
          {visibleProjects.map((project) => (
            <div className="weekly-calendar-row" key={project.id}>
              <span className="weekly-calendar-job">{project.name}</span>
              {weekDates.map((date) => {
                const dayKey = getDayKey(project.id, date);
                const hasDailyEntryActivity = getHasDailyEntryActivity(project, dayKey, daySubmissions, entryDayKeys);
                const status =
                  calendarStatusMode === "daily_reports"
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

function ChangePasswordModal({
  form,
  notice,
  onClose,
  onSubmit,
  onUpdateForm,
  saving
}: {
  form: ChangePasswordFormState;
  notice: { message: string; status: "success" | "error" } | null;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateForm: (field: keyof ChangePasswordFormState, value: string) => void;
  saving: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <form
        className="modal-panel password-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="modal-heading">
          <div>
            <h2>Change Password</h2>
            <span>Update the password for your signed-in account.</span>
          </div>
          <button aria-label="Close change password" className="icon-button" disabled={saving} onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="change-password-form">
          <div className="field-group">
            <label htmlFor="current-password">Current Password</label>
            <input
              autoComplete="current-password"
              disabled={saving}
              id="current-password"
              onChange={(event) => onUpdateForm("currentPassword", event.target.value)}
              type="password"
              value={form.currentPassword}
            />
          </div>
          <div className="field-group">
            <label htmlFor="new-password">New Password</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="new-password"
              minLength={8}
              onChange={(event) => onUpdateForm("newPassword", event.target.value)}
              type="password"
              value={form.newPassword}
            />
          </div>
          <div className="field-group">
            <label htmlFor="confirm-new-password">Confirm New Password</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="confirm-new-password"
              minLength={8}
              onChange={(event) => onUpdateForm("confirmPassword", event.target.value)}
              type="password"
              value={form.confirmPassword}
            />
          </div>
          {notice ? <div className={notice.status === "success" ? "success-alert" : "inline-alert"}>{notice.message}</div> : null}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" disabled={saving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            <KeyRound aria-hidden="true" size={18} />
            {saving ? "Saving..." : "Save Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function filterDailyReportsByProjectIds(dailyReportsByKey: DailyReportsByKey, projectIds: Set<string>) {
  return Object.fromEntries(
    Object.entries(dailyReportsByKey).filter(([dayKey]) => {
      const parsedDayKey = parseDayKey(dayKey);

      return parsedDayKey ? projectIds.has(parsedDayKey.projectId) : false;
    })
  );
}

function getNetworkNotice(status: NetworkStatus): NetworkNotice | null {
  if (!status.checked) {
    return null;
  }

  if (!status.online) {
    return {
      icon: WifiOff,
      message: "Reconnect before saving, syncing, or uploading. Unsaved form input should stay on screen until you leave the page.",
      title: "Offline",
      tone: "offline"
    };
  }

  const effectiveType = status.effectiveType?.toLowerCase() ?? "";
  const weakEffectiveType = effectiveType === "slow-2g" || effectiveType === "2g";
  const weakDownlink = typeof status.downlink === "number" && status.downlink > 0 && status.downlink < 0.75;

  if (status.saveData || weakEffectiveType || weakDownlink) {
    return {
      icon: AlertTriangle,
      message: "Connection looks weak. Large Procore uploads may take longer; keep this page open until confirmation appears.",
      title: "Weak signal",
      tone: "weak"
    };
  }

  return null;
}

function buildSyncStatus(prefix: string, summary: ProcoreSyncSummary | undefined) {
  if (!summary) {
    return `${prefix} complete`;
  }

  const dailyReportOnlyText =
    summary.dailyReportOnlyProjects !== undefined ? `, ${summary.dailyReportOnlyProjects} Electrical` : "";
  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const queuedText = remainingNewProjects > 0 ? `, ${remainingNewProjects} queued` : "";
  const autoArchivedProjects = summary.autoArchivedProjects ?? 0;
  const autoUnarchivedProjects = summary.autoUnarchivedProjects ?? 0;
  const archivedText = autoArchivedProjects > 0 ? `, ${autoArchivedProjects} archived inactive` : "";
  const unarchivedText = autoUnarchivedProjects > 0 ? `, ${autoUnarchivedProjects} unarchived active` : "";

  return `${prefix}: ${summary.synced} synced, ${summary.failed} failed${dailyReportOnlyText}${queuedText}${archivedText}${unarchivedText}`;
}

function hasSyncWarnings(summary: ProcoreSyncSummary | undefined) {
  return Boolean(
    summary &&
      (summary.failed > 0 || (summary.remainingNewProjects ?? 0) > 0 || (summary.autoArchivedProjects ?? 0) > 0)
  );
}
