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
  TWO_SERIES_PRODUCTION_CODES,
  getDailyReportTemplateForProject,
  isTwoSeriesProject,
  type DailyReportTemplate
} from "@/lib/daily-report-templates";
import { buildPayItemReport } from "@/lib/report-builders";
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
  DAILY_REPORT_ITSFM_ITEMS,
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
  PmComplianceRanking,
  type DashboardIssue,
  type DashboardProjectNavigationRow,
  type DashboardProjectWeekRow,
  type ExecutiveReviewItem,
  type FieldAssignmentVisibilityRow,
  type PmComplianceRow,
  type ProductionPerformanceAlert
} from "@/features/time-allocation/components/dashboard/dashboard-components";
import { AdminToolsDrawer } from "@/features/time-allocation/components/admin/admin-tools";
import type { AllocationEntry, CrewLaborType, PayItem, Project } from "@/lib/procore/types";

const PROCORE_WEB_BASE_URL = process.env.NEXT_PUBLIC_PROCORE_WEB_BASE_URL ?? "https://us02.procore.com";
const PROCORE_COMPANY_ID = process.env.NEXT_PUBLIC_PROCORE_COMPANY_ID ?? "598134325538800";
const JOB_IMAGE_DAILY_UPLOAD_LIMIT = 50;
const MAX_JOB_IMAGE_UPLOAD_BATCH_BYTES = 3.5 * 1024 * 1024;
const MAX_JOB_IMAGE_UPLOAD_BATCH_ITEMS = 4;
const MAX_JOB_IMAGE_QUEUE_ITEMS = 20;
const JOB_IMAGE_CLIENT_BATCH_DELAY_MS = 1_000;
const JOB_IMAGE_MAX_DIMENSION = 1800;
const JOB_IMAGE_JPEG_QUALITY = 0.82;
const DAILY_REPORT_VALIDATION_NOTICE_PREFIX = "Daily report needs attention";
const DEFAULT_CREW_LABOR_TYPE: CrewLaborType = "chinchor_employee";

type ProjectsResponse = {
  projectArchiveById?: ProjectArchiveById;
  projects: Project[];
  syncedAt?: string | null;
  summary?: ProcoreSyncSummary;
  error?: string;
};

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

type ProcoreSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skippedExisting: number;
  failedProjects: string[];
  autoArchivedProjects?: number;
  autoUnarchivedProjects?: number;
  dailyReportOnlyProjects?: number;
  eligibleProjects?: number;
  inactiveNetSuiteProjects?: number;
  payItemProjects?: number;
  remainingNewProjects?: number;
  skippedMissingProcoreProjectId?: number;
  skippedNoPayItems?: number;
  totalNetSuiteProjects?: number;
};

type SyncLogEntry = {
  id: string;
  action: string;
  status: "success" | "warning" | "error";
  createdAt: string;
  message: string;
  summary?: ProcoreSyncSummary;
};

type SharedAppState = {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  myJobsByUser: MyJobsByUser;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  syncLog: SyncLogEntry[];
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

type NetSuiteVendor = {
  id: string;
  name: string;
  entityId?: string;
  companyName?: string;
  defaultAddress: string;
};

type ManagedAppUser = AuthUser & {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type AdminUsersResponse = {
  databaseConfigured?: boolean;
  error?: string;
  users?: ManagedAppUser[];
};

type AdminUserFormState = {
  active: boolean;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId: string;
  netSuiteProjectManagerName: string;
  password: string;
  role: AuthUser["role"];
  userId: string;
};

type NetSuiteProjectManagerOption = {
  id: string;
  name: string;
};

type ChangePasswordFormState = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
};

type PayItemDraft = {
  hours: string;
  quantity: string;
  crewMemberIds: string[];
  crewHours: Record<string, string>;
};

type DraftsByPayItem = Record<string, PayItemDraft>;

type CrewMember = {
  id: string;
  name: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  netSuiteVendorEntityId?: string;
  netSuiteVendorId?: string;
};

type CrewMembersByProject = Record<string, CrewMember[]>;

type CrewSummaryRow = {
  crewMemberId: string;
  name: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  hours: number;
};

type AuthResponse = {
  user: AuthUser | null;
  error?: string;
};

type ChangePasswordResponse = {
  error?: string;
  ok?: boolean;
};

type PasswordResetFormState = {
  confirmPassword: string;
  newPassword: string;
  token: string;
  userId: string;
};

type PasswordResetResponse = {
  error?: string;
  expiresAt?: string;
  ok?: boolean;
  token?: string;
  userId?: string;
};

type ProcoreStatusResponse = {
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
};

type DaySubmission = {
  status: "draft" | "submitted";
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAt?: string;
};

type DaySubmissionsByKey = Record<string, DaySubmission>;

type DayEntryNotes = {
  notes: string;
  inventory: string;
};

type DayEntryNotesByKey = Record<string, DayEntryNotes>;

type DailyReportAnswers = {
  employeeRows: DailyReportEmployeeRow[];
  payItemRows: DailyReportPayItemRow[];
  quantitiesTurnedIn: string;
  inspectorName: string;
  inspectorQuantityDetails: string;
  workDescription: string;
  planSheetNumbers: string;
  workDetails: string;
  incidentOccurred: string;
  incidentDetails: string;
  accidentReportFiled: string;
  motSigns: string;
  conesBarrels: string;
  typeIISidewalkBarricades: string;
  typeIIIBarricades: string;
  lcdCount: string;
  lcdFootage: string;
  arrowBoards: string;
  vmsBoards: string;
  fdotIndex: string;
  itsfmRows: DailyReportItsfmRow[];
  itsfmAbovegroundEquipment: string;
  itsfmCabinetEquipment: string;
  twoSeriesEquipmentTools: string;
  twoSeriesSafetyIssues: string;
  twoSeriesDelayReasons: string;
  twoSeriesDeliveries: string;
};

type DailyReportEmployeeRow = {
  employeeClassification: string;
  truckNumber: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  productionCode1: string;
  productionHours1: string;
  productionCode2: string;
  productionHours2: string;
  totalHours: string;
  driver: boolean;
  passenger: boolean;
};

type DailyReportTimeField = "timeIn" | "lunchOut" | "lunchIn" | "timeOut";

type DailyReportPayItemRow = {
  notes: string;
  payItemId: string;
  quantity: string;
};

type DailyReportValidationResult = {
  errors: string[];
  warnings: string[];
};

type DailyReportValidationOptions = {
  template: DailyReportTemplate;
};

type DailyReportItsfmRow = {
  itemKey: string;
  modelNumber: string;
  serialNumber: string;
  location: string;
};

type DailyReport = DailyReportAnswers & {
  projectId: string;
  date: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

type DailyReportsByKey = Record<string, DailyReport>;

type DailyReportUploadStatus = "failed" | "uploaded";

type DailyReportUpload = {
  attemptedAt?: string;
  companyId?: string;
  error?: string;
  fileName: string;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  procoreFileId?: string;
  status?: DailyReportUploadStatus;
  uploadedAt?: string;
};

type DailyReportUploadsByKey = Record<string, DailyReportUpload>;

type DailyReportProcoreStatus = {
  className: string;
  href?: string;
  label: string;
  message: string;
};

type JobImageUploadStatus = "failed" | "uploaded";

type JobImageUpload = {
  attemptedAt?: string;
  caption?: string;
  clientId?: string;
  contentType?: string;
  date: string;
  error?: string;
  fileName: string;
  fileSizeBytes?: number;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  id: string;
  originalFileName?: string;
  procoreFileId?: string;
  projectId: string;
  status: JobImageUploadStatus;
  uploadedAt?: string;
  uploadedByName?: string;
  uploadedByUserId?: string;
};

type JobImageUploadsByDay = Record<string, JobImageUpload[]>;

type JobImageQueueItem = {
  caption: string;
  error?: string;
  file: File;
  id: string;
  originalName: string;
  previewUrl: string;
  size: number;
  status: "failed" | "queued" | "uploaded" | "uploading";
  uploadedFileName?: string;
};

type MyJobsByUser = Record<string, string[]>;

type ProjectBlacklistById = Record<string, true>;
type ProjectArchiveById = Record<string, true>;
type VendorBlacklistById = Record<string, true>;

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

type ViewMode = "dashboard" | "entry" | "calendar" | "reports";

type CalendarStatusMode = "entry_status" | "daily_reports";

type PendingProcoreReturn = {
  date?: string;
  intent?: "connect" | "upload_daily";
  mobilePayItemId?: string;
  projectId?: string;
  viewMode?: ViewMode;
};

type DailyReportAutosaveDraft = {
  date: string;
  draft: DailyReportAnswers;
  projectId: string;
  updatedAt: string;
  userId: string;
};

const PENDING_PROCORE_RETURN_KEY = "pending-procore-return";
const DAILY_REPORT_DRAFT_STORAGE_PREFIX = "daily-report-draft";
const MOBILE_INSTALL_PROMPT_DISMISSED_KEY = "mobile-install-prompt-dismissed";

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
          window.localStorage.removeItem(PENDING_PROCORE_RETURN_KEY);
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

    const dismissed = window.localStorage.getItem(MOBILE_INSTALL_PROMPT_DISMISSED_KEY) === "true";
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

    window.localStorage.setItem(
      PENDING_PROCORE_RETURN_KEY,
      JSON.stringify({
        date: workDate,
        intent,
        mobilePayItemId: mobileSelectedPayItemId,
        projectId: selectedProject?.id ?? selectedProjectId,
        viewMode
      } satisfies PendingProcoreReturn)
    );
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
            window.localStorage.setItem(MOBILE_INSTALL_PROMPT_DISMISSED_KEY, "true");
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

function buildDashboardProjectRows({
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entryDayKeys,
  projects,
  weekDates
}: {
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
  entryDayKeys: Set<string>;
  projects: Project[];
  weekDates: string[];
}): DashboardProjectWeekRow[] {
  const today = todayInputValue();

  return projects.map((project) => {
    let dailyFailedCount = 0;
    let dailyPendingCount = 0;
    let dailySavedCount = 0;
    let draftEntryCount = 0;
    let missingPastDailyReportCount = 0;
    let openDate = "";
    let submittedEntryCount = 0;
    const issues: DashboardIssue[] = [];

    for (const date of weekDates) {
      const dayKey = getDayKey(project.id, date);
      const entryStatus = getProjectEntryCalendarStatus(project, daySubmissions[dayKey], entryDayKeys.has(dayKey));
      const dailyStatus = getDailyReportCalendarStatus(
        dailyReportsByKey[dayKey],
        dailyReportUploadsByKey[dayKey],
        getHasDailyEntryActivity(project, dayKey, daySubmissions, entryDayKeys)
      );

      if (entryStatus.className === "submitted") {
        submittedEntryCount += 1;
      }

      if (entryStatus.className === "draft") {
        draftEntryCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Entry activity has been saved but the day has not been submitted.",
          id: `${project.id}-${date}-entry-draft`,
          label: "Draft entry",
          tone: "warning"
        });
      }

      if (dailyStatus.className !== "missing" && dailyStatus.className !== "not-started") {
        dailySavedCount += 1;
      }

      if (dailyStatus.className === "failed") {
        dailyFailedCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Daily report upload failed and needs retry or review.",
          id: `${project.id}-${date}-daily-upload-failed`,
          label: "Failed upload",
          tone: "error"
        });
      }

      if (dailyStatus.className === "created") {
        dailyPendingCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Daily report has been saved but has not been uploaded to Procore.",
          id: `${project.id}-${date}-daily-upload-pending`,
          label: "Pending upload",
          tone: "warning"
        });
      }

      if (dailyStatus.className === "missing" && date <= today) {
        missingPastDailyReportCount += 1;
        openDate ||= date;
        issues.push({
          date,
          detail: "Entry activity exists, but no daily report has been saved.",
          id: `${project.id}-${date}-daily-missing`,
          label: "Missing daily",
          tone: "error"
        });
      }
    }

    return {
      attentionScore: dailyFailedCount * 5 + dailyPendingCount * 3 + draftEntryCount * 2 + missingPastDailyReportCount,
      dailyFailedCount,
      dailyPendingCount,
      dailySavedCount,
      draftEntryCount,
      issues,
      missingPastDailyReportCount,
      openDate,
      project,
      submittedEntryCount
    };
  });
}

function buildDashboardMetrics(rows: DashboardProjectWeekRow[]) {
  return rows.reduce(
    (totals, row) => ({
      draftEntryDays: totals.draftEntryDays + row.draftEntryCount,
      procoreAttentionCount: totals.procoreAttentionCount + row.dailyFailedCount + row.dailyPendingCount,
      savedDailyReports: totals.savedDailyReports + row.dailySavedCount,
      submittedEntryDays: totals.submittedEntryDays + row.submittedEntryCount
    }),
    {
      draftEntryDays: 0,
      procoreAttentionCount: 0,
      savedDailyReports: 0,
      submittedEntryDays: 0
    }
  );
}

function buildExecutiveReviewItems(
  attentionRows: DashboardProjectWeekRow[],
  productionAlerts: ProductionPerformanceAlert[]
): ExecutiveReviewItem[] {
  const statusItems = attentionRows.flatMap((row) =>
    row.issues.map((issue) => ({
      detail: issue.detail,
      id: `status-${issue.id}`,
      meta: formatDate(issue.date),
      openDate: issue.date,
      projectId: row.project.id,
      projectName: row.project.name,
      title: issue.label,
      tone: issue.tone,
      type: "Status" as const
    }))
  );
  const productionItems = productionAlerts.map((alert) => ({
    detail: alert.payItemLabel,
    id: `production-${alert.id}`,
    meta: alert.detail,
    openDate: alert.openDate,
    projectId: alert.projectId,
    projectName: alert.projectName,
    title: alert.message,
    tone: alert.tone,
    type: "Production" as const
  }));

  return [...productionItems, ...statusItems].sort((left, right) => {
    const toneOrder = getExecutiveReviewToneRank(right.tone) - getExecutiveReviewToneRank(left.tone);

    return toneOrder || left.projectName.localeCompare(right.projectName) || left.title.localeCompare(right.title);
  });
}

function getExecutiveReviewToneRank(tone: ExecutiveReviewItem["tone"]) {
  if (tone === "error") {
    return 2;
  }

  if (tone === "warning") {
    return 1;
  }

  return 0;
}

function buildDashboardProjectNavigationRows(
  projectRows: DashboardProjectWeekRow[],
  assignmentRows: FieldAssignmentVisibilityRow[]
): DashboardProjectNavigationRow[] {
  const assignmentsByProjectId = new Map(assignmentRows.map((row) => [row.project.id, row]));
  const today = todayInputValue();

  return projectRows
    .map((row) => {
      const assignment = assignmentsByProjectId.get(row.project.id);
      const assignedFieldNames = assignment?.assignedUsers.map(formatUserName).sort((a, b) => a.localeCompare(b)) ?? [];

      return {
        assignedFieldCount: assignedFieldNames.length,
        assignedFieldNames,
        issueCount: row.issues.length,
        openDate: row.openDate || today,
        project: row.project
      };
    })
    .sort((left, right) => right.issueCount - left.issueCount || left.project.name.localeCompare(right.project.name));
}

function filterDashboardProjectNavigationRows(rows: DashboardProjectNavigationRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => {
    const searchableText = [
      row.project.name,
      getProjectWorkTypeLabel(row.project),
      row.project.netSuiteProjectManagerName ?? "",
      ...row.assignedFieldNames
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

function buildFieldAssignmentVisibilityRows(
  projects: Project[],
  fieldUsers: AuthUser[],
  myJobsByUser: MyJobsByUser
): FieldAssignmentVisibilityRow[] {
  return projects
    .map((project) => {
      const assignedUserIds = new Set(getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, project.id));

      return {
        assignedUsers: fieldUsers
          .filter((user) => assignedUserIds.has(user.id))
          .sort((left, right) => formatUserName(left).localeCompare(formatUserName(right))),
        project
      };
    })
    .sort(
      (left, right) =>
        Number(left.assignedUsers.length > 0) - Number(right.assignedUsers.length > 0) ||
        left.project.name.localeCompare(right.project.name)
    );
}

function buildPmComplianceRows(projectRows: DashboardProjectWeekRow[]): PmComplianceRow[] {
  const rowsByPm = new Map<string, PmComplianceRow>();

  for (const row of projectRows) {
    const pmId = row.project.netSuiteProjectManagerId || "unassigned";
    const pmName = row.project.netSuiteProjectManagerName || "Unassigned PM";
    const current = rowsByPm.get(pmId) ?? {
      id: pmId,
      issueCount: 0,
      issueProjectCount: 0,
      name: pmName,
      projectCount: 0,
      projects: [],
      score: 0
    };
    const projectIssueCount = row.issues.length;

    current.projectCount += 1;
    current.issueCount += projectIssueCount;
    current.score += row.attentionScore;

    if (projectIssueCount > 0) {
      current.issueProjectCount += 1;
      current.projects.push({
        openDate: row.openDate,
        projectId: row.project.id,
        projectName: row.project.name,
        summary: formatDashboardAttentionSummary(row)
      });
    }

    rowsByPm.set(pmId, current);
  }

  return Array.from(rowsByPm.values())
    .filter((row) => row.issueCount > 0)
    .map((row) => ({
      ...row,
      projects: row.projects.sort((left, right) => left.projectName.localeCompare(right.projectName))
    }))
    .sort((left, right) => right.score - left.score || right.issueCount - left.issueCount || left.name.localeCompare(right.name));
}

function buildProductionPerformanceAlerts({
  endDate,
  entries,
  projects,
  startDate
}: {
  endDate: string;
  entries: AllocationEntry[];
  projects: Project[];
  startDate: string;
}): ProductionPerformanceAlert[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const filteredEntries = entries.filter(
    (entry) =>
      entry.date >= startDate &&
      entry.date <= endDate &&
      entry.hours > 0 &&
      entry.quantityCompleted > 0 &&
      projectsById.has(entry.projectId)
  );
  const alerts: ProductionPerformanceAlert[] = [];
  const reportRows = buildPayItemReport(filteredEntries, projects, {
    excludeOutliers: true,
    metric: "median"
  });

  for (const payItemRow of reportRows) {
    if (payItemRow.hoursPerUnit <= 0 || payItemRow.sampleSize < 3) {
      continue;
    }

    for (const jobRow of payItemRow.jobRollupRows ?? []) {
      const project = projectsById.get(jobRow.id);

      if (!project || jobRow.hoursPerUnit <= 0 || jobRow.sampleSize < 2) {
        continue;
      }

      const variance = (jobRow.hoursPerUnit - payItemRow.hoursPerUnit) / payItemRow.hoursPerUnit;

      if (variance < 0.25) {
        continue;
      }

      alerts.push({
        detail: `${formatHoursPerUnit(jobRow.hoursPerUnit)} vs company ${formatHoursPerUnit(payItemRow.hoursPerUnit)} across ${jobRow.sampleSize} row${jobRow.sampleSize === 1 ? "" : "s"}.`,
        id: `performance-${jobRow.id}-${payItemRow.key}`,
        message: `${formatVariance(variance)} than company median`,
        openDate: endDate,
        payItemLabel: `${payItemRow.code} - ${payItemRow.name}`,
        projectId: project.id,
        projectName: project.name,
        tone: "warning"
      });
    }
  }

  const completedQuantityByProjectPayItemKey = new Map<string, number>();

  for (const entry of entries) {
    const projectPayItemKey = `${entry.projectId}|${entry.payItemId}`;

    completedQuantityByProjectPayItemKey.set(
      projectPayItemKey,
      (completedQuantityByProjectPayItemKey.get(projectPayItemKey) ?? 0) + entry.quantityCompleted
    );
  }

  for (const project of projects.filter((candidate) => !isTwoSeriesProject(candidate))) {
    for (const payItem of project.payItems) {
      const completedQuantity = completedQuantityByProjectPayItemKey.get(`${project.id}|${payItem.id}`) ?? 0;

      if (payItem.budgetedQuantity <= 0 || completedQuantity <= payItem.budgetedQuantity) {
        continue;
      }

      alerts.push({
        detail: `${formatPayItemQuantity(completedQuantity)} completed vs ${formatPayItemQuantity(payItem.budgetedQuantity)} budgeted.`,
        id: `quantity-overrun-${project.id}-${payItem.id}`,
        message: "Quantity over budget",
        openDate: endDate,
        payItemLabel: `${payItem.code} - ${payItem.name}`,
        projectId: project.id,
        projectName: project.name,
        tone: "error"
      });
    }
  }

  return alerts
    .sort((left, right) => {
      const toneOrder = Number(right.tone === "error") - Number(left.tone === "error");

      return toneOrder || left.projectName.localeCompare(right.projectName) || left.payItemLabel.localeCompare(right.payItemLabel);
    })
    .slice(0, 10);
}

function formatHoursPerUnit(value: number) {
  return `${value.toFixed(3)} hrs/unit`;
}

function formatVariance(variance: number) {
  const percent = Math.abs(variance * 100);

  if (percent < 0.5) {
    return "At average";
  }

  return `${percent.toFixed(1)}% ${variance < 0 ? "better" : "worse"}`;
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

function getProjectEntryCalendarStatus(project: Project, daySubmission: DaySubmission | undefined, hasSavedEntries: boolean) {
  if (isTwoSeriesProject(project)) {
    return getNotApplicableCalendarStatus();
  }

  return getEntryCalendarStatus(daySubmission, hasSavedEntries);
}

function getProjectWorkTypeLabel(project: Project | null | undefined) {
  if (!project) {
    return "No job type";
  }

  return isTwoSeriesProject(project) ? "Electrical" : "Signal";
}

function buildEntryDayKeySet(entries: AllocationEntry[]) {
  return new Set(entries.map((entry) => getDayKey(entry.projectId, entry.date)));
}

function getNotApplicableCalendarStatus() {
  return {
    className: "not-applicable",
    label: "N/A"
  };
}

function getHasDailyEntryActivity(
  project: Project,
  dayKey: string,
  daySubmissions: DaySubmissionsByKey,
  entryDayKeys: Set<string>
) {
  if (isTwoSeriesProject(project)) {
    return false;
  }

  return entryDayKeys.has(dayKey) || Boolean(daySubmissions[dayKey]);
}

function getDailyReportCalendarStatus(
  dailyReport: DailyReport | undefined,
  upload: DailyReportUpload | undefined,
  hasDailyEntryActivity = true
) {
  if (isUploadedDailyReportUpload(upload)) {
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

function getDailyReportProcoreStatus(
  dailyReport: DailyReport | undefined,
  upload: DailyReportUpload | undefined,
  projectId: string | undefined,
  userRole: AuthUser["role"]
) {
  if (!dailyReport) {
    return {
      className: "missing",
      label: "Not Submitted",
      message: "Create and save a daily report before uploading to Procore."
    };
  }

  if (isUploadedDailyReportUpload(upload)) {
    const uploadedAt = upload?.uploadedAt ? ` on ${formatStatusDateTime(upload.uploadedAt)}` : "";
    const fileName = upload?.fileName ? ` File: ${upload.fileName}.` : "";
    const folderPath = upload?.folderPath ? ` Folder: ${upload.folderPath}.` : "";
    const folderUrl = normalizeProcoreDocumentsFolderUrl(upload?.folderUrl, upload?.companyId, projectId, upload?.folderId);

    return {
      className: "uploaded",
      href: folderUrl,
      label: "Uploaded",
      message: userRole === "admin" ? `Uploaded to Procore${uploadedAt}.${fileName}${folderPath}` : `Uploaded${uploadedAt}.`
    };
  }

  if (upload?.status === "failed") {
    const attemptedAt = upload.attemptedAt ? ` on ${new Date(upload.attemptedAt).toLocaleString()}` : "";

    return {
      className: "failed",
      label: "Upload failed",
      message: `Last Procore upload failed${attemptedAt}: ${upload.error ?? "Unknown error."}`
    };
  }

  return {
    className: "pending",
    label: "Pending",
    message: "Pending upload to Procore. Click Upload to Procore when the daily report is ready."
  };
}

function isUploadedDailyReportUpload(upload: DailyReportUpload | undefined) {
  return Boolean(upload && (upload.status === "uploaded" || (!upload.status && upload.uploadedAt)));
}

function normalizeProcoreDocumentsFolderUrl(
  folderUrl: string | undefined,
  companyId: string | undefined,
  projectId: string | undefined,
  folderId: string | undefined
) {
  if (folderUrl && !folderUrl.includes("app.procore.com")) {
    return folderUrl;
  }

  return buildProcoreDocumentsFolderUrl(companyId, projectId, folderId);
}

function buildProcoreDocumentsFolderUrl(
  companyId: string | undefined,
  projectId: string | undefined,
  folderId: string | undefined
) {
  if (!projectId) {
    return undefined;
  }

  const url = new URL(
    `/webclients/host/companies/${encodeURIComponent(companyId || PROCORE_COMPANY_ID)}/projects/${encodeURIComponent(
      projectId
    )}/tools/documents`,
    PROCORE_WEB_BASE_URL
  );

  if (folderId) {
    url.searchParams.set("folder_id", folderId);
  }

  return url.toString();
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

function sortProjectsByName(projects: unknown) {
  return normalizeProjectList(projects).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function getFieldUserIdsAssignedToProject(fieldUsers: AuthUser[], myJobsByUser: MyJobsByUser, projectId: string) {
  return fieldUsers
    .filter((fieldUser) => (myJobsByUser[fieldUser.id] ?? []).includes(projectId))
    .map((fieldUser) => fieldUser.id);
}

function normalizeProjectList(projects: unknown): Project[] {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .map(normalizeProject)
    .filter((project): project is Project => project !== null);
}

function normalizeProject(project: unknown): Project | null {
  if (!project || typeof project !== "object") {
    return null;
  }

  const projectRecord = project as Partial<Project>;
  const id = readTextValue(projectRecord.id);
  const name = readTextValue(projectRecord.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    netSuiteProjectId: readTextValue(projectRecord.netSuiteProjectId) || undefined,
    netSuiteProjectManagerId: readTextValue(projectRecord.netSuiteProjectManagerId) || undefined,
    netSuiteProjectManagerName: readTextValue(projectRecord.netSuiteProjectManagerName) || undefined,
    payItems: normalizePayItemList(projectRecord.payItems),
    procoreProjectId: readTextValue(projectRecord.procoreProjectId) || id,
    sourceSystem: projectRecord.sourceSystem === "netsuite" ? "netsuite" : "procore"
  };
}

function normalizePayItemList(payItems: unknown): PayItem[] {
  if (!Array.isArray(payItems)) {
    return [];
  }

  return payItems
    .map(normalizePayItem)
    .filter((payItem): payItem is PayItem => payItem !== null)
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" }));
}

function normalizePayItem(payItem: unknown): PayItem | null {
  if (!payItem || typeof payItem !== "object") {
    return null;
  }

  const payItemRecord = payItem as Partial<PayItem>;
  const id = readTextValue(payItemRecord.id);
  const code = readTextValue(payItemRecord.code);
  const name = readTextValue(payItemRecord.name);

  if (!id || !code || !name) {
    return null;
  }

  const budgetedQuantity = Number(payItemRecord.budgetedQuantity);

  return {
    id,
    code,
    name,
    budgetedQuantity: Number.isFinite(budgetedQuantity) ? budgetedQuantity : 0,
    unitOfMeasure: readTextValue(payItemRecord.unitOfMeasure)
  };
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

function readNumberValue(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getSyncFailedProjects(summary: Partial<ProcoreSyncSummary> | undefined) {
  return Array.isArray(summary?.failedProjects)
    ? summary.failedProjects.map(readTextValue).filter(Boolean)
    : [];
}

function normalizeSyncSummary(value: unknown): ProcoreSyncSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const summary = value as Partial<ProcoreSyncSummary>;
  const normalizedSummary: ProcoreSyncSummary = {
    attempted: readNumberValue(summary.attempted),
    failed: readNumberValue(summary.failed),
    failedProjects: getSyncFailedProjects(summary),
    skippedExisting: readNumberValue(summary.skippedExisting),
    synced: readNumberValue(summary.synced)
  };

  const optionalFields: Array<keyof Omit<ProcoreSyncSummary, "attempted" | "failed" | "failedProjects" | "skippedExisting" | "synced">> = [
    "autoArchivedProjects",
    "autoUnarchivedProjects",
    "dailyReportOnlyProjects",
    "eligibleProjects",
    "inactiveNetSuiteProjects",
    "payItemProjects",
    "remainingNewProjects",
    "skippedMissingProcoreProjectId",
    "skippedNoPayItems",
    "totalNetSuiteProjects"
  ];

  for (const field of optionalFields) {
    if (summary[field] !== undefined) {
      normalizedSummary[field] = readNumberValue(summary[field]);
    }
  }

  return normalizedSummary;
}

function normalizeSyncLogEntries(value: unknown): SyncLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeSyncLogEntry)
    .filter((entry): entry is SyncLogEntry => entry !== null);
}

function normalizeSyncLogEntry(value: unknown): SyncLogEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<SyncLogEntry>;
  const status = entry.status === "error" || entry.status === "warning" || entry.status === "success" ? entry.status : "success";

  return {
    id: readTextValue(entry.id) || crypto.randomUUID(),
    action: readTextValue(entry.action) || "Sync",
    createdAt: readTextValue(entry.createdAt) || new Date().toISOString(),
    message: readTextValue(entry.message),
    status,
    summary: normalizeSyncSummary(entry.summary)
  };
}

function filterActiveProjects(
  projects: Project[],
  projectBlacklistById: ProjectBlacklistById,
  projectArchiveById: ProjectArchiveById
) {
  return projects.filter((project) => !projectBlacklistById[project.id] && !projectArchiveById[project.id]);
}

function projectMatchesIdentifier(project: Project, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  return [project.id, project.procoreProjectId, project.netSuiteProjectId, project.name]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.trim().toLowerCase() === normalizedIdentifier);
}

function getDefaultMyJobIdsForUser(user: AuthUser, projects: Project[]) {
  if (user.role !== "project_manager" || !user.netSuiteProjectManagerId) {
    return [];
  }

  return projects
    .filter((project) => project.netSuiteProjectManagerId === user.netSuiteProjectManagerId)
    .map((project) => project.id);
}

function buildNetSuiteProjectManagerOptions(projects: Project[]): NetSuiteProjectManagerOption[] {
  const optionsById = new Map<string, NetSuiteProjectManagerOption>();

  for (const project of projects) {
    const id = project.netSuiteProjectManagerId?.trim();

    if (!id) {
      continue;
    }

    const name = project.netSuiteProjectManagerName?.trim() || `NetSuite PM ${id}`;
    const existingOption = optionsById.get(id);

    if (!existingOption || existingOption.name.startsWith("NetSuite PM ")) {
      optionsById.set(id, { id, name });
    }
  }

  return Array.from(optionsById.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function resolveNetSuiteProjectManagerOption(id: string, options: NetSuiteProjectManagerOption[]) {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  return options.find((option) => option.id === normalizedId) ?? {
    id: normalizedId,
    name: `NetSuite PM ${normalizedId}`
  };
}

function buildCrewDirectoryFromProjects(crewMembersByProject: CrewMembersByProject) {
  const crewMembersById = new Map<string, CrewMember>();

  for (const crewMembers of Object.values(crewMembersByProject)) {
    for (const crewMember of crewMembers) {
      if (!crewMembersById.has(crewMember.id)) {
        crewMembersById.set(crewMember.id, crewMember);
      }
    }
  }

  return sortCrewMembersByName(Array.from(crewMembersById.values()));
}

function mergeCrewDirectories(primaryCrewMembers: unknown, fallbackCrewMembers: unknown) {
  const crewMembersById = new Map<string, CrewMember>();

  for (const crewMember of [...normalizeCrewMemberList(fallbackCrewMembers), ...normalizeCrewMemberList(primaryCrewMembers)]) {
    crewMembersById.set(crewMember.id, crewMember);
  }

  return sortCrewMembersByName(Array.from(crewMembersById.values()));
}

function buildSharedAppState(state: SharedAppState): SharedAppState {
  return {
    crewDirectory: sortCrewMembersByName(normalizeCrewMemberList(state.crewDirectory)),
    crewMembersByProject: normalizeCrewMembersByProject(state.crewMembersByProject),
    dailyReportUploadsByKey: normalizeRecord(state.dailyReportUploadsByKey),
    dailyReportsByKey: normalizeRecord(state.dailyReportsByKey),
    dayEntryNotesByKey: normalizeRecord(state.dayEntryNotesByKey),
    daySubmissions: normalizeRecord(state.daySubmissions),
    entries: normalizeAllocationEntryList(state.entries),
    myJobsByUser: normalizeRecord(state.myJobsByUser),
    projectArchiveById: normalizeRecord(state.projectArchiveById),
    projectBlacklistById: normalizeRecord(state.projectBlacklistById),
    syncLog: normalizeSyncLogEntries(state.syncLog)
  };
}

function normalizeRecord<TRecord extends Record<string, unknown>>(value: unknown): TRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TRecord) : ({} as TRecord);
}

function normalizeCrewMembersByProject(value: unknown): CrewMembersByProject {
  const crewMembersByProject: CrewMembersByProject = {};

  for (const [projectId, crewMembers] of Object.entries(normalizeRecord<Record<string, unknown>>(value))) {
    const normalizedCrewMembers = normalizeCrewMemberList(crewMembers);

    if (projectId && normalizedCrewMembers.length > 0) {
      crewMembersByProject[projectId] = normalizedCrewMembers;
    }
  }

  return crewMembersByProject;
}

function normalizeCrewMemberList(value: unknown): CrewMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeCrewMember)
    .filter((crewMember): crewMember is CrewMember => crewMember !== null);
}

function normalizeCrewMember(value: unknown): CrewMember | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const crewMember = value as Partial<CrewMember>;
  const id = readTextValue(crewMember.id);
  const laborType = getCrewLaborType(crewMember);
  const subcontractorCompany = readTextValue(crewMember.subcontractorCompany);
  const name = laborType === "subcontractor"
    ? subcontractorCompany || readTextValue(crewMember.name)
    : readTextValue(crewMember.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    jobTitle: laborType === "subcontractor" ? "Subcontractor" : readTextValue(crewMember.jobTitle),
    laborType,
    name,
    netSuiteVendorEntityId: readTextValue(crewMember.netSuiteVendorEntityId) || undefined,
    netSuiteVendorId: readTextValue(crewMember.netSuiteVendorId) || undefined,
    subcontractorCompany: laborType === "subcontractor" ? name : subcontractorCompany || undefined
  };
}

function normalizeAllocationEntryList(value: unknown): AllocationEntry[] {
  return Array.isArray(value) ? (value.filter((entry) => entry && typeof entry === "object") as AllocationEntry[]) : [];
}

async function prepareJobImageFileForUpload(file: File) {
  const compressedFile = await compressJobImage(file);
  return compressedFile ?? file;
}

async function compressJobImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name || "Selected file"} is not an image.`);
  }

  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
    return null;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return new Promise<File | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, JOB_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          const compressedName = replaceFileExtension(file.name || "job-image", "jpg");
          resolve(
            new File([blob], compressedName, {
              lastModified: Date.now(),
              type: "image/jpeg"
            })
          );
        },
        "image/jpeg",
        JOB_IMAGE_JPEG_QUALITY
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function chunkJobImagesForUpload(images: JobImageQueueItem[]) {
  const batches: JobImageQueueItem[][] = [];
  let currentBatch: JobImageQueueItem[] = [];
  let currentBatchSize = 0;

  for (const image of images) {
    if (
      currentBatch.length > 0 &&
      (currentBatchSize + image.size > MAX_JOB_IMAGE_UPLOAD_BATCH_BYTES ||
        currentBatch.length >= MAX_JOB_IMAGE_UPLOAD_BATCH_ITEMS)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchSize = 0;
    }

    currentBatch.push(image);
    currentBatchSize += image.size;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function waitForClientDelay(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function mergeJobImageUploads(existingUploads: JobImageUpload[], nextUploads: JobImageUpload[]) {
  const uploadsById = new Map(existingUploads.map((upload) => [upload.id, upload]));

  for (const upload of nextUploads) {
    uploadsById.set(upload.id, upload);
  }

  return Array.from(uploadsById.values()).sort(compareJobImageUploads);
}

function compareJobImageUploads(a: JobImageUpload, b: JobImageUpload) {
  const aTimestamp = a.uploadedAt ?? a.attemptedAt ?? "";
  const bTimestamp = b.uploadedAt ?? b.attemptedAt ?? "";

  return bTimestamp.localeCompare(aTimestamp) || a.fileName.localeCompare(b.fileName);
}

function uploadClientId(upload: JobImageUpload) {
  return upload.clientId ?? upload.id;
}

function replaceFileExtension(fileName: string, extension: string) {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}.${extension}`;
  }

  return `${fileName.slice(0, extensionIndex)}.${extension}`;
}

function formatFileSize(bytes: number | undefined) {
  if (!bytes || !Number.isFinite(bytes)) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatJobImageQueueStatus(item: JobImageQueueItem) {
  if (item.status === "uploaded") {
    return "Uploaded";
  }

  if (item.status === "uploading") {
    return "Uploading";
  }

  if (item.status === "failed") {
    return "Failed";
  }

  return "Queued";
}

function normalizeSharedAppState(state: Partial<SharedAppState> | null | undefined): SharedAppState {
  const crewMembersByProject = normalizeCrewMembersByProject(state?.crewMembersByProject);
  const crewDirectory = mergeCrewDirectories(
    normalizeCrewMemberList(state?.crewDirectory),
    buildCrewDirectoryFromProjects(crewMembersByProject)
  );

  return buildSharedAppState({
    crewDirectory,
    crewMembersByProject,
    dailyReportUploadsByKey: state?.dailyReportUploadsByKey ?? {},
    dailyReportsByKey: state?.dailyReportsByKey ?? {},
    dayEntryNotesByKey: state?.dayEntryNotesByKey ?? {},
    daySubmissions: state?.daySubmissions ?? {},
    entries: state?.entries ?? [],
    myJobsByUser: state?.myJobsByUser ?? {},
    projectArchiveById: state?.projectArchiveById ?? {},
    projectBlacklistById: state?.projectBlacklistById ?? {},
    syncLog: state?.syncLog ?? []
  });
}

function readLocalSharedAppState(): SharedAppState {
  const crewMembersByProject = normalizeCrewMembersByProject(readLocalJson<unknown>("project-crew-members", {}));
  const crewDirectory = mergeCrewDirectories(
    normalizeCrewMemberList(readLocalJson<unknown>("crew-member-directory", [])),
    buildCrewDirectoryFromProjects(crewMembersByProject)
  );

  return buildSharedAppState({
    crewDirectory,
    crewMembersByProject,
    dailyReportUploadsByKey: readLocalJson<DailyReportUploadsByKey>("daily-report-uploads", {}),
    dailyReportsByKey: readLocalJson<DailyReportsByKey>("daily-reports", {}),
    dayEntryNotesByKey: readLocalJson<DayEntryNotesByKey>("day-entry-notes", {}),
    daySubmissions: readLocalJson<DaySubmissionsByKey>("day-submissions", {}),
    entries: readLocalJson<AllocationEntry[]>("allocation-entries", []),
    myJobsByUser: readLocalJson<MyJobsByUser>("my-jobs-by-user", {}),
    projectArchiveById: readLocalJson<ProjectArchiveById>("project-archive", {}),
    projectBlacklistById: readLocalJson<ProjectBlacklistById>("project-blacklist", {}),
    syncLog: readLocalJson<SyncLogEntry[]>("procore-sync-log", [])
  });
}

function writeLocalSharedAppState(state: SharedAppState) {
  window.localStorage.setItem("allocation-entries", JSON.stringify(state.entries));
  window.localStorage.setItem("day-submissions", JSON.stringify(state.daySubmissions));
  window.localStorage.setItem("day-entry-notes", JSON.stringify(state.dayEntryNotesByKey));
  window.localStorage.setItem("daily-reports", JSON.stringify(state.dailyReportsByKey));
  window.localStorage.setItem("daily-report-uploads", JSON.stringify(state.dailyReportUploadsByKey));
  window.localStorage.setItem("crew-member-directory", JSON.stringify(state.crewDirectory));
  window.localStorage.setItem("project-crew-members", JSON.stringify(state.crewMembersByProject));
  window.localStorage.setItem("my-jobs-by-user", JSON.stringify(state.myJobsByUser));
  window.localStorage.setItem("project-archive", JSON.stringify(state.projectArchiveById));
  window.localStorage.setItem("project-blacklist", JSON.stringify(state.projectBlacklistById));
  window.localStorage.setItem("procore-sync-log", JSON.stringify(state.syncLog));
}

function readLocalJson<TValue>(key: string, fallback: TValue): TValue {
  const value = window.localStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return fallback;
  }
}

function sortCrewMembersByName(crewMembers: CrewMember[]) {
  return [...crewMembers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function getCrewLaborType(source: { laborType?: CrewLaborType } | undefined | null): CrewLaborType {
  if (source?.laborType === "subcontractor" || source?.laborType === "temp_employee") {
    return source.laborType;
  }

  return DEFAULT_CREW_LABOR_TYPE;
}

function formatCrewLaborType(value: CrewLaborType | undefined) {
  if (value === "subcontractor") {
    return "Subcontractor";
  }

  if (value === "temp_employee") {
    return "Temp Employee";
  }

  return "Chinchor Employee";
}

function formatCrewLaborTypeWithCompany(source: { laborType?: CrewLaborType; subcontractorCompany?: string } | undefined | null) {
  const laborType = getCrewLaborType(source);
  const label = formatCrewLaborType(laborType);

  if (laborType === "subcontractor" && source?.subcontractorCompany) {
    return `${label}: ${source.subcontractorCompany}`;
  }

  return label;
}

function getCrewDisplayName(
  member: { name?: string; crewMemberName?: string; laborType?: CrewLaborType; subcontractorCompany?: string } | undefined | null
) {
  if (getCrewLaborType(member) === "subcontractor") {
    return member?.subcontractorCompany || member?.name || member?.crewMemberName || "Unknown subcontractor";
  }

  return member?.name || member?.crewMemberName || "Unknown crew member";
}

function getCrewJobTitle(member: { jobTitle?: string; laborType?: CrewLaborType } | undefined | null) {
  return getCrewLaborType(member) === "subcontractor" ? "Subcontractor" : member?.jobTitle || "-";
}

function formatCrewMemberMeta(member: { jobTitle: string; laborType?: CrewLaborType; subcontractorCompany?: string }) {
  if (getCrewLaborType(member) === "subcontractor") {
    return "Subcontractor";
  }

  return `${member.jobTitle} - ${formatCrewLaborTypeWithCompany(member)}`;
}

function formatCrewMemberOption(member: CrewMember) {
  return `${getCrewDisplayName(member)} - ${formatCrewMemberMeta(member)}`;
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

function getNetSuiteVendorCrewMemberId(vendorId: string) {
  return `netsuite-vendor-${vendorId}`;
}

function normalizeVendorSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeCrewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function projectHasCrewMember(crewMembers: CrewMember[], crewMemberId: string) {
  return crewMembers.some((member) => member.id === crewMemberId);
}

function mergeProjectCrewMembers(
  crewMembersByProject: CrewMembersByProject,
  sourceCrewMemberId: string,
  targetCrewMember: CrewMember
) {
  return Object.fromEntries(
    Object.entries(crewMembersByProject).map(([projectId, crewMembers]) => {
      const crewMembersById = new Map<string, CrewMember>();

      for (const crewMember of crewMembers) {
        if (crewMember.id === sourceCrewMemberId || crewMember.id === targetCrewMember.id) {
          crewMembersById.set(targetCrewMember.id, targetCrewMember);
        } else {
          crewMembersById.set(crewMember.id, crewMember);
        }
      }

      return [projectId, sortCrewMembersByName(Array.from(crewMembersById.values()))];
    })
  ) as CrewMembersByProject;
}

function mergeEntryCrewAllocations(
  entry: AllocationEntry,
  sourceCrewMemberId: string,
  targetCrewMember: CrewMember
): AllocationEntry {
  if (!entry.crewAllocations?.length) {
    return entry;
  }

  const mergedAllocations = new Map<string, NonNullable<AllocationEntry["crewAllocations"]>[number]>();
  let changed = false;

  for (const allocation of entry.crewAllocations) {
    const nextAllocation =
      allocation.crewMemberId === sourceCrewMemberId || allocation.crewMemberId === targetCrewMember.id
        ? {
            ...allocation,
            crewMemberId: targetCrewMember.id,
            crewMemberName: getCrewDisplayName(targetCrewMember),
            jobTitle: getCrewJobTitle(targetCrewMember),
            laborType: getCrewLaborType(targetCrewMember),
            subcontractorCompany: targetCrewMember.subcontractorCompany
          }
        : allocation;
    const existingAllocation = mergedAllocations.get(nextAllocation.crewMemberId);

    if (nextAllocation !== allocation) {
      changed = true;
    }

    if (existingAllocation) {
      changed = true;
      mergedAllocations.set(nextAllocation.crewMemberId, {
        ...existingAllocation,
        hours: existingAllocation.hours + nextAllocation.hours
      });
    } else {
      mergedAllocations.set(nextAllocation.crewMemberId, nextAllocation);
    }
  }

  if (!changed) {
    return entry;
  }

  return {
    ...entry,
    crewAllocations: Array.from(mergedAllocations.values())
  };
}

function mergeDraftCrewMembers(
  draftsByPayItem: DraftsByPayItem,
  sourceCrewMemberId: string,
  targetCrewMemberId: string
) {
  return Object.fromEntries(
    Object.entries(draftsByPayItem).map(([payItemId, draft]) => {
      const draftUsesSourceCrewMember =
        draft.crewMemberIds.includes(sourceCrewMemberId) || draft.crewHours[sourceCrewMemberId] !== undefined;

      if (!draftUsesSourceCrewMember) {
        return [payItemId, draft];
      }

      const nextCrewMemberIds = Array.from(
        new Set(draft.crewMemberIds.map((crewMemberId) => (crewMemberId === sourceCrewMemberId ? targetCrewMemberId : crewMemberId)))
      );
      const nextCrewHours: Record<string, string> = {};

      for (const [crewMemberId, hours] of Object.entries(draft.crewHours)) {
        const nextCrewMemberId = crewMemberId === sourceCrewMemberId ? targetCrewMemberId : crewMemberId;

        nextCrewHours[nextCrewMemberId] =
          nextCrewHours[nextCrewMemberId] === undefined
            ? hours
            : mergeDraftHourValues(nextCrewHours[nextCrewMemberId], hours);
      }

      return [
        payItemId,
        normalizeDraftCrewHours({
          ...draft,
          crewMemberIds: nextCrewMemberIds,
          crewHours: nextCrewHours
        })
      ];
    })
  ) as DraftsByPayItem;
}

function mergeDraftHourValues(firstValue: string, secondValue: string) {
  if (firstValue === "" && secondValue === "") {
    return "";
  }

  if (firstValue === "") {
    return secondValue;
  }

  if (secondValue === "") {
    return firstValue;
  }

  const firstNumber = Number(firstValue);
  const secondNumber = Number(secondValue);

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return String(Math.round((firstNumber + secondNumber) * 100) / 100);
  }

  return firstValue || secondValue;
}

function crewMemberHasSavedAllocations(crewMemberId: string, projectId: string, entries: AllocationEntry[]) {
  return entries.some(
    (entry) =>
      entry.projectId === projectId &&
      entry.crewAllocations?.some((allocation) => allocation.crewMemberId === crewMemberId)
  );
}

function getExistingDraft(
  draft: PayItemDraft | undefined,
  payItemId: string,
  visibleEntries: AllocationEntry[]
): PayItemDraft {
  if (draft) {
    return {
      hours: draft.hours ?? "",
      quantity: draft.quantity ?? "",
      crewMemberIds: draft.crewMemberIds ?? [],
      crewHours: draft.crewHours ?? {}
    };
  }

  const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItemId);

  return {
    hours: "",
    quantity: "",
    crewMemberIds: existingEntry?.crewAllocations?.map((allocation) => allocation.crewMemberId) ?? [],
    crewHours:
      existingEntry?.crewAllocations?.reduce<Record<string, string>>((hoursByCrewMemberId, allocation) => {
        hoursByCrewMemberId[allocation.crewMemberId] = String(allocation.hours);
        return hoursByCrewMemberId;
      }, {}) ?? {}
  };
}

function normalizeDraftCrewHours(draft: PayItemDraft) {
  const crewHours = Object.fromEntries(
    Object.entries(draft.crewHours).filter(([crewMemberId]) => draft.crewMemberIds.includes(crewMemberId))
  );
  const nextDraft: PayItemDraft = {
    ...draft,
    crewHours
  };
  const hourStats = getDraftCrewHourStats(nextDraft);

  return {
    ...nextDraft,
    hours: hourStats.hasAnyInput && !hourStats.hasInvalid ? formatDraftHourValue(hourStats.total) : ""
  };
}

function splitCrewHoursEvenly(draft: PayItemDraft) {
  const totalHours = getDraftTotalHours(draft);

  if (!Number.isFinite(totalHours) || draft.crewMemberIds.length === 0) {
    return draft;
  }

  const crewHours: Record<string, string> = {};
  const roundedShare = Math.floor((totalHours / draft.crewMemberIds.length) * 100) / 100;
  let allocated = 0;

  draft.crewMemberIds.forEach((crewMemberId, index) => {
    const value = index === draft.crewMemberIds.length - 1 ? totalHours - allocated : roundedShare;
    allocated += value;
    crewHours[crewMemberId] = value.toFixed(2);
  });

  return {
    ...draft,
    hours: formatDraftHourValue(totalHours),
    crewHours
  };
}

function getDraftCrewHourStats(draft: PayItemDraft | undefined) {
  if (!draft) {
    return {
      hasAnyInput: false,
      hasInvalid: false,
      hasMissing: false,
      hasNonPositive: false,
      total: 0
    };
  }

  let total = 0;
  let hasAnyInput = false;
  let hasInvalid = false;
  let hasMissing = false;
  let hasNonPositive = false;

  for (const crewMemberId of draft.crewMemberIds) {
    const value = draft.crewHours[crewMemberId];

    if (value === undefined || value === "") {
      hasMissing = true;
      continue;
    }

    hasAnyInput = true;
    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
      hasInvalid = true;
      continue;
    }

    if (hours <= 0) {
      hasNonPositive = true;
    }

    total += hours;
  }

  return {
    hasAnyInput,
    hasInvalid,
    hasMissing,
    hasNonPositive,
    total
  };
}

function getDraftTotalHours(draft: PayItemDraft | undefined, savedEntry?: AllocationEntry) {
  if (!draft) {
    return savedEntry?.hours ?? 0;
  }

  const hourStats = getDraftCrewHourStats(draft);

  if (hourStats.hasAnyInput) {
    return hourStats.hasInvalid ? Number.NaN : hourStats.total;
  }

  if (draft.crewMemberIds.length > 0 && draft.hours === "") {
    return 0;
  }

  if (draft.hours !== "") {
    const fallbackHours = Number(draft.hours);

    if (Number.isFinite(fallbackHours) && fallbackHours >= 0) {
      return fallbackHours;
    }
  }

  return savedEntry?.hours ?? 0;
}

function formatDraftHourValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getCrewAllocationError(draft: PayItemDraft | undefined, crewMembers: CrewMember[]) {
  if (!draft || !draftHasAnyInput(draft)) {
    return "";
  }

  if (crewMembers.length === 0) {
    return "Add at least one crew member before saving hours.";
  }

  if (draft.crewMemberIds.length === 0) {
    return "Select at least one crew member for every row with hours.";
  }

  const selectedCrewMemberIds = new Set(draft.crewMemberIds);

  if (draft.crewMemberIds.some((crewMemberId) => !crewMembers.some((member) => member.id === crewMemberId))) {
    return "One selected crew member is no longer saved to this job.";
  }

  const hourStats = getDraftCrewHourStats(draft);

  if (hourStats.hasMissing || !hourStats.hasAnyInput) {
    return "Enter allocated hours for each selected crew member.";
  }

  if (hourStats.hasInvalid) {
    return "Enter valid allocated hours for each selected crew member.";
  }

  if (hourStats.hasNonPositive) {
    return "Enter allocated hours greater than 0 for each selected crew member.";
  }

  if (Array.from(selectedCrewMemberIds).length !== draft.crewMemberIds.length) {
    return "Remove duplicate crew selections before saving.";
  }

  if (hourStats.total <= 0) {
    return "Allocate more than 0 crew hours before saving.";
  }

  return "";
}

function buildCrewAllocations(draft: PayItemDraft | undefined, crewMembers: CrewMember[], totalHours: number) {
  if (!draft || totalHours <= 0 || draft.crewMemberIds.length === 0) {
    return [];
  }

  return draft.crewMemberIds.map((crewMemberId) => {
    const crewMember = crewMembers.find((member) => member.id === crewMemberId);
    const hours = Number(draft.crewHours[crewMemberId]);

    return {
      crewMemberId,
      crewMemberName: getCrewDisplayName(crewMember),
      jobTitle: getCrewJobTitle(crewMember),
      laborType: getCrewLaborType(crewMember),
      subcontractorCompany: crewMember?.subcontractorCompany,
      hours
    };
  });
}

function scaleCrewAllocations(allocations: NonNullable<AllocationEntry["crewAllocations"]>, nextTotalHours: number) {
  if (allocations.length === 0) {
    return [];
  }

  if (allocations.length === 1) {
    return [
      {
        ...allocations[0],
        hours: nextTotalHours
      }
    ];
  }

  const currentTotalHours = allocations.reduce((total, allocation) => total + allocation.hours, 0);

  if (currentTotalHours <= 0) {
    const draft = splitCrewHoursEvenly({
      hours: String(nextTotalHours),
      quantity: "",
      crewMemberIds: allocations.map((allocation) => allocation.crewMemberId),
      crewHours: {}
    });

    return allocations.map((allocation) => ({
      ...allocation,
      hours: Number(draft.crewHours[allocation.crewMemberId] ?? 0)
    }));
  }

  let allocated = 0;

  return allocations.map((allocation, index) => {
    const value =
      index === allocations.length - 1
        ? nextTotalHours - allocated
        : Math.round((allocation.hours / currentTotalHours) * nextTotalHours * 100) / 100;

    allocated += value;

    return {
      ...allocation,
      hours: value
    };
  });
}

function buildCrewSummary(entries: AllocationEntry[], crewMembers: CrewMember[]) {
  const rows = new Map<string, CrewSummaryRow>();

  for (const entry of entries) {
    if (!entry.crewAllocations?.length) {
      rows.set("unassigned", {
        crewMemberId: "unassigned",
        name: "Unassigned",
        jobTitle: "No crew selected",
        laborType: DEFAULT_CREW_LABOR_TYPE,
        hours: (rows.get("unassigned")?.hours ?? 0) + entry.hours
      });
      continue;
    }

    for (const allocation of entry.crewAllocations) {
      const crewMember = crewMembers.find((member) => member.id === allocation.crewMemberId);
      const row = rows.get(allocation.crewMemberId) ?? {
        crewMemberId: allocation.crewMemberId,
        name: crewMember ? getCrewDisplayName(crewMember) : getCrewDisplayName(allocation),
        jobTitle: crewMember ? getCrewJobTitle(crewMember) : getCrewJobTitle(allocation),
        laborType: crewMember ? getCrewLaborType(crewMember) : getCrewLaborType(allocation),
        subcontractorCompany: crewMember?.subcontractorCompany ?? allocation.subcontractorCompany,
        hours: 0
      };

      row.hours += allocation.hours;
      rows.set(allocation.crewMemberId, row);
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatEntryCrew(entry: AllocationEntry) {
  if (!entry.crewAllocations?.length) {
    return "Crew: Unassigned";
  }

  return `Crew: ${entry.crewAllocations
    .map((allocation) => `${getCrewDisplayName(allocation)} ${allocation.hours.toFixed(2)}h`)
    .join(", ")}`;
}

function draftIsSaveable(draft: PayItemDraft | undefined) {
  const hasQuantityInput = draft?.quantity !== undefined && draft.quantity !== "";

  if (!draft || !hasQuantityInput) {
    return false;
  }

  const hours = getDraftTotalHours(draft);
  const quantity = Number(draft.quantity);
  const hourStats = getDraftCrewHourStats(draft);

  return (
    hours > 0 &&
    quantity >= 0 &&
    Number.isFinite(hours) &&
    Number.isFinite(quantity) &&
    hourStats.hasAnyInput &&
    !hourStats.hasInvalid &&
    !hourStats.hasMissing &&
    !hourStats.hasNonPositive
  );
}

function getDraftQuantityOverrunWarnings(
  payItems: PayItem[],
  draftsByPayItem: DraftsByPayItem,
  visibleEntries: AllocationEntry[],
  remainingQuantitiesByPayItem: Record<string, number>
) {
  const warnings: string[] = [];

  for (const payItem of payItems) {
    const draft = draftsByPayItem[payItem.id];

    if (!draftIsSaveable(draft)) {
      continue;
    }

    const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItem.id);
    const quantity = draft?.quantity ? Number(draft.quantity) : existingEntry?.quantityCompleted ?? 0;
    const remainingQuantity = remainingQuantitiesByPayItem[payItem.id] ?? payItem.budgetedQuantity;

    if (Number.isFinite(quantity) && quantity > remainingQuantity + 0.0001) {
      warnings.push(
        `${payItem.code}: ${formatPayItemQuantity(quantity)} entered, ${formatPayItemQuantity(remainingQuantity)} remaining.`
      );
    }
  }

  return warnings;
}

function confirmQuantityOverrun(warnings: string[]) {
  const visibleWarnings = warnings.slice(0, 6);
  const hiddenWarningCount = warnings.length - visibleWarnings.length;
  const hiddenText = hiddenWarningCount > 0 ? `\n${hiddenWarningCount} more overrun${hiddenWarningCount === 1 ? "" : "s"} not shown.` : "";

  return window.confirm(
    [
      "Quantity overrun warning",
      "",
      "One or more quantities exceed the remaining quantity for this job. This is allowed, but should be intentional.",
      "",
      ...visibleWarnings,
      hiddenText,
      "",
      "Save anyway?"
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function draftIsIncomplete(draft: PayItemDraft | undefined) {
  if (!draft) {
    return false;
  }

  const hasQuantityInput = draft.quantity !== "";
  const hasCrewInput =
    draft.crewMemberIds.length > 0 ||
    Object.values(draft.crewHours).some((value) => value !== "") ||
    draft.hours !== "";

  if (!hasQuantityInput && !hasCrewInput) {
    return false;
  }

  return !draftIsSaveable(draft);
}

function draftHasAnyInput(draft: PayItemDraft | undefined) {
  if (!draft) {
    return false;
  }

  return (
    draft.hours !== "" ||
    draft.quantity !== "" ||
    draft.crewMemberIds.length > 0 ||
    Object.values(draft.crewHours).some((value) => value !== "")
  );
}

function buildRemainingQuantitiesByPayItem(
  payItems: Project["payItems"],
  projectEntries: AllocationEntry[],
  selectedDate: string
) {
  const previousQuantitiesByPayItem: Record<string, number> = {};

  for (const entry of projectEntries) {
    if (entry.date >= selectedDate) {
      continue;
    }

    previousQuantitiesByPayItem[entry.payItemId] =
      (previousQuantitiesByPayItem[entry.payItemId] ?? 0) + entry.quantityCompleted;
  }

  return payItems.reduce<Record<string, number>>((remainingQuantities, payItem) => {
    remainingQuantities[payItem.id] = payItem.budgetedQuantity - (previousQuantitiesByPayItem[payItem.id] ?? 0);

    return remainingQuantities;
  }, {});
}

function formatPayItemQuantity(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function formatPayItemUnitOfMeasure(payItem: Pick<PayItem, "unitOfMeasure"> | null | undefined) {
  return typeof payItem?.unitOfMeasure === "string" ? payItem.unitOfMeasure.toUpperCase() : "";
}

function buildEntryConflictSignature(entries: AllocationEntry[]) {
  return entries
    .map((entry) => {
      const crewSignature = (entry.crewAllocations ?? [])
        .map((allocation) =>
          [
            allocation.crewMemberId,
            allocation.crewMemberName,
            allocation.jobTitle,
            formatConflictNumber(allocation.hours)
          ].join(":")
        )
        .sort()
        .join(",");

      return [
        entry.id,
        entry.payItemId,
        formatConflictNumber(entry.hours),
        formatConflictNumber(entry.quantityCompleted),
        formatConflictTimestamp(entry.savedAt),
        crewSignature
      ].join("|");
    })
    .sort()
    .join(";");
}

function buildDaySubmissionConflictSignature(daySubmission: DaySubmission) {
  return [
    daySubmission.status,
    daySubmission.submittedByUserId ?? "",
    daySubmission.submittedByName ?? "",
    daySubmission.submittedAt ?? ""
  ].join("|");
}

function buildDailyReportConflictSignature(dailyReport: DailyReport | undefined) {
  if (!dailyReport) {
    return "";
  }

  return JSON.stringify({
    updatedAt: dailyReport.updatedAt,
    report: normalizeDailyReportAnswersForSave(getDailyReportAnswers(dailyReport))
  });
}

function formatConflictNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : "";
}

function formatConflictTimestamp(value: string | undefined) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? String(timestamp) : value;
}

function getEntryNoticeClassName(message: string) {
  return entryNoticeIsError(message) ? "inline-alert" : entryNoticeIsProgress(message) ? "status-alert" : "success-alert";
}

function entryNoticeIsProgress(message: string) {
  return ["Deleting", "Removing", "Reopening", "Saving", "Submitting"].some((prefix) => message.startsWith(prefix));
}

function entryNoticeIsError(message: string) {
  return [
    "Add at least",
    "A crew member",
    "Crew member is already",
    "Crew allocated",
    "Enter both",
    "Enter valid",
    "Select an existing",
    "One selected",
    "Remove duplicate",
    "Select at least",
    "Select both",
    "Select two different",
    "This daily report",
    "This day status",
    "This job/day"
  ].some((prefix) => message.startsWith(prefix)) || message.includes(" is already saved to this job.");
}

function entryNoticeIsCrewRelated(message: string) {
  return (
    message.startsWith("A crew member") ||
    message.startsWith("Crew member is already") ||
    message.startsWith("Enter both crew member") ||
    message.startsWith("Select an existing") ||
    message.includes(" is already saved to this job.") ||
    message.includes(" added to ") ||
    message.includes(" updated across saved days") ||
    message.includes(" merged into ") ||
    message.startsWith("Select both crew members") ||
    message.startsWith("Select two different crew members")
  );
}

function isDailyReportTimeField(field: keyof DailyReportEmployeeRow): field is DailyReportTimeField {
  return field === "timeIn" || field === "lunchOut" || field === "lunchIn" || field === "timeOut";
}

function sanitizeDailyReportTimeInput(value: string) {
  const cleaned = value.replace(/[^\d:]/g, "");

  if (!cleaned.includes(":")) {
    return cleaned.slice(0, 4);
  }

  const [hours = "", minutes = ""] = cleaned.split(":");

  return `${hours.slice(0, 2)}:${minutes.slice(0, 2)}`;
}

function normalizeDailyReportTimeInput(value: string) {
  const cleaned = sanitizeDailyReportTimeInput(value);

  if (!cleaned) {
    return "";
  }

  let hourText = "";
  let minuteText = "";

  if (cleaned.includes(":")) {
    const [hours = "", minutes = ""] = cleaned.split(":");

    hourText = hours;
    minuteText = minutes.padEnd(2, "0").slice(0, 2);
  } else if (cleaned.length <= 2) {
    hourText = cleaned;
    minuteText = "00";
  } else if (cleaned.length === 3) {
    hourText = cleaned.slice(0, 1);
    minuteText = cleaned.slice(1);
  } else {
    hourText = cleaned.slice(0, 2);
    minuteText = cleaned.slice(2);
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "";
  }

  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function parseDailyReportTimeToMinutes(value: string) {
  const normalized = normalizeDailyReportTimeInput(value);

  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(":").map(Number);

  return hours * 60 + minutes;
}

function calculateDailyReportDurationMinutes(start: number, end: number) {
  let duration = end - start;

  if (duration < 0) {
    duration += 12 * 60;
  }

  return duration > 12 * 60 ? null : duration;
}

function calculateDailyReportTotalHours(row: DailyReportEmployeeRow) {
  const timeIn = parseDailyReportTimeToMinutes(row.timeIn);
  const timeOut = parseDailyReportTimeToMinutes(row.timeOut);

  if (timeIn === null || timeOut === null) {
    return "";
  }

  const workMinutes = calculateDailyReportDurationMinutes(timeIn, timeOut);

  if (workMinutes === null) {
    return "";
  }

  const lunchOut = parseDailyReportTimeToMinutes(row.lunchOut);
  const lunchIn = parseDailyReportTimeToMinutes(row.lunchIn);
  let lunchMinutes = 0;

  if (lunchOut !== null && lunchIn !== null) {
    const calculatedLunchMinutes = calculateDailyReportDurationMinutes(lunchOut, lunchIn);

    if (calculatedLunchMinutes === null) {
      return "";
    }

    lunchMinutes = calculatedLunchMinutes;
  }

  const totalMinutes = workMinutes - lunchMinutes;

  if (totalMinutes < 0 || totalMinutes > 12 * 60) {
    return "";
  }

  return (totalMinutes / 60).toFixed(2);
}

function createEmptyAdminUserForm(): AdminUserFormState {
  return {
    active: true,
    firstName: "",
    lastName: "",
    netSuiteProjectManagerId: "",
    netSuiteProjectManagerName: "",
    password: "",
    role: "standard",
    userId: ""
  };
}

function createEmptyChangePasswordForm(): ChangePasswordFormState {
  return {
    confirmPassword: "",
    currentPassword: "",
    newPassword: ""
  };
}

function createEmptyPasswordResetForm(): PasswordResetFormState {
  return {
    confirmPassword: "",
    newPassword: "",
    token: "",
    userId: ""
  };
}

function createEmptyDailyReportAnswers(): DailyReportAnswers {
  return {
    employeeRows: createEmptyDailyReportEmployeeRows(),
    payItemRows: createEmptyDailyReportPayItemRows(),
    quantitiesTurnedIn: "",
    inspectorName: "",
    inspectorQuantityDetails: "",
    workDescription: "",
    planSheetNumbers: "",
    workDetails: "",
    incidentOccurred: "",
    incidentDetails: "",
    accidentReportFiled: "",
    motSigns: "",
    conesBarrels: "",
    typeIISidewalkBarricades: "",
    typeIIIBarricades: "",
    lcdCount: "",
    lcdFootage: "",
    arrowBoards: "",
    vmsBoards: "",
    fdotIndex: "",
    itsfmRows: createEmptyDailyReportItsfmRows(),
    itsfmAbovegroundEquipment: "",
    itsfmCabinetEquipment: "",
    twoSeriesEquipmentTools: "",
    twoSeriesSafetyIssues: "",
    twoSeriesDelayReasons: "",
    twoSeriesDeliveries: ""
  };
}

function getDailyReportAnswers(report: DailyReport): DailyReportAnswers {
  return {
    employeeRows: normalizeDailyReportEmployeeRows(report.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(report.payItemRows),
    quantitiesTurnedIn: report.quantitiesTurnedIn ?? "",
    inspectorName: report.inspectorName ?? "",
    inspectorQuantityDetails: report.inspectorQuantityDetails ?? "",
    workDescription: report.workDescription ?? "",
    planSheetNumbers: report.planSheetNumbers ?? "",
    workDetails: report.workDetails ?? "",
    incidentOccurred: report.incidentOccurred ?? "",
    incidentDetails: report.incidentDetails ?? "",
    accidentReportFiled: report.accidentReportFiled ?? "",
    motSigns: report.motSigns ?? "",
    conesBarrels: report.conesBarrels ?? "",
    typeIISidewalkBarricades: report.typeIISidewalkBarricades ?? "",
    typeIIIBarricades: report.typeIIIBarricades ?? "",
    lcdCount: report.lcdCount ?? "",
    lcdFootage: report.lcdFootage ?? "",
    arrowBoards: report.arrowBoards ?? "",
    vmsBoards: report.vmsBoards ?? "",
    fdotIndex: report.fdotIndex ?? "",
    itsfmRows: normalizeDailyReportItsfmRows(report.itsfmRows),
    itsfmAbovegroundEquipment: report.itsfmAbovegroundEquipment ?? "",
    itsfmCabinetEquipment: report.itsfmCabinetEquipment ?? "",
    twoSeriesEquipmentTools: report.twoSeriesEquipmentTools ?? "",
    twoSeriesSafetyIssues: report.twoSeriesSafetyIssues ?? "",
    twoSeriesDelayReasons: report.twoSeriesDelayReasons ?? "",
    twoSeriesDeliveries: report.twoSeriesDeliveries ?? ""
  };
}

function normalizeDailyReportAnswersForSave(report: DailyReportAnswers): DailyReportAnswers {
  return {
    ...report,
    accidentReportFiled: report.incidentOccurred === "yes" ? report.accidentReportFiled : "",
    incidentDetails: report.incidentOccurred === "yes" ? report.incidentDetails : "",
    inspectorName: report.quantitiesTurnedIn === "yes" ? report.inspectorName : "",
    inspectorQuantityDetails: report.quantitiesTurnedIn === "yes" ? report.inspectorQuantityDetails : "",
    employeeRows: normalizeDailyReportEmployeeRows(report.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(report.payItemRows),
    itsfmRows: normalizeDailyReportItsfmRows(report.itsfmRows)
  };
}

function validateDailyReportAnswers(
  report: DailyReportAnswers,
  payItems: PayItem[],
  options: DailyReportValidationOptions = { template: "standard" }
): DailyReportValidationResult {
  const errors: string[] = [];
  const isTwoSeriesTemplate = options.template === "two-series";
  const payItemIds = new Set(payItems.map((payItem) => payItem.id));
  const employeeRows = normalizeDailyReportEmployeeRows(report.employeeRows);
  const activeEmployeeRows = employeeRows
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => dailyReportEmployeeRowHasContent(row));

  if (activeEmployeeRows.length === 0) {
    errors.push("Add at least one employee time row.");
  }

  for (const { index, row } of activeEmployeeRows) {
    const rowLabel = `Employee row ${index + 1}`;
    const timeFields: Array<{ field: DailyReportTimeField; label: string }> = [
      { field: "timeIn", label: "Time In" },
      { field: "lunchOut", label: "Lunch Out" },
      { field: "lunchIn", label: "Lunch In" },
      { field: "timeOut", label: "Time Out" }
    ];
    const invalidTimeLabels = timeFields
      .filter(({ field }) => row[field].trim() && !normalizeDailyReportTimeInput(row[field]))
      .map(({ label }) => label);
    const missingTimeLabels = timeFields
      .filter(({ field }) => (field === "timeIn" || field === "timeOut") && !row[field].trim())
      .map(({ label }) => label);
    const hasPartialLunch = Boolean(row.lunchOut.trim()) !== Boolean(row.lunchIn.trim());
    const calculatedTotalHours = Number(row.totalHours || calculateDailyReportTotalHours(row));

    if (!row.employeeClassification.trim()) {
      errors.push(`${rowLabel}: enter employee name/classification.`);
    }

    for (const label of missingTimeLabels) {
      errors.push(`${rowLabel}: enter ${label}.`);
    }

    if (invalidTimeLabels.length > 0) {
      errors.push(`${rowLabel}: fix ${invalidTimeLabels.join(", ")} to HH:MM format.`);
    }

    if (hasPartialLunch) {
      errors.push(`${rowLabel}: enter both Lunch Out and Lunch In, or leave both blank.`);
    }

    if (
      missingTimeLabels.length === 0 &&
      invalidTimeLabels.length === 0 &&
      !hasPartialLunch &&
      (!Number.isFinite(calculatedTotalHours) || calculatedTotalHours <= 0)
    ) {
      errors.push(`${rowLabel}: enter valid time values so Total Hours calculates.`);
    }

    if (Number.isFinite(calculatedTotalHours) && calculatedTotalHours > 12) {
      errors.push(`${rowLabel}: Total Hours cannot exceed 12.`);
    }

    if (isTwoSeriesTemplate) {
      validateTwoSeriesProductionAllocation(row, rowLabel, calculatedTotalHours, errors);
    }
  }

  const payItemRows = normalizeDailyReportPayItemRows(report.payItemRows);
  const activePayItemRows = payItemRows
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => dailyReportPayItemRowHasContent(row));

  if (!isTwoSeriesTemplate) {
    if (activePayItemRows.length === 0) {
      errors.push("Add at least one Work Performed pay item row.");
    }

    for (const { index, row } of activePayItemRows) {
      const rowLabel = `Work Performed row ${index + 1}`;
      const quantity = parseDailyReportPositiveNumber(row.quantity);

      if (!row.payItemId.trim()) {
        errors.push(`${rowLabel}: select a pay item.`);
      } else if (!payItemIds.has(row.payItemId)) {
        errors.push(`${rowLabel}: select a valid pay item for this job.`);
      }

      if (!row.quantity.trim()) {
        errors.push(`${rowLabel}: enter quantity.`);
      } else if (quantity === null || quantity <= 0) {
        errors.push(`${rowLabel}: quantity must be greater than 0.`);
      }
    }

    if (!isAnsweredYesNo(report.quantitiesTurnedIn)) {
      errors.push("Answer whether quantities were turned into the inspector.");
    }

    if (report.quantitiesTurnedIn === "yes") {
      if (!report.inspectorName.trim()) {
        errors.push("Enter the inspector name.");
      }

      if (!report.inspectorQuantityDetails.trim()) {
        errors.push("Enter the quantities and items turned into the inspector.");
      }
    }

    if (!isAnsweredYesNo(report.incidentOccurred)) {
      errors.push("Answer whether there were incidents or accidents today.");
    }

    if (report.incidentOccurred === "yes") {
      if (!isAnsweredYesNo(report.accidentReportFiled)) {
        errors.push("Answer whether an accident report was filed.");
      }

      if (!report.incidentDetails.trim()) {
        errors.push("Enter incident / accident details.");
      }
    }
  } else if (!report.workDescription.trim()) {
    errors.push("Enter the detailed description of work completed.");
  }

  return {
    errors,
    warnings: []
  };
}

function validateTwoSeriesProductionAllocation(
  row: DailyReportEmployeeRow,
  rowLabel: string,
  totalHours: number,
  errors: string[]
) {
  const productionPairs = [
    {
      code: row.productionCode1.trim(),
      hours: row.productionHours1.trim(),
      label: "first production code"
    },
    {
      code: row.productionCode2.trim(),
      hours: row.productionHours2.trim(),
      label: "second production code"
    }
  ];
  const allowedCodes = new Set(TWO_SERIES_PRODUCTION_CODES.map((productionCode) => productionCode.code));
  let productionHoursTotal = 0;
  let completeProductionPairCount = 0;

  for (const pair of productionPairs) {
    const hasCode = Boolean(pair.code);
    const hasHours = Boolean(pair.hours);
    const parsedHours = parseDailyReportPositiveNumber(pair.hours);

    if (!hasCode && !hasHours) {
      continue;
    }

    if (!hasCode) {
      errors.push(`${rowLabel}: select the ${pair.label}.`);
      continue;
    }

    if (!allowedCodes.has(pair.code)) {
      errors.push(`${rowLabel}: select a valid ${pair.label}.`);
    }

    if (!hasHours) {
      errors.push(`${rowLabel}: enter hours for the ${pair.label}.`);
      continue;
    }

    if (parsedHours === null || parsedHours <= 0) {
      errors.push(`${rowLabel}: production hours must be greater than 0.`);
      continue;
    }

    productionHoursTotal += parsedHours;
    completeProductionPairCount += 1;
  }

  if (completeProductionPairCount === 0) {
    errors.push(`${rowLabel}: add at least one production code and hours.`);
    return;
  }

  if (Number.isFinite(totalHours) && totalHours > 0 && Math.abs(productionHoursTotal - totalHours) > 0.01) {
    errors.push(`${rowLabel}: production hours must equal Total Hours.`);
  }
}

function parseDailyReportPositiveNumber(value: string) {
  const number = Number(value.replaceAll(",", "").trim());

  return Number.isFinite(number) ? number : null;
}

function isAnsweredYesNo(value: string) {
  return value === "yes" || value === "no";
}

function formatDailyReportValidationMessage(errors: string[]) {
  const visibleErrors = errors.slice(0, 6);
  const remainingErrorCount = errors.length - visibleErrors.length;
  const remainingText =
    remainingErrorCount > 0 ? ` ${remainingErrorCount} more item${remainingErrorCount === 1 ? "" : "s"} need attention.` : "";

  return `${DAILY_REPORT_VALIDATION_NOTICE_PREFIX}: ${visibleErrors.join(" ")}${remainingText}`;
}

function createEmptyDailyReportItsfmRows() {
  return DAILY_REPORT_ITSFM_ITEMS.map((item) => createEmptyDailyReportItsfmRow(item.key));
}

function createEmptyDailyReportItsfmRow(itemKey: string): DailyReportItsfmRow {
  return {
    itemKey,
    location: "",
    modelNumber: "",
    serialNumber: ""
  };
}

function normalizeDailyReportItsfmRows(rows: DailyReportItsfmRow[] | undefined) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.itemKey, row]));

  return DAILY_REPORT_ITSFM_ITEMS.map((item) => ({
    ...createEmptyDailyReportItsfmRow(item.key),
    ...(rowsByKey.get(item.key) ?? {})
  }));
}

function createEmptyDailyReportPayItemRows() {
  return Array.from({ length: 8 }, () => ({
    notes: "",
    payItemId: "",
    quantity: ""
  }));
}

function normalizeDailyReportPayItemRows(rows: DailyReportPayItemRow[] | undefined) {
  const emptyRows = createEmptyDailyReportPayItemRows();

  return emptyRows.map((emptyRow, index) => ({
    ...emptyRow,
    ...(rows?.[index] ?? {})
  }));
}

function createEmptyDailyReportEmployeeRows() {
  return Array.from({ length: 10 }, () => ({
    employeeClassification: "",
    truckNumber: "",
    timeIn: "",
    lunchOut: "",
    lunchIn: "",
    timeOut: "",
    productionCode1: "",
    productionHours1: "",
    productionCode2: "",
    productionHours2: "",
    totalHours: "",
    driver: false,
    passenger: false
  }));
}

function normalizeDailyReportEmployeeRows(rows: DailyReportEmployeeRow[] | undefined) {
  const emptyRows = createEmptyDailyReportEmployeeRows();

  return emptyRows.map((emptyRow, index) => ({
    ...emptyRow,
    ...(rows?.[index] ?? {})
  }));
}

function findPreviousDailyReportWithCrewTime(dailyReportsByKey: DailyReportsByKey, projectId: string, date: string) {
  const previousReports = Object.values(dailyReportsByKey)
    .filter(
      (report) =>
        report.projectId === projectId &&
        report.date < date &&
        normalizeDailyReportEmployeeRows(report.employeeRows).some(dailyReportEmployeeRowHasContent)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const previousReport = previousReports[0];

  return previousReport
    ? {
        date: previousReport.date,
        report: previousReport
      }
    : null;
}

function dailyReportEmployeeRowHasContent(row: DailyReportEmployeeRow) {
  return (
    Boolean(row.employeeClassification.trim()) ||
    Boolean(row.truckNumber.trim()) ||
    Boolean(row.timeIn.trim()) ||
    Boolean(row.lunchOut.trim()) ||
    Boolean(row.lunchIn.trim()) ||
    Boolean(row.timeOut.trim()) ||
    Boolean(row.productionCode1.trim()) ||
    Boolean(row.productionHours1.trim()) ||
    Boolean(row.productionCode2.trim()) ||
    Boolean(row.productionHours2.trim()) ||
    Boolean(row.totalHours.trim()) ||
    row.driver ||
    row.passenger
  );
}

function getDailyReportEmployeeTotalHours(rows: DailyReportEmployeeRow[] | undefined) {
  return normalizeDailyReportEmployeeRows(rows).reduce((total, row) => {
    if (!dailyReportEmployeeRowHasContent(row)) {
      return total;
    }

    const rowHours = Number(row.totalHours || calculateDailyReportTotalHours(row));
    return Number.isFinite(rowHours) ? total + rowHours : total;
  }, 0);
}

function dailyReportPayItemRowHasContent(row: DailyReportPayItemRow) {
  return Boolean(row.payItemId.trim()) || Boolean(row.quantity.trim()) || Boolean(row.notes.trim());
}

function formatYesNoAnswer(value: string) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "Not answered";
}

function readDailyReportAutosaveDraft(
  userId: string,
  projectId: string,
  date: string
): DailyReportAutosaveDraft | null {
  const value = readLocalJson<Partial<DailyReportAutosaveDraft> | null>(
    getDailyReportDraftStorageKey(userId, projectId, date),
    null
  );

  if (!value || value.userId !== userId || value.projectId !== projectId || value.date !== date || !value.draft) {
    return null;
  }

  return {
    date,
    draft: normalizeDailyReportDraftAnswers(value.draft),
    projectId,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
    userId
  };
}

function writeDailyReportAutosaveDraft(draft: DailyReportAutosaveDraft) {
  window.localStorage.setItem(getDailyReportDraftStorageKey(draft.userId, draft.projectId, draft.date), JSON.stringify(draft));
}

function clearDailyReportAutosaveDraft(userId: string, projectId: string, date: string) {
  window.localStorage.removeItem(getDailyReportDraftStorageKey(userId, projectId, date));
}

function clearAllDailyReportAutosaveDrafts() {
  const keysToClear: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(`${DAILY_REPORT_DRAFT_STORAGE_PREFIX}:`)) {
      keysToClear.push(key);
    }
  }

  for (const key of keysToClear) {
    window.localStorage.removeItem(key);
  }
}

function getDailyReportDraftStorageKey(userId: string, projectId: string, date: string) {
  return `${DAILY_REPORT_DRAFT_STORAGE_PREFIX}:${userId}:${projectId}:${date}`;
}

function clearPendingDailyReportAutosaveTimeout(timeoutRef: { current: number | null }) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function normalizeDailyReportDraftAnswers(value: unknown): DailyReportAnswers {
  const draft = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<DailyReportAnswers>) : {};
  const emptyDraft = createEmptyDailyReportAnswers();

  return {
    ...emptyDraft,
    ...draft,
    employeeRows: normalizeDailyReportEmployeeRows(draft.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(draft.payItemRows),
    itsfmRows: normalizeDailyReportItsfmRows(draft.itsfmRows)
  };
}

function readPendingProcoreReturn(): PendingProcoreReturn | null {
  const value = window.localStorage.getItem(PENDING_PROCORE_RETURN_KEY);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PendingProcoreReturn;

    return {
      date: parsed.date,
      intent: parsed.intent === "upload_daily" ? "upload_daily" : "connect",
      mobilePayItemId: parsed.mobilePayItemId,
      projectId: parsed.projectId,
      viewMode:
        parsed.viewMode === "dashboard" || parsed.viewMode === "calendar" || parsed.viewMode === "reports"
          ? parsed.viewMode
          : "entry"
    };
  } catch {
    window.localStorage.removeItem(PENDING_PROCORE_RETURN_KEY);
    return null;
  }
}

function getLastProjectStorageKey(userId: string) {
  return `last-selected-project-${userId}`;
}

function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
}

function parseDayKey(dayKey: string) {
  const [projectId, date] = dayKey.split("|");

  if (!projectId || !date) {
    return null;
  }

  return {
    date,
    projectId
  };
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

function getDefaultViewModeForUser(): ViewMode {
  return "dashboard";
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

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseInputDate(value).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

function formatStatusDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "numeric",
    year: "numeric"
  });
}

function getWeekStart(value: string) {
  const date = parseInputDate(value);

  date.setDate(date.getDate() - date.getDay());

  return formatInputDate(date);
}

function getWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToInputDate(weekStart, index));
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

function exportEntriesToCsv({
  dayEntryNotesByKey,
  daySubmissions,
  entries,
  projectBlacklistById,
  projects
}: {
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
}) {
  const headers = [
    "entry_id",
    "project_id",
    "project_name",
    "project_blacklisted",
    "entry_date",
    "day_status",
    "day_notes",
    "day_inventory",
    "submitted_by_user_id",
    "submitted_by_name",
    "submitted_at",
    "pay_item_id",
    "pay_item_code",
    "pay_item_name",
    "pay_item_budgeted_quantity",
    "pay_item_unit_of_measure",
    "entry_total_hours",
    "entry_total_quantity_completed",
    "entry_hours_per_unit",
    "crew_member_id",
    "crew_member_name",
    "crew_job_title",
    "crew_labor_type",
    "subcontractor_company",
    "crew_hours",
    "crew_hour_share_percent",
    "crew_quantity_completed_prorated",
    "crew_hours_per_unit",
    "saved_by_user_id",
    "saved_by_name",
    "saved_at"
  ];
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const rows = entries.flatMap((entry) =>
    buildEntryCsvRows({
      daySubmission: daySubmissions[getDayKey(entry.projectId, entry.date)],
      dayEntryNotes: dayEntryNotesByKey[getDayKey(entry.projectId, entry.date)],
      entry,
      project: projectMap.get(entry.projectId),
      projectBlacklisted: Boolean(projectBlacklistById[entry.projectId])
    })
  );
  const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(",")).join("\r\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `time-allocation-entry-detail-${todayInputValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildEntryCsvRows({
  dayEntryNotes,
  daySubmission,
  entry,
  project,
  projectBlacklisted
}: {
  dayEntryNotes: DayEntryNotes | undefined;
  daySubmission: DaySubmission | undefined;
  entry: AllocationEntry;
  project: Project | undefined;
  projectBlacklisted: boolean;
}) {
  const projectName = entry.projectName ?? project?.name ?? "";
  const baseRow = [
    entry.id,
    formatCsvIdentifier(entry.projectId),
    projectName,
    projectBlacklisted ? "yes" : "no",
    entry.date,
    daySubmission?.status ?? "draft",
    dayEntryNotes?.notes ?? "",
    dayEntryNotes?.inventory ?? "",
    daySubmission?.submittedByUserId ?? "",
    daySubmission?.submittedByName ?? "",
    daySubmission?.submittedAt ?? "",
    formatCsvIdentifier(entry.payItemId),
    entry.payItemCode,
    entry.payItemName,
    formatCsvNumber(entry.payItemBudgetedQuantity),
    entry.payItemUnitOfMeasure ?? "",
    formatCsvNumber(entry.hours),
    formatCsvNumber(entry.quantityCompleted),
    formatCsvNumber(entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : undefined)
  ];
  const allocationTotalHours = entry.crewAllocations?.reduce((total, allocation) => total + allocation.hours, 0) ?? 0;

  if (!entry.crewAllocations?.length) {
    return [
      [
        ...baseRow,
        "unassigned",
        "Unassigned",
        "",
        "",
        "",
        formatCsvNumber(entry.hours),
        "100.00",
        formatCsvNumber(entry.quantityCompleted),
        formatCsvNumber(entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : undefined),
        entry.savedByUserId ?? "",
        entry.savedByName ?? "",
        entry.savedAt ?? ""
      ]
    ];
  }

  return entry.crewAllocations.map((allocation) => {
    const hourShare = allocationTotalHours > 0 ? allocation.hours / allocationTotalHours : 0;
    const proratedQuantity = entry.quantityCompleted * hourShare;

    return [
      ...baseRow,
      allocation.crewMemberId,
      allocation.crewMemberName,
      allocation.jobTitle,
      formatCrewLaborType(getCrewLaborType(allocation)),
      allocation.subcontractorCompany ?? "",
      formatCsvNumber(allocation.hours),
      formatCsvNumber(hourShare * 100),
      formatCsvNumber(proratedQuantity),
      formatCsvNumber(proratedQuantity > 0 ? allocation.hours / proratedQuantity : undefined),
      entry.savedByUserId ?? "",
      entry.savedByName ?? "",
      entry.savedAt ?? ""
    ];
  });
}

function formatCsvNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return String(Math.round(value * 1000000) / 1000000);
}

function formatCsvIdentifier(value: string) {
  if (/^\d{12,}$/.test(value)) {
    return `\t${value}`;
  }

  return value;
}

function escapeCsvCell(value: string) {
  const safeValue = value.trimStart().match(/^[=+\-@]/) ? `'${value}` : value;

  if (/[",\r\n\t]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  return safeValue;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildDailyReportUploadFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";

  return `${date}_${sanitizeDailyReportFileName(projectNumber)}_Daily_Report.pdf`;
}

function sanitizeDailyReportFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.focus();
}
