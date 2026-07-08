"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Info,
  KeyRound,
  ListChecks,
  LogOut,
  PlugZap,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { todayInputValue } from "@/lib/date";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/procore/types";

const PROCORE_SYNC_REQUEST_TIMEOUT_MS = 55_000;

type ProjectsResponse = {
  projects: Project[];
  syncedAt?: string | null;
  summary?: ProcoreSyncSummary;
  error?: string;
};

type DailyReportUploadResponse = {
  fileName?: string;
  folderPath?: string;
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
  remainingNewProjects?: number;
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
  projectBlacklistById: ProjectBlacklistById;
  syncLog: SyncLogEntry[];
};

type EntriesResponse = {
  databaseConfigured?: boolean;
  entries?: AllocationEntry[];
  error?: string;
};

type CrewDataResponse = {
  crewDirectory?: CrewMember[];
  crewMembersByProject?: CrewMembersByProject;
  databaseConfigured?: boolean;
  error?: string;
};

type DailyReportsResponse = {
  dailyReportUploadsByKey?: DailyReportUploadsByKey;
  dailyReportsByKey?: DailyReportsByKey;
  databaseConfigured?: boolean;
  error?: string;
};

type DayRecordsResponse = {
  dayEntryNotesByKey?: DayEntryNotesByKey;
  daySubmissions?: DaySubmissionsByKey;
  databaseConfigured?: boolean;
  error?: string;
};

type ProjectControlsResponse = {
  myJobsByUser?: MyJobsByUser;
  projectBlacklistById?: ProjectBlacklistById;
  syncLog?: SyncLogEntry[];
  databaseConfigured?: boolean;
  error?: string;
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
  password: string;
  role: AuthUser["role"];
  userId: string;
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
};

type CrewMembersByProject = Record<string, CrewMember[]>;

type CrewSummaryRow = {
  crewMemberId: string;
  name: string;
  jobTitle: string;
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
};

type DailyReportEmployeeRow = {
  employeeClassification: string;
  truckNumber: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  totalHours: string;
  driver: boolean;
  passenger: boolean;
};

type DailyReportTimeField = "timeIn" | "lunchOut" | "lunchIn" | "timeOut";

type DailyReportPayItemRow = {
  payItemId: string;
  quantity: string;
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
  error?: string;
  fileName: string;
  folderPath: string;
  procoreFileId?: string;
  status?: DailyReportUploadStatus;
  uploadedAt?: string;
};

type DailyReportUploadsByKey = Record<string, DailyReportUpload>;

type DailyReportItsfmItem = {
  group: "Aboveground Equipment" | "Cabinet Equipment";
  key: string;
  label: string;
};

const DAILY_REPORT_ITSFM_ITEMS: DailyReportItsfmItem[] = [
  { group: "Aboveground Equipment", key: "cctv-1", label: "CCTV #1" },
  { group: "Aboveground Equipment", key: "cctv-2", label: "CCTV #2" },
  { group: "Aboveground Equipment", key: "cctv-3", label: "CCTV #3" },
  { group: "Aboveground Equipment", key: "cctv-4", label: "CCTV #4" },
  { group: "Aboveground Equipment", key: "cctv-5", label: "CCTV #5" },
  { group: "Aboveground Equipment", key: "cctv-6", label: "CCTV #6" },
  { group: "Aboveground Equipment", key: "preemption-unit-1", label: "#1 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "preemption-unit-2", label: "#2 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "rsu", label: "RSU" },
  { group: "Aboveground Equipment", key: "antenna", label: "Antenna" },
  { group: "Cabinet Equipment", key: "cabinet", label: "Cabinet" },
  { group: "Cabinet Equipment", key: "controller", label: "Controller" },
  { group: "Cabinet Equipment", key: "mmu", label: "MMU" },
  { group: "Cabinet Equipment", key: "biu-1", label: "BIU #1" },
  { group: "Cabinet Equipment", key: "biu-2", label: "BIU #2" },
  { group: "Cabinet Equipment", key: "detection-ccu", label: "Detection CCU" },
  { group: "Cabinet Equipment", key: "rpm", label: "RPM" },
  { group: "Cabinet Equipment", key: "ups", label: "UPS" },
  { group: "Cabinet Equipment", key: "ethernet-switch", label: "Ethernet Switch" },
  { group: "Cabinet Equipment", key: "preemption-card", label: "Preemtion Card" },
  { group: "Cabinet Equipment", key: "misc-1", label: "Misc" },
  { group: "Cabinet Equipment", key: "misc-2", label: "Misc" }
];

type MyJobsByUser = Record<string, string[]>;

type ProjectBlacklistById = Record<string, true>;

type EditingEntry = {
  entryId: string;
  hours: string;
  quantity: string;
};

type EditingCrewMember = {
  crewMemberId: string;
  name: string;
  jobTitle: string;
};

type ViewMode = "entry" | "calendar" | "reports";

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

export function TimeAllocationWorkspace() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState<ChangePasswordFormState>(() => createEmptyChangePasswordForm());
  const [changePasswordNotice, setChangePasswordNotice] = useState<{ message: string; status: "success" | "error" } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("entry");
  const [reportProjectId, setReportProjectId] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [calendarWeekStart, setCalendarWeekStart] = useState(getWeekStart(todayInputValue()));
  const [calendarProjectIds, setCalendarProjectIds] = useState<string[]>([]);
  const [calendarUseMyProjects, setCalendarUseMyProjects] = useState(true);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectBlacklistById, setProjectBlacklistById] = useState<ProjectBlacklistById>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(false);
  const [showWorkedPayItemsOnly, setShowWorkedPayItemsOnly] = useState(false);
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
  const [myJobsByUser, setMyJobsByUser] = useState<MyJobsByUser>({});
  const [crewDirectory, setCrewDirectory] = useState<CrewMember[]>([]);
  const [crewMembersByProject, setCrewMembersByProject] = useState<CrewMembersByProject>({});
  const [crewMemberName, setCrewMemberName] = useState("");
  const [crewMemberJobTitle, setCrewMemberJobTitle] = useState("");
  const [selectedExistingCrewMemberId, setSelectedExistingCrewMemberId] = useState("");
  const [mergeSourceCrewMemberId, setMergeSourceCrewMemberId] = useState("");
  const [mergeTargetCrewMemberId, setMergeTargetCrewMemberId] = useState("");
  const [draftsByPayItem, setDraftsByPayItem] = useState<DraftsByPayItem>({});
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [editingCrewMember, setEditingCrewMember] = useState<EditingCrewMember | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Mock data active");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [entryNotice, setEntryNotice] = useState("");
  const [adminUsers, setAdminUsers] = useState<ManagedAppUser[]>([]);
  const [adminUsersNotice, setAdminUsersNotice] = useState("");
  const [adminUserForm, setAdminUserForm] = useState<AdminUserFormState>(() => createEmptyAdminUserForm());
  const [editingAdminUserId, setEditingAdminUserId] = useState("");
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [savingAdminUser, setSavingAdminUser] = useState(false);
  const [syncSummary, setSyncSummary] = useState<ProcoreSyncSummary | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [appStateHydrated, setAppStateHydrated] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dayNotesSaveTimeoutsRef = useRef<Record<string, number>>({});
  const dailyReportDraftAutosaveTimeoutRef = useRef<number | null>(null);

  const projects = useMemo(
    () => allProjects.filter((project) => !projectBlacklistById[project.id]),
    [allProjects, projectBlacklistById]
  );
  const visibleProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const reportEntries = entries.filter((entry) => visibleProjectIds.has(entry.projectId));

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.projectId === selectedProject?.id && entry.date === workDate),
    [entries, selectedProject?.id, workDate]
  );
  const workedPayItemCount = selectedProject
    ? selectedProject.payItems.filter((payItem) => payItemHasWork(payItem.id, draftsByPayItem, visibleEntries)).length
    : 0;
  const displayedPayItems = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    if (!showWorkedPayItemsOnly) {
      return selectedProject.payItems;
    }

    return selectedProject.payItems.filter((payItem) => payItemHasWork(payItem.id, draftsByPayItem, visibleEntries));
  }, [draftsByPayItem, selectedProject, showWorkedPayItemsOnly, visibleEntries]);
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
  const currentDailyReportProcoreStatus = getDailyReportProcoreStatus(currentDailyReport, currentDailyReportUpload);
  const previousDailyReportCrewTime = useMemo(
    () => (selectedProject ? findPreviousDailyReportWithCrewTime(dailyReportsByKey, selectedProject.id, workDate) : null),
    [dailyReportsByKey, selectedProject, workDate]
  );
  const previousDailyReportWorkRows = useMemo(
    () => (selectedProject ? findPreviousDailyReportWithWorkRows(dailyReportsByKey, selectedProject.id, workDate) : null),
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
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
  const currentUserMyJobIds = useMemo(
    () => (currentUser ? (myJobsByUser[currentUser.id] ?? []).filter((projectId) => visibleProjectIds.has(projectId)) : []),
    [currentUser, myJobsByUser, visibleProjectIds]
  );
  const myProjectIdSet = useMemo(() => new Set(currentUserMyJobIds), [currentUserMyJobIds]);
  const jobPickerProjects = useMemo(
    () =>
      showOnlyMyProjects && currentUserMyJobIds.length > 0
        ? projects.filter((project) => myProjectIdSet.has(project.id))
        : projects,
    [currentUserMyJobIds.length, myProjectIdSet, projects, showOnlyMyProjects]
  );
  const totalHours = visibleEntries.reduce((total, entry) => total + entry.hours, 0);
  const draftEntryCount = selectedProject
    ? selectedProject.payItems.filter((item) => draftIsSaveable(draftsByPayItem[item.id])).length
    : 0;
  const hasUnsavedPayItemDrafts = Object.values(draftsByPayItem).some(draftHasAnyInput);
  const hasUnsavedChanges =
    hasUnsavedPayItemDrafts || Boolean(editingEntry) || Boolean(editingCrewMember) || dailyReportModalOpen;

  function confirmDiscardUnsavedChanges(actionDescription: string) {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      `You have unsaved changes. Continue to ${actionDescription}? Unsaved pay item inputs or daily report edits will be discarded.`
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
    setSelectedExistingCrewMemberId("");
    setDraftsByPayItem({});
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
    setDraftsByPayItem({});
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
      const data = (await response.json()) as AuthResponse;

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
        const data = (await response.json()) as ProcoreStatusResponse;

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
        const data = (await response.json()) as ProjectsResponse;

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
        setConnectionStatus(data.syncedAt ? "Cached Procore data loaded" : "No cached Procore data");
      } catch (error) {
        setProjectLoadError(error instanceof Error ? error.message : "Unable to load projects.");
      }
    }

    void loadProcoreConnectionStatus();
    void loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void loadAdminUsers();
      return;
    }

    setAdminUsers([]);
    setAdminUsersNotice("");
    setAdminUserForm(createEmptyAdminUserForm());
    setEditingAdminUserId("");
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
      const nextPayItemUnitOfMeasure = entry.payItemUnitOfMeasure ?? payItemSnapshot?.unitOfMeasure.toUpperCase();

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

  useEffect(
    () => () => {
      for (const timeoutId of Object.values(dayNotesSaveTimeoutsRef.current)) {
        window.clearTimeout(timeoutId);
      }
      dayNotesSaveTimeoutsRef.current = {};
    },
    []
  );

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
    const data = (await response.json()) as AuthResponse;

    if (!response.ok || !data.user) {
      setLoginError(data.error ?? "Unable to sign in.");
      return;
    }

    setCurrentUser(data.user);
    setLoginPassword("");
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
    setProjectBlacklistById({});
    setCrewDirectory([]);
    setCrewMembersByProject({});
    setSelectedExistingCrewMemberId("");
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId("");
    setEditingCrewMember(null);
    setViewMode("entry");
  }

  async function loadAdminUsers() {
    setLoadingAdminUsers(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store"
      });
      const data = (await response.json()) as AdminUsersResponse;

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
          password: password || undefined,
          role: adminUserForm.role,
          userId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await response.json()) as AdminUsersResponse & { ok?: boolean };

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
          role: user.role,
          userId: user.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await response.json()) as AdminUsersResponse & { ok?: boolean };

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
      const data = (await response.json()) as ChangePasswordResponse;

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
    const uniqueJobIds = Array.from(new Set(jobIds)).filter((jobId) => availableProjectIds.has(jobId));

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

  function updateDayEntryNotes(field: keyof DayEntryNotes, value: string) {
    if (!selectedProject || dayIsSubmitted) {
      return;
    }

    const dayKey = getDayKey(selectedProject.id, workDate);
    const nextNotes = {
      notes: currentDayEntryNotes.notes,
      inventory: currentDayEntryNotes.inventory,
      [field]: value
    };

    setDayEntryNotesByKey((current) => ({
      ...current,
      [dayKey]: nextNotes
    }));
    scheduleDatabaseDayNotesSave(selectedProject.id, workDate, nextNotes);
  }

  function scheduleDatabaseDayNotesSave(projectId: string, date: string, dayEntryNotes: DayEntryNotes) {
    const dayKey = getDayKey(projectId, date);
    const existingTimeout = dayNotesSaveTimeoutsRef.current[dayKey];

    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    dayNotesSaveTimeoutsRef.current[dayKey] = window.setTimeout(() => {
      delete dayNotesSaveTimeoutsRef.current[dayKey];
      void saveDatabaseDayNotes(projectId, date, dayEntryNotes).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Notes saved locally, but did not sync.");
      });
    }, 500);
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
            employeeRows: buildDailyReportEmployeeRowsFromEntries(visibleEntries, selectedProjectCrewMembers),
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

  function copyPreviousDailyReportWorkRows() {
    if (!previousDailyReportWorkRows) {
      setDailyReportDraftNotice("No previous Work Performed rows found for this job.");
      return;
    }

    const currentHasWorkRows = dailyReportDraft.payItemRows.some(dailyReportPayItemRowHasContent);

    if (
      currentHasWorkRows &&
      !window.confirm(`Replace current Work Performed rows with rows from ${formatDate(previousDailyReportWorkRows.date)}?`)
    ) {
      return;
    }

    setDailyReportDraft((current) => ({
      ...current,
      payItemRows: normalizeDailyReportPayItemRows(previousDailyReportWorkRows.report.payItemRows)
    }));
    setDailyReportDraftNotice(`Copied Work Performed rows from ${formatDate(previousDailyReportWorkRows.date)}.`);
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
      const data = (await response.json()) as DailyReportUploadResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to upload daily report to Procore.");
      }

      const dailyReportUpload: DailyReportUpload = {
        fileName: data.fileName ?? "daily report",
        folderPath: data.folderPath ?? "Daily Reports",
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
        `Uploaded ${data.fileName ?? "daily report"} to ${data.folderPath ?? "Procore Documents"}.`,
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

  function connectProcore(intent: PendingProcoreReturn["intent"] = "connect") {
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
    setSelectedExistingCrewMemberId("");
    setEditingCrewMember(null);
    setEntryNotice(`${name} added to ${selectedProject.name}.`);
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
      setEntryNotice(`${crewMember.name} is already saved to this job.`);
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
    setEntryNotice(`${crewMember.name} added to ${selectedProject.name}.`);
  }

  function startEditingCrewMember(member: CrewMember) {
    setEntryNotice("");
    setEditingCrewMember({
      crewMemberId: member.id,
      name: member.name,
      jobTitle: member.jobTitle
    });
  }

  function saveEditedCrewMember() {
    if (!selectedProject || !editingCrewMember) {
      return;
    }

    const name = editingCrewMember.name.trim();
    const jobTitle = editingCrewMember.jobTitle.trim();

    if (!name || !jobTitle) {
      setEntryNotice("Enter both crew member name and job title.");
      return;
    }

    const matchingCrewMember = crewDirectory.find(
      (member) =>
        member.id !== editingCrewMember.crewMemberId && normalizeCrewName(member.name) === normalizeCrewName(name)
    );

    if (matchingCrewMember) {
      setEntryNotice(`A crew member named ${matchingCrewMember.name} already exists. Use that existing crew member instead.`);
      return;
    }

    setCrewDirectory((current) =>
      sortCrewMembersByName(
        current.map((member) =>
          member.id === editingCrewMember.crewMemberId
            ? {
                ...member,
                name,
                jobTitle
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
                    name,
                    jobTitle
                  }
                : member
            )
          )
        ])
      ) as CrewMembersByProject
    );
    const updatedCrewMember = {
      id: editingCrewMember.crewMemberId,
      name,
      jobTitle
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
          jobTitle
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
      `Merge ${sourceCrewMember.name} into ${targetCrewMember.name}? This updates saved entries, reports, project crew lists, and draft allocations.`
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
    setEntryNotice(`${sourceCrewMember.name} merged into ${targetCrewMember.name}.`);
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
        [payItemId]: {
          ...draft,
          crewHours: {
            ...draft.crewHours,
            [crewMemberId]: value
          }
        }
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
    const syncLogEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry
    };

    setSyncLog((current) =>
      [syncLogEntry, ...current].slice(0, 25)
    );
    void saveDatabaseSyncLogEntry(syncLogEntry).catch((error) => {
      setProjectLoadError(error instanceof Error ? error.message : "Sync log saved locally, but did not sync.");
    });
  }

  async function syncProcoreData() {
    setSyncing(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/procore/sync",
        "Sync New Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync Procore data.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const visibleSyncedProjects = filterProjectsByBlacklist(sortedProjects, projectBlacklistById);
      setAllProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        visibleSyncedProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : visibleSyncedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(data.summary ?? null);
      const message = buildSyncStatus("New project sync", data.summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync New Projects",
        status: hasSyncWarnings(data.summary) ? "warning" : "success",
        message,
        summary: data.summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync Procore data.";
      setProjectLoadError(message);
      setConnectionStatus("Procore sync failed");
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
    setSyncingAll(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/procore/sync-all",
        "Sync All Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync all Procore projects.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const visibleSyncedProjects = filterProjectsByBlacklist(sortedProjects, projectBlacklistById);
      setAllProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        visibleSyncedProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : visibleSyncedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(data.summary ?? null);
      const message = buildSyncStatus("Full sync", data.summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync All Projects",
        status: hasSyncWarnings(data.summary) ? "warning" : "success",
        message,
        summary: data.summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync all Procore projects.";
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
    const projectId = window.prompt("Enter the Procore project ID to add or update.", selectedProjectId);
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
      const data = (await response.json()) as ProjectsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add or update project.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      const visibleSyncedProjects = filterProjectsByBlacklist(sortedProjects, projectBlacklistById);
      setAllProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        visibleSyncedProjects.some((project) => project.id === trimmedProjectId) ? trimmedProjectId : currentProjectId
      );
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
    if (!selectedProject || !currentUser || dayIsSubmitted) {
      return;
    }

    if (!(await ensureEntriesAreCurrent(selectedProject.id, workDate))) {
      return;
    }

    const incompleteCount = selectedProject.payItems.filter((payItem) =>
      draftIsIncomplete(draftsByPayItem[payItem.id])
    ).length;

    if (incompleteCount > 0) {
      setEntryNotice("Enter both hours and quantity before saving a row.");
      return;
    }

    const crewAllocationError = selectedProject.payItems
      .map((payItem) => getCrewAllocationError(draftsByPayItem[payItem.id], selectedProjectCrewMembers))
      .find(Boolean);

    if (crewAllocationError) {
      setEntryNotice(crewAllocationError);
      return;
    }

    const nextEntries = selectedProject.payItems.flatMap((payItem) => {
      const draft = draftsByPayItem[payItem.id];
      const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItem.id);

      if (!draftIsSaveable(draft)) {
        return [];
      }

      const hours = draft?.hours ? Number(draft.hours) : existingEntry?.hours ?? 0;
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
          payItemUnitOfMeasure: existingEntry?.payItemUnitOfMeasure ?? payItem.unitOfMeasure.toUpperCase(),
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
    void saveDatabaseEntries(nextEntries).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Rows saved locally, but did not sync to the database.");
    });
    setDraftsByPayItem({});
    setEntryNotice(`${nextEntries.length} row${nextEntries.length === 1 ? "" : "s"} saved for ${formatDate(workDate)}.`);
  }

  function clearDraftInputs() {
    setDraftsByPayItem({});
    setEntryNotice("Draft inputs cleared.");
  }

  async function removeEntry(entryId: string) {
    if (dayIsSubmitted) {
      return;
    }

    const entryToRemove = entries.find((entry) => entry.id === entryId);

    if (!entryToRemove || !(await ensureEntriesAreCurrent(entryToRemove.projectId, entryToRemove.date))) {
      return;
    }

    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    void deleteDatabaseEntry(entryId).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Entry deleted locally, but did not sync to the database.");
    });
  }

  async function deleteSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject) {
      return;
    }

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
    void deleteDatabaseDayEntries(selectedProject.id, workDate).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but entries did not sync.");
    });
    setDaySubmissions((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
    void deleteDatabaseDaySubmission(selectedProject.id, workDate).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but day status did not sync.");
    });
    setEditingEntry(null);
    setDraftsByPayItem({});
  }

  function startEditingEntry(entry: AllocationEntry) {
    setEditingEntry({
      entryId: entry.id,
      hours: String(entry.hours),
      quantity: String(entry.quantityCompleted)
    });
  }

  async function saveEditedEntry() {
    if (!editingEntry || dayIsSubmitted || !currentUser) {
      return;
    }

    const entryToEdit = entries.find((entry) => entry.id === editingEntry.entryId);

    if (!entryToEdit || !(await ensureEntriesAreCurrent(entryToEdit.projectId, entryToEdit.date))) {
      return;
    }

    const hours = Number(editingEntry.hours);
    const quantity = Number(editingEntry.quantity);

    if (hours < 0 || quantity < 0 || !Number.isFinite(hours) || !Number.isFinite(quantity)) {
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
      void saveDatabaseEntries([updatedEntry]).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Daily allocation updated locally, but did not sync.");
      });
    }
    setEditingEntry(null);
    setEntryNotice("Daily allocation row updated.");
  }

  async function submitDay() {
    if (!selectedProject || !currentUser || visibleEntries.length === 0) {
      return;
    }

    if (
      !(await ensureEntriesAreCurrent(selectedProject.id, workDate)) ||
      !(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))
    ) {
      return;
    }

    if (!window.confirm(`Submit ${selectedProject.name} for ${formatDate(workDate)}? This will lock the day for standard edits.`)) {
      return;
    }

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
    void saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Day submitted locally, but did not sync.");
    });
    setEditingEntry(null);
    setDraftsByPayItem({});
    setEntryNotice("Day submitted.");
  }

  async function reopenSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject || !dayIsSubmitted) {
      return;
    }

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
    void saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Submitted day reopened locally, but did not sync.");
    });
    setEntryNotice("Submitted day reopened.");
  }

  if (!authChecked) {
    return (
      <main className="app-shell centered-shell">
        <div className="panel auth-panel">
          <h1>Crew Time Allocation</h1>
          <p className="field-note">Checking session...</p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="app-shell centered-shell">
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
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <Image
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
        <div className="header-actions">
          <span className="user-chip">
            {formatUserName(currentUser)} - {formatRole(currentUser.role)}
          </span>
          <a
            className="secondary-button training-link"
            href="https://fdot-field-app.streamlit.app/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={16} />
            FDOT Pay Items
          </a>
          <IconLabel icon={CheckCircle2} text={connectionStatus} />
          {currentUser.role === "project_manager" || currentUser.role === "admin" ? (
            <>
              {currentUser.role === "admin" ? (
                <>
                  <button className="secondary-button" disabled={syncing} onClick={syncProcoreData} type="button">
                    <RefreshCw aria-hidden="true" size={18} />
                    {syncing ? "Syncing..." : "Sync New Projects"}
                  </button>
                  <button className="secondary-button" disabled={syncingAll} onClick={syncAllProcoreData} type="button">
                    <RefreshCw aria-hidden="true" size={18} />
                    {syncingAll ? "Syncing All..." : "Sync All Projects"}
                  </button>
                  <button className="secondary-button" disabled={entries.length === 0} onClick={exportAllEntryDetails} type="button">
                    <Download aria-hidden="true" size={18} />
                    Export CSV
                  </button>
                  <button className="primary-button" onClick={() => connectProcore("connect")} type="button">
                    <PlugZap aria-hidden="true" size={18} />
                    Configure Procore Upload
                  </button>
                </>
              ) : null}
              <button
                className="secondary-button"
                disabled={updatingProject}
                onClick={addOrUpdateProject}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={18} />
                {updatingProject ? "Updating..." : "Add/Update Project"}
              </button>
            </>
          ) : null}
          <button className="secondary-button" onClick={() => setChangePasswordOpen(true)} type="button">
            <KeyRound aria-hidden="true" size={18} />
            Change Password
          </button>
          <button className="secondary-button" onClick={logout} type="button">
            <LogOut aria-hidden="true" size={18} />
            Sign out
          </button>
        </div>
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

      <div className="workspace">
        <aside className="panel">
          <div className="view-tabs" aria-label="View">
            <button
              className={viewMode === "entry" ? "tab-button active" : "tab-button"}
              onClick={() => changeViewMode("entry")}
              type="button"
            >
              Entry
            </button>
            <button
              className={viewMode === "calendar" ? "tab-button active" : "tab-button"}
              onClick={() => changeViewMode("calendar")}
              type="button"
            >
              <CalendarDays aria-hidden="true" size={16} />
              Calendar
            </button>
            {currentUser.role === "project_manager" || currentUser.role === "admin" ? (
              <button
                className={viewMode === "reports" ? "tab-button active" : "tab-button"}
                onClick={() => changeViewMode("reports")}
                type="button"
              >
                <BarChart3 aria-hidden="true" size={16} />
                Reports
              </button>
            ) : null}
          </div>
          <h2>Job Setup</h2>
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
          {myProjectsEditorOpen ? (
            <MyJobsManager
              description="Tag projects you work on so they are easier to find in entry and calendar views."
              myJobIds={currentUserMyJobIds}
              projects={projects}
              setMyJobIds={setCurrentUserMyJobIds}
              title="My Projects"
            />
          ) : null}
          {projects.length === 0 && !projectLoadError ? (
            <div className="empty-state">
              {allProjects.length > 0
                ? "All cached projects are currently blacklisted."
                : "No projects with pay items returned from Procore."}
            </div>
          ) : null}
          {projectLoadError ? <div className="inline-alert">{projectLoadError}</div> : null}
          {syncSummary ? <SyncSummaryCard summary={syncSummary} /> : null}
          {syncedAt ? (
            <div className="field-note">Last synced {new Date(syncedAt).toLocaleString()}</div>
          ) : (
            <div className="field-note">Use Sync New Projects to load uncached jobs and pay items.</div>
          )}
          {currentUser.role === "admin" ? <SyncLogPanel entries={syncLog} /> : null}
          {currentUser.role === "admin" ? (
            <ProjectBlacklistPanel
              onToggleProject={toggleProjectBlacklist}
              projectBlacklistById={projectBlacklistById}
              projects={allProjects}
            />
          ) : null}
          {currentUser.role === "admin" ? (
            <AdminUsersPanel
              currentUserId={currentUser.id}
              editingUserId={editingAdminUserId}
              form={adminUserForm}
              loading={loadingAdminUsers}
              notice={adminUsersNotice}
              onCancelEdit={resetAdminUserForm}
              onEditUser={startEditingAdminUser}
              onRefresh={loadAdminUsers}
              onSaveUser={saveAdminUser}
              onSetUserActive={setAdminUserActive}
              onUpdateForm={updateAdminUserForm}
              saving={savingAdminUser}
              users={adminUsers}
            />
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

          <div className={dayIsSubmitted ? "status-card submitted" : "status-card"}>
            <strong>{dayIsSubmitted ? "Submitted" : "Draft"}</strong>
            {dayIsSubmitted && currentDaySubmission.submittedByName && currentDaySubmission.submittedAt ? (
              <span>
                Submitted by {currentDaySubmission.submittedByName} on {formatDate(currentDaySubmission.submittedAt)}
              </span>
            ) : (
              <span>Entries can be edited until the day is submitted.</span>
            )}
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
                          {member.name} - {member.jobTitle}
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
                <div className="field-note">Create a new crew member only if they are not already in the existing crew list.</div>
                {entryNotice && entryNoticeIsCrewRelated(entryNotice) ? (
                  <div className={entryNoticeIsError(entryNotice) ? "inline-alert" : "success-alert"}>{entryNotice}</div>
                ) : null}
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
                <div className="crew-list">
                  {selectedProjectCrewMembers.length === 0 ? (
                    <div className="empty-state">No crew members saved to this job.</div>
                  ) : (
                    selectedProjectCrewMembers.map((member) => {
                      const memberIsUsed = selectedProject
                        ? crewMemberHasSavedAllocations(member.id, selectedProject.id, entries)
                        : false;

                      return (
                        <div className="crew-list-row" key={member.id}>
                          {editingCrewMember?.crewMemberId === member.id ? (
                            <div className="crew-edit-form">
                              <input
                                aria-label={`Edit name for ${member.name}`}
                                value={editingCrewMember.name}
                                onChange={(event) =>
                                  setEditingCrewMember((current) =>
                                    current ? { ...current, name: event.target.value } : current
                                  )
                                }
                              />
                              <input
                                aria-label={`Edit job title for ${member.name}`}
                                value={editingCrewMember.jobTitle}
                                onChange={(event) =>
                                  setEditingCrewMember((current) =>
                                    current ? { ...current, jobTitle: event.target.value } : current
                                  )
                                }
                              />
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
                                <strong>{member.name}</strong>
                                {member.jobTitle}
                              </span>
                              <div className="crew-row-actions">
                                <button
                                  aria-label={`Edit ${member.name}`}
                                  className="icon-button"
                                  onClick={() => startEditingCrewMember(member)}
                                  type="button"
                                >
                                  <Edit3 aria-hidden="true" size={16} />
                                </button>
                                <button
                                  aria-label={`Remove ${member.name}`}
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
                            {member.name} - {member.jobTitle}
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
                            {member.name} - {member.jobTitle}
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
        </aside>

        {viewMode === "entry" ? (
          <section className="allocation-grid entry-allocation-grid">
            <div className="summary-strip">
              <div className="metric">
                <span>Selected Job</span>
                <strong>{selectedProject?.name ?? "No job"}</strong>
              </div>
              <div className="metric">
                <span>Total Hours For Selected Day</span>
                <strong>{totalHours.toFixed(2)}</strong>
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>Pay Item Entry</h2>
                <div className="panel-heading-actions">
                  <label className="entry-filter-toggle">
                    <input
                      checked={showWorkedPayItemsOnly}
                      disabled={!selectedProject?.payItems.length}
                      onChange={(event) => setShowWorkedPayItemsOnly(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Worked items only</span>
                    <small>
                      {workedPayItemCount}/{selectedProject?.payItems.length ?? 0}
                    </small>
                  </label>
                </div>
              </div>
              {!selectedProject?.payItems.length ? <div className="empty-state">No pay items returned for this job.</div> : null}
              {selectedProject?.payItems.length && displayedPayItems.length === 0 ? (
                <div className="empty-state">No worked pay items for this job and date yet.</div>
              ) : null}
              {selectedProject?.payItems.length && displayedPayItems.length > 0 ? (
                <div className="pay-item-matrix" role="table" aria-label="Pay item entry matrix">
                  <div className="matrix-header" role="row">
                    <span>Code</span>
                    <span>Pay Item</span>
                    <span>Budget</span>
                    <span>Saved Hrs</span>
                    <span>Saved Qty</span>
                    <span>Crew</span>
                    <span>Hours</span>
                    <span>Quantity</span>
                  </div>
                  {displayedPayItems.map((item) => {
                    const draft = draftsByPayItem[item.id];
                    const savedEntry = visibleEntries.find((entry) => entry.payItemId === item.id);
                    const rowHasWork = Boolean(savedEntry) || draftHasAnyInput(draft);

                    return (
                      <div className={rowHasWork ? "matrix-row worked-row" : "matrix-row"} key={item.id} role="row">
                        <span className="matrix-code" data-label="Code">{item.code}</span>
                        <span className="matrix-name" data-label="Pay Item">{item.name}</span>
                        <span className="matrix-budget" data-label="Budget">
                          {item.budgetedQuantity.toLocaleString()} {item.unitOfMeasure.toUpperCase()}
                        </span>
                        <span className="matrix-saved" data-label="Saved Hrs">{savedEntry ? savedEntry.hours.toFixed(2) : "-"}</span>
                        <span className="matrix-saved" data-label="Saved Qty">{savedEntry ? savedEntry.quantityCompleted.toFixed(2) : "-"}</span>
                        <CrewAllocationEditor
                          crewMembers={selectedProjectCrewMembers}
                          dayIsSubmitted={dayIsSubmitted}
                          draft={draft}
                          payItemId={item.id}
                          savedEntry={savedEntry}
                          onCrewHoursChange={updateDraftCrewHours}
                          onCrewToggle={toggleDraftCrewMember}
                          onSplitEvenly={splitDraftCrewHoursEvenly}
                        />
                        <input
                          aria-label={`Hours for ${item.code}`}
                          className="number-entry"
                          data-label="Hours"
                          disabled={dayIsSubmitted}
                          inputMode="decimal"
                          min="0"
                          placeholder="Hours"
                          step="0.25"
                          type="number"
                          value={draft?.hours ?? ""}
                          onChange={(event) => updateDraft(item.id, "hours", event.target.value)}
                          onWheel={(event) => event.currentTarget.blur()}
                        />
                        <input
                          aria-label={`Quantity for ${item.code}`}
                          className="number-entry"
                          data-label="Quantity"
                          disabled={dayIsSubmitted}
                          inputMode="decimal"
                          min="0"
                          placeholder="Quantity"
                          step="0.01"
                          type="number"
                          value={draft?.quantity ?? ""}
                          onChange={(event) => updateDraft(item.id, "quantity", event.target.value)}
                          onWheel={(event) => event.currentTarget.blur()}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {displayedPayItems.length && mobileSelectedPayItem ? (
                <MobilePayItemEntry
                  dayIsSubmitted={dayIsSubmitted}
                  draftsByPayItem={draftsByPayItem}
                  payItems={displayedPayItems}
                  savedEntries={visibleEntries}
                  selectedPayItem={mobileSelectedPayItem}
                  crewMembers={selectedProjectCrewMembers}
                  onDraftChange={updateDraft}
                  onCrewHoursChange={updateDraftCrewHours}
                  onCrewToggle={toggleDraftCrewMember}
                  onSplitEvenly={splitDraftCrewHoursEvenly}
                  onSelectedPayItemChange={setMobileSelectedPayItemId}
                />
              ) : null}
              {selectedProject?.payItems.length ? (
                <div className="matrix-footer">
                  <span className="field-note">
                    {draftEntryCount} row{draftEntryCount === 1 ? "" : "s"} ready to save
                  </span>
                  <button
                    className="secondary-button"
                    disabled={Object.keys(draftsByPayItem).length === 0 || dayIsSubmitted}
                    onClick={clearDraftInputs}
                    type="button"
                  >
                    Clear draft inputs
                  </button>
                  <button
                    className="primary-button save-button"
                    disabled={draftEntryCount === 0 || dayIsSubmitted}
                    onClick={saveAllocationEntries}
                    type="button"
                  >
                    <Save aria-hidden="true" size={18} />
                    Save entries
                  </button>
                </div>
              ) : null}
              {entryNotice ? <div className={entryNoticeIsError(entryNotice) ? "inline-alert" : "success-alert"}>{entryNotice}</div> : null}
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>{dayIsSubmitted ? "Submitted Day Summary" : "Daily Allocation"}</h2>
                {!dayIsSubmitted ? (
                  <button
                    className="primary-button"
                    disabled={visibleEntries.length === 0}
                    onClick={submitDay}
                    type="button"
                  >
                    <Send aria-hidden="true" size={18} />
                    Submit day
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
                    <button className="secondary-button" onClick={reopenSubmittedDay} type="button">
                      Reopen day
                    </button>
                    <button className="secondary-button" onClick={deleteSubmittedDay} type="button">
                      <Trash2 aria-hidden="true" size={18} />
                      Delete submitted day
                    </button>
                  </div>
                ) : null}
              </div>
              {dayIsSubmitted ? (
                <div className="submitted-day-summary">
                  <div>
                    <span>Pay Item Rows</span>
                    <strong>{visibleEntries.length}</strong>
                  </div>
                  <div>
                    <span>Total Hours</span>
                    <strong>{totalHours.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Daily Report</span>
                    <strong>{currentDailyReport ? "Saved" : "Not created"}</strong>
                  </div>
                  <div>
                    <span>Procore Upload</span>
                    <strong className={`daily-report-procore-status ${currentDailyReportProcoreStatus.className}`}>
                      {currentDailyReportProcoreStatus.label}
                    </strong>
                  </div>
                </div>
              ) : null}
              {dayIsSubmitted && visibleEntries.length > 0 ? (
                <SubmittedDayEntryTable entries={visibleEntries} />
              ) : (
                <div className="entry-list">
                  {visibleEntries.length === 0 ? (
                    <div className="empty-state">No pay item entries for this job and date.</div>
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
                            <button className="secondary-button" onClick={saveEditedEntry} type="button">
                              Save
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
                          disabled={dayIsSubmitted}
                          onClick={() => removeEntry(entry.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={17} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>Crew Hours Summary</h2>
                <IconLabel icon={Users} text={`${crewSummaryRows.length} crew member${crewSummaryRows.length === 1 ? "" : "s"}`} />
              </div>
              {crewSummaryRows.length === 0 ? (
                <div className="empty-state">No crew hours allocated for this job and date.</div>
              ) : (
                <div className="crew-summary-list">
                  {crewSummaryRows.map((row) => (
                    <div className="crew-summary-row" key={row.crewMemberId}>
                      <span>
                        <strong>{row.name}</strong>
                        {row.jobTitle}
                      </span>
                      <strong>{row.hours.toFixed(2)} hrs</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>Job Notes</h2>
              </div>
              <div className="day-note-grid">
                <div className="field-group">
                  <label htmlFor="day-notes">Notes</label>
                  <textarea
                    disabled={dayIsSubmitted || !selectedProject}
                    id="day-notes"
                    placeholder="Enter job-specific notes for this day."
                    value={currentDayEntryNotes.notes}
                    onChange={(event) => updateDayEntryNotes("notes", event.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="day-inventory">Inventory</label>
                  <textarea
                    disabled={dayIsSubmitted || !selectedProject}
                    id="day-inventory"
                    placeholder="Enter inventory notes, material usage, or deliveries."
                    value={currentDayEntryNotes.inventory}
                    onChange={(event) => updateDayEntryNotes("inventory", event.target.value)}
                  />
                </div>
              </div>
              <div className="field-note">
                Notes and inventory are saved to the selected job and date.
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>Daily Report</h2>
                <div className="panel-heading-actions">
                  <button className="primary-button" disabled={!selectedProject} onClick={openDailyReportModal} type="button">
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
                      <Download aria-hidden="true" size={18} />
                      {downloadingDailyReportPdf ? "Downloading..." : "Download PDF"}
                    </button>
                  ) : null}
                  {currentDailyReport ? (
                    <button
                      className="secondary-button"
                      disabled={!selectedProject || uploadingDailyReport}
                      onClick={uploadDailyReportToProcoreDocuments}
                      type="button"
                    >
                      <UploadCloud aria-hidden="true" size={18} />
                      {uploadingDailyReport ? "Uploading..." : "Upload to Procore"}
                    </button>
                  ) : null}
                </div>
              </div>
              {currentDailyReport ? (
                <div className="daily-report-summary">
                  <div>
                    <span>Status</span>
                    <strong>Saved</strong>
                  </div>
                  <div>
                    <span>Procore Upload</span>
                    <strong className={`daily-report-procore-status ${currentDailyReportProcoreStatus.className}`}>
                      {currentDailyReportProcoreStatus.label}
                    </strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>{new Date(currentDailyReport.updatedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Inspector Quantities</span>
                    <strong>{formatYesNoAnswer(currentDailyReport.quantitiesTurnedIn)}</strong>
                  </div>
                  <div>
                    <span>Incidents</span>
                    <strong>{formatYesNoAnswer(currentDailyReport.incidentOccurred)}</strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No daily report has been created for this job and date.</div>
              )}
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

            <div className="mobile-sticky-action-bar" aria-label="Entry actions">
              <button
                className="primary-button"
                disabled={draftEntryCount === 0 || dayIsSubmitted}
                onClick={saveAllocationEntries}
                type="button"
              >
                <Save aria-hidden="true" size={17} />
                Save
              </button>
              <button
                className="secondary-button"
                disabled={dayIsSubmitted || visibleEntries.length === 0}
                onClick={submitDay}
                type="button"
              >
                <Send aria-hidden="true" size={17} />
                Submit
              </button>
              <button className="secondary-button" disabled={!selectedProject} onClick={openDailyReportModal} type="button">
                <Edit3 aria-hidden="true" size={17} />
                Daily
              </button>
            </div>
          </section>
        ) : viewMode === "calendar" ? (
          <section className="allocation-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>Weekly Status Calendar</h2>
              </div>
              <WeeklyStatusReport
                dailyReportUploadsByKey={dailyReportUploadsByKey}
                dailyReportsByKey={dailyReportsByKey}
                daySubmissions={daySubmissions}
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
      {dailyReportModalOpen && selectedProject ? (
        <DailyReportModal
          canCopyPreviousCrewTime={Boolean(previousDailyReportCrewTime)}
          canCopyPreviousWorkRows={Boolean(previousDailyReportWorkRows)}
          canUseSavedEntries={visibleEntries.length > 0}
          date={workDate}
          draft={dailyReportDraft}
          draftNotice={dailyReportDraftNotice}
          payItems={selectedProject.payItems}
          previousCrewTimeLabel={
            previousDailyReportCrewTime ? `Copy Crew/Time from ${formatDate(previousDailyReportCrewTime.date)}` : "No Previous Crew/Time"
          }
          previousWorkRowsLabel={
            previousDailyReportWorkRows ? `Copy Rows from ${formatDate(previousDailyReportWorkRows.date)}` : "No Previous Rows"
          }
          projectName={selectedProject.name}
          onChange={updateDailyReportDraft}
          onCopyPreviousCrewTime={copyPreviousDailyReportCrewTime}
          onCopyPreviousWorkRows={copyPreviousDailyReportWorkRows}
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
          <span data-label="Crew">{formatEntryCrew(entry).replace(/^Crew: /, "")}</span>
        </div>
      ))}
    </div>
  );
}

type MobileOption = {
  value: string;
  label: string;
};

function DailyReportModal({
  canCopyPreviousCrewTime,
  canCopyPreviousWorkRows,
  canUseSavedEntries,
  date,
  draft,
  draftNotice,
  payItems,
  previousCrewTimeLabel,
  previousWorkRowsLabel,
  projectName,
  onChange,
  onCopyPreviousCrewTime,
  onCopyPreviousWorkRows,
  onCopySavedEntriesToWorkRows,
  onEmployeeChange,
  onEmployeeTimeBlur,
  onItsfmChange,
  onPayItemChange,
  onClose,
  onSave
}: {
  canCopyPreviousCrewTime: boolean;
  canCopyPreviousWorkRows: boolean;
  canUseSavedEntries: boolean;
  date: string;
  draft: DailyReportAnswers;
  draftNotice: string;
  payItems: Project["payItems"];
  previousCrewTimeLabel: string;
  previousWorkRowsLabel: string;
  projectName: string;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
  onCopyPreviousCrewTime: () => void;
  onCopyPreviousWorkRows: () => void;
  onCopySavedEntriesToWorkRows: () => void;
  onEmployeeChange: (rowIndex: number, field: keyof DailyReportEmployeeRow, value: string | boolean) => void;
  onEmployeeTimeBlur: (rowIndex: number, field: DailyReportTimeField) => void;
  onItsfmChange: (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => void;
  onPayItemChange: (rowIndex: number, field: keyof DailyReportPayItemRow, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const inspectorQuantitiesTurnedIn = draft.quantitiesTurnedIn === "yes";
  const incidentOccurred = draft.incidentOccurred === "yes";

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-panel daily-report-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <h2>Create Daily Report</h2>
            <span>
              {projectName} - {formatDate(date)}
            </span>
          </div>
          <button aria-label="Close daily report" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {draftNotice ? <div className="field-note daily-draft-notice">{draftNotice}</div> : null}

        <div className="daily-report-form">
          <section>
            <div className="daily-section-heading">
              <h3>Employee Time on Site</h3>
              <button
                className="secondary-button compact-button"
                disabled={!canCopyPreviousCrewTime}
                onClick={onCopyPreviousCrewTime}
                type="button"
              >
                <Copy aria-hidden="true" size={16} />
                {previousCrewTimeLabel}
              </button>
            </div>
            <div className="daily-labor-table" role="table" aria-label="Employee time on site">
              <div className="daily-labor-row daily-labor-header" role="row">
                <span>#</span>
                <span>Employee Name - Classification</span>
                <span>Truck #</span>
                <span>Time In</span>
                <span>Lunch Out</span>
                <span>Lunch In</span>
                <span>Time Out</span>
                <span>Total Hours</span>
                <span>Driver</span>
                <span>Passenger</span>
              </div>
              {draft.employeeRows.map((row, index) => (
                <div className="daily-labor-row" key={index} role="row">
                  <span className="daily-labor-index">{index + 1}</span>
                  <input
                    aria-label={`Employee name and classification row ${index + 1}`}
                    value={row.employeeClassification}
                    onChange={(event) => onEmployeeChange(index, "employeeClassification", event.target.value)}
                  />
                  <input
                    aria-label={`Truck number row ${index + 1}`}
                    value={row.truckNumber}
                    onChange={(event) => onEmployeeChange(index, "truckNumber", event.target.value)}
                  />
                  <input
                    aria-label={`Time in row ${index + 1}`}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="7:00"
                    value={row.timeIn}
                    onChange={(event) => onEmployeeChange(index, "timeIn", event.target.value)}
                    onBlur={() => onEmployeeTimeBlur(index, "timeIn")}
                  />
                  <input
                    aria-label={`Lunch out row ${index + 1}`}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="12:00"
                    value={row.lunchOut}
                    onChange={(event) => onEmployeeChange(index, "lunchOut", event.target.value)}
                    onBlur={() => onEmployeeTimeBlur(index, "lunchOut")}
                  />
                  <input
                    aria-label={`Lunch in row ${index + 1}`}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="12:30"
                    value={row.lunchIn}
                    onChange={(event) => onEmployeeChange(index, "lunchIn", event.target.value)}
                    onBlur={() => onEmployeeTimeBlur(index, "lunchIn")}
                  />
                  <input
                    aria-label={`Time out row ${index + 1}`}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="5:00"
                    value={row.timeOut}
                    onChange={(event) => onEmployeeChange(index, "timeOut", event.target.value)}
                    onBlur={() => onEmployeeTimeBlur(index, "timeOut")}
                  />
                  <input
                    aria-label={`Total hours row ${index + 1}`}
                    readOnly
                    tabIndex={-1}
                    value={row.totalHours}
                  />
                  <label className="daily-labor-check">
                    <input
                      checked={row.driver}
                      type="checkbox"
                      onChange={(event) => onEmployeeChange(index, "driver", event.target.checked)}
                    />
                    <span className="sr-only">Driver row {index + 1}</span>
                  </label>
                  <label className="daily-labor-check">
                    <input
                      checked={row.passenger}
                      type="checkbox"
                      onChange={(event) => onEmployeeChange(index, "passenger", event.target.checked)}
                    />
                    <span className="sr-only">Passenger row {index + 1}</span>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>Inspector / Quantities</h3>
            <div className="daily-report-grid two">
              <div className="field-group">
                <label htmlFor="daily-quantities-turned-in">Did you turn quantities into the inspector today?</label>
                <select
                  id="daily-quantities-turned-in"
                  value={draft.quantitiesTurnedIn}
                  onChange={(event) => onChange("quantitiesTurnedIn", event.target.value)}
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {inspectorQuantitiesTurnedIn ? (
                <div className="field-group">
                  <label htmlFor="daily-inspector-name">Inspector Name</label>
                  <input
                    id="daily-inspector-name"
                    value={draft.inspectorName}
                    onChange={(event) => onChange("inspectorName", event.target.value)}
                  />
                </div>
              ) : null}
            </div>
            {inspectorQuantitiesTurnedIn ? (
              <div className="field-group">
                <label htmlFor="daily-inspector-quantity-details">Quantities and items turned into the inspector</label>
                <textarea
                  id="daily-inspector-quantity-details"
                  value={draft.inspectorQuantityDetails}
                  onChange={(event) => onChange("inspectorQuantityDetails", event.target.value)}
                />
              </div>
            ) : null}
          </section>

          <section>
            <div className="daily-section-heading">
              <h3>Work Performed</h3>
              <div className="daily-section-actions">
                <button
                  className="secondary-button compact-button"
                  disabled={!canUseSavedEntries}
                  onClick={onCopySavedEntriesToWorkRows}
                  type="button"
                >
                  <Copy aria-hidden="true" size={16} />
                  Use Saved Entries
                </button>
                <button
                  className="secondary-button compact-button"
                  disabled={!canCopyPreviousWorkRows}
                  onClick={onCopyPreviousWorkRows}
                  type="button"
                >
                  <Copy aria-hidden="true" size={16} />
                  {previousWorkRowsLabel}
                </button>
              </div>
            </div>
            <div className="daily-pay-item-table" role="table" aria-label="Daily report pay item quantities">
              <div className="daily-pay-item-row daily-pay-item-header" role="row">
                <span>#</span>
                <span>Pay Item # / Description</span>
                <span>Quantity</span>
              </div>
              {draft.payItemRows.map((row, index) => {
                const selectedPayItem = payItems.find((payItem) => payItem.id === row.payItemId);

                return (
                  <div className="daily-pay-item-row" key={index} role="row">
                    <span className="daily-labor-index">{index + 1}</span>
                    <select
                      aria-label={`Pay item row ${index + 1}`}
                      value={row.payItemId}
                      onChange={(event) => onPayItemChange(index, "payItemId", event.target.value)}
                    >
                      <option value="">Select pay item</option>
                      {payItems.map((payItem) => (
                        <option key={payItem.id} value={payItem.id}>
                          {payItem.code} - {payItem.name}
                        </option>
                      ))}
                    </select>
                    <div className="daily-pay-item-quantity">
                      <input
                        aria-label={`Quantity row ${index + 1}`}
                        inputMode="decimal"
                        min="0"
                        type="number"
                        value={row.quantity}
                        onChange={(event) => onPayItemChange(index, "quantity", event.target.value)}
                        onWheel={(event) => event.currentTarget.blur()}
                      />
                      <span>{selectedPayItem?.unitOfMeasure.toUpperCase() ?? ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="daily-report-grid two">
              <div className="field-group">
                <label htmlFor="daily-work-description">Description of Work Provided</label>
                <textarea
                  id="daily-work-description"
                  value={draft.workDescription}
                  onChange={(event) => onChange("workDescription", event.target.value)}
                />
              </div>
              <div className="field-group">
                <label htmlFor="daily-plan-sheets">Plan Sheet Numbers</label>
                <textarea
                  id="daily-plan-sheets"
                  value={draft.planSheetNumbers}
                  onChange={(event) => onChange("planSheetNumbers", event.target.value)}
                />
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="daily-work-details">
                Details of work performed today, including station number, corner, area, and partial items
              </label>
              <textarea
                id="daily-work-details"
                value={draft.workDetails}
                onChange={(event) => onChange("workDetails", event.target.value)}
              />
            </div>
          </section>

          <section>
            <h3>Incidents / Accidents</h3>
            <div className="daily-report-grid two">
              <div className="field-group">
                <label htmlFor="daily-incident-occurred">Were there any incidents or accidents today?</label>
                <select
                  id="daily-incident-occurred"
                  value={draft.incidentOccurred}
                  onChange={(event) => onChange("incidentOccurred", event.target.value)}
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {incidentOccurred ? (
                <div className="field-group">
                  <label htmlFor="daily-accident-report-filed">Accident report filed?</label>
                  <select
                    id="daily-accident-report-filed"
                    value={draft.accidentReportFiled}
                    onChange={(event) => onChange("accidentReportFiled", event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              ) : null}
            </div>
            {incidentOccurred ? (
              <div className="field-group">
                <label htmlFor="daily-incident-details">Incident / Accident Details</label>
                <textarea
                  id="daily-incident-details"
                  value={draft.incidentDetails}
                  onChange={(event) => onChange("incidentDetails", event.target.value)}
                />
              </div>
            ) : null}
          </section>

          <section>
            <h3>MOT Quantities</h3>
            <div className="daily-report-grid four">
              <DailyReportNumberField field="motSigns" label="Total MOT Signs" onChange={onChange} value={draft.motSigns} />
              <DailyReportNumberField field="conesBarrels" label="Cones / Barrels" onChange={onChange} value={draft.conesBarrels} />
              <DailyReportNumberField
                field="typeIISidewalkBarricades"
                label="Type II Sidewalk Closed Barricades / Signs"
                onChange={onChange}
                value={draft.typeIISidewalkBarricades}
              />
              <DailyReportNumberField
                field="typeIIIBarricades"
                label="Type III Barricades"
                onChange={onChange}
                value={draft.typeIIIBarricades}
              />
              <DailyReportNumberField field="lcdCount" label="LCD Count" onChange={onChange} value={draft.lcdCount} />
              <DailyReportNumberField field="lcdFootage" label="LCD Total Footage" onChange={onChange} value={draft.lcdFootage} />
              <DailyReportNumberField field="arrowBoards" label="Arrow Boards" onChange={onChange} value={draft.arrowBoards} />
              <DailyReportNumberField field="vmsBoards" label="VMS Boards" onChange={onChange} value={draft.vmsBoards} />
            </div>
            <div className="field-group">
              <label htmlFor="daily-fdot-index">FDOT Index Used</label>
              <input
                id="daily-fdot-index"
                value={draft.fdotIndex}
                onChange={(event) => onChange("fdotIndex", event.target.value)}
              />
            </div>
          </section>

          <section>
            <h3>ITSFM Itemized List</h3>
            <DailyReportItsfmMatrix rows={draft.itsfmRows} onChange={onItsfmChange} />
          </section>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" onClick={onSave} type="button">
            <Save aria-hidden="true" size={18} />
            Save Daily Report
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyReportNumberField({
  field,
  label,
  onChange,
  value
}: {
  field: keyof DailyReportAnswers;
  label: string;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
  value: string;
}) {
  return (
    <div className="field-group">
      <label htmlFor={`daily-${field}`}>{label}</label>
      <input
        id={`daily-${field}`}
        inputMode="decimal"
        min="0"
        type="number"
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        onWheel={(event) => event.currentTarget.blur()}
      />
    </div>
  );
}

function DailyReportItsfmMatrix({
  rows,
  onChange
}: {
  rows: DailyReportItsfmRow[];
  onChange: (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => void;
}) {
  const rowsByKey = new Map(normalizeDailyReportItsfmRows(rows).map((row) => [row.itemKey, row]));
  const groups = Array.from(new Set(DAILY_REPORT_ITSFM_ITEMS.map((item) => item.group)));

  return (
    <div className="daily-itsfm-table" role="table" aria-label="ITSFM itemized list">
      <div className="daily-itsfm-row daily-itsfm-header" role="row">
        <span>Item</span>
        <span>Model #</span>
        <span>S/N</span>
        <span>Location</span>
      </div>
      {groups.map((group) => (
        <div className="daily-itsfm-section" key={group}>
          <div className="daily-itsfm-section-heading">{group}</div>
          {DAILY_REPORT_ITSFM_ITEMS.filter((item) => item.group === group).map((item) => {
            const row = rowsByKey.get(item.key) ?? createEmptyDailyReportItsfmRow(item.key);

            return (
              <div className="daily-itsfm-row" key={item.key} role="row">
                <span className="daily-itsfm-item-label">{item.label}</span>
                <input
                  aria-label={`${item.label} model number`}
                  value={row.modelNumber}
                  onChange={(event) => onChange(item.key, "modelNumber", event.target.value)}
                />
                <input
                  aria-label={`${item.label} serial number`}
                  value={row.serialNumber}
                  onChange={(event) => onChange(item.key, "serialNumber", event.target.value)}
                />
                <input
                  aria-label={`${item.label} location`}
                  value={row.location}
                  onChange={(event) => onChange(item.key, "location", event.target.value)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MobileOptionPicker({
  disabled = false,
  id,
  label,
  options,
  value,
  onChange
}: {
  disabled?: boolean;
  id?: string;
  label: string;
  options: MobileOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const searchInputId = `mobile-picker-search-${label.toLowerCase().replaceAll(" ", "-")}`;
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="mobile-picker">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mobile-picker-trigger"
        disabled={disabled || options.length === 0}
        id={id}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      {open ? (
        <div className="mobile-picker-overlay" onClick={closePicker}>
          <div className="mobile-picker-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-picker-heading">
              <strong>{label}</strong>
              <button aria-label={`Close ${label} picker`} className="icon-button" onClick={closePicker} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="mobile-picker-search-wrap">
              <label className="sr-only" htmlFor={searchInputId}>
                Search {label}
              </label>
              <input
                autoFocus
                className="mobile-picker-search"
                id={searchInputId}
                placeholder="Search code or description"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mobile-picker-options" role="listbox" aria-label={label}>
              {filteredOptions.length === 0 ? (
                <div className="mobile-picker-empty">No matches found.</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    aria-selected={option.value === value}
                    className={option.value === value ? "mobile-picker-option selected" : "mobile-picker-option"}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      closePicker();
                    }}
                  role="option"
                  type="button"
                >
                    <span>{option.label}</span>
                </button>
              ))
            )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CrewAllocationEditor({
  crewMembers,
  dayIsSubmitted,
  draft,
  payItemId,
  savedEntry,
  onCrewHoursChange,
  onCrewToggle,
  onSplitEvenly
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draft: PayItemDraft | undefined;
  payItemId: string;
  savedEntry: AllocationEntry | undefined;
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onSplitEvenly: (payItemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCrewMemberIds = getSelectedCrewMemberIds(draft, savedEntry);
  const selectedCrewHours = getSelectedCrewHours(draft, savedEntry);
  const selectedCrewMembers = getSelectedCrewMembers(selectedCrewMemberIds, crewMembers, savedEntry);
  const allocationTotal = selectedCrewMemberIds.reduce(
    (total, crewMemberId) => total + Number(selectedCrewHours[crewMemberId] || 0),
    0
  );
  const summaryText =
    selectedCrewMembers.length === 0
      ? "Select crew"
      : selectedCrewMembers.length === 1
        ? selectedCrewMembers[0].name
        : `${selectedCrewMembers.length} selected`;

  return (
    <details className="crew-allocator" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <Users aria-hidden="true" size={15} />
        <span>{summaryText}</span>
      </summary>
      <div className="crew-allocator-body">
        {crewMembers.length === 0 ? (
          <div className="field-note">Add crew members to this job before allocating hours.</div>
        ) : (
          <div className="crew-checkbox-list">
            {crewMembers.map((member) => (
              <label className="crew-checkbox" key={member.id}>
                <input
                  checked={selectedCrewMemberIds.includes(member.id)}
                  disabled={dayIsSubmitted}
                  type="checkbox"
                  onChange={(event) => onCrewToggle(payItemId, member.id, event.target.checked)}
                />
                <span>
                  <strong>{member.name}</strong>
                  {member.jobTitle}
                </span>
              </label>
            ))}
          </div>
        )}

        {selectedCrewMembers.length > 0 ? (
          <div className="crew-hour-editor">
            <div className="crew-hour-editor-heading">
              <span>Allocated Hours</span>
              <button
                className="text-button"
                disabled={dayIsSubmitted}
                onClick={() => onSplitEvenly(payItemId)}
                type="button"
              >
                Split evenly
              </button>
            </div>
            {selectedCrewMembers.map((member) => (
              <label className="crew-hour-row" key={member.id}>
                <span>{member.name}</span>
                <input
                  aria-label={`Allocated hours for ${member.name}`}
                  className="number-entry"
                  disabled={dayIsSubmitted}
                  inputMode="decimal"
                  min="0"
                  step="0.25"
                  type="number"
                  value={selectedCrewHours[member.id] ?? ""}
                  onChange={(event) => onCrewHoursChange(payItemId, member.id, event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                />
              </label>
            ))}
            <div className="crew-allocation-total">Total allocated: {allocationTotal.toFixed(2)} hrs</div>
          </div>
        ) : null}
        <div className="crew-allocator-actions">
          <button className="secondary-button" onClick={() => setOpen(false)} type="button">
            OK
          </button>
        </div>
      </div>
    </details>
  );
}

function MobilePayItemEntry({
  crewMembers,
  dayIsSubmitted,
  draftsByPayItem,
  payItems,
  savedEntries,
  selectedPayItem,
  onCrewHoursChange,
  onCrewToggle,
  onDraftChange,
  onSplitEvenly,
  onSelectedPayItemChange
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draftsByPayItem: DraftsByPayItem;
  payItems: Project["payItems"];
  savedEntries: AllocationEntry[];
  selectedPayItem: Project["payItems"][number];
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onDraftChange: (payItemId: string, field: "hours" | "quantity", value: string) => void;
  onSplitEvenly: (payItemId: string) => void;
  onSelectedPayItemChange: (payItemId: string) => void;
}) {
  const draft = draftsByPayItem[selectedPayItem.id];
  const savedEntry = savedEntries.find((entry) => entry.payItemId === selectedPayItem.id);
  const rowHasWork = Boolean(savedEntry) || draftHasAnyInput(draft);

  return (
    <div className="pay-item-mobile-entry">
      <div className="field-group">
        <label htmlFor="mobile-pay-item">Pay Item</label>
        <MobileOptionPicker
          id="mobile-pay-item"
          label="Pay Item"
          options={payItems.map((payItem) => ({
            value: payItem.id,
            label: `${payItem.code} - ${payItem.name}`
          }))}
          value={selectedPayItem.id}
          onChange={onSelectedPayItemChange}
        />
      </div>

      <div className={rowHasWork ? "mobile-pay-item-card worked-card" : "mobile-pay-item-card"}>
        <div>
          <span>Code</span>
          <strong>{selectedPayItem.code}</strong>
        </div>
        <div>
          <span>Budget</span>
          <strong>
            {selectedPayItem.budgetedQuantity.toLocaleString()} {selectedPayItem.unitOfMeasure.toUpperCase()}
          </strong>
        </div>
        <div>
          <span>Saved Hrs</span>
          <strong>{savedEntry ? savedEntry.hours.toFixed(2) : "-"}</strong>
        </div>
        <div>
          <span>Saved Qty</span>
          <strong>{savedEntry ? savedEntry.quantityCompleted.toFixed(2) : "-"}</strong>
        </div>
      </div>

      <div className="mobile-pay-item-inputs">
        <div className="field-group">
          <label htmlFor="mobile-hours">Hours</label>
          <input
            id="mobile-hours"
            aria-label={`Hours for ${selectedPayItem.code}`}
            className="number-entry"
            disabled={dayIsSubmitted}
            inputMode="decimal"
            min="0"
            placeholder="Hours"
            step="0.25"
            type="number"
            value={draft?.hours ?? ""}
            onChange={(event) => onDraftChange(selectedPayItem.id, "hours", event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </div>
        <div className="field-group">
          <label htmlFor="mobile-quantity">Quantity</label>
          <input
            id="mobile-quantity"
            aria-label={`Quantity for ${selectedPayItem.code}`}
            className="number-entry"
            disabled={dayIsSubmitted}
            inputMode="decimal"
            min="0"
            placeholder="Quantity"
            step="0.01"
            type="number"
            value={draft?.quantity ?? ""}
            onChange={(event) => onDraftChange(selectedPayItem.id, "quantity", event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </div>
      </div>
      <CrewAllocationEditor
        crewMembers={crewMembers}
        dayIsSubmitted={dayIsSubmitted}
        draft={draft}
        payItemId={selectedPayItem.id}
        savedEntry={savedEntry}
        onCrewHoursChange={onCrewHoursChange}
        onCrewToggle={onCrewToggle}
        onSplitEvenly={onSplitEvenly}
      />
    </div>
  );
}

type PayItemReportRow = {
  key: string;
  code: string;
  name: string;
  totalHours: number;
  totalQuantity: number;
  hoursPerUnit: number;
  entryCount: number;
  jobRollupRows?: PayItemJobRollupRow[];
};

type PayItemReportDetailRow = {
  id: string;
  date: string;
  payItemKey: string;
  payItemLabel: string;
  projectName: string;
  crewMemberId: string;
  crewMemberName: string;
  jobTitle: string;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
  savedByName?: string;
};

type PayItemJobRollupRow = {
  id: string;
  projectName: string;
  entryCount: number;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
};

type CrewPerformancePayItemRow = {
  id: string;
  payItemLabel: string;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
  companyHoursPerUnit: number;
  variance: number;
  entryCount: number;
  jobCount: number;
};

type CrewPerformanceRow = {
  id: string;
  crewMemberName: string;
  jobTitle: string;
  totalHours: number;
  totalQuantity: number;
  entryCount: number;
  jobCount: number;
  payItemCount: number;
  weightedVariance: number;
  status: "strong" | "average" | "review" | "limited";
  payItems: CrewPerformancePayItemRow[];
};

type ReportMode = "summary" | "detail" | "crew";
type DetailGrouping = "crew_day" | "crew_project" | "job_day";
type DetailSort = "worst_average" | "best_average" | "most_hours" | "most_quantity";

type PayItemDetailAnalysisRow = {
  id: string;
  payItemLabel: string;
  date?: string;
  projectName: string;
  crewMemberName?: string;
  jobTitle?: string;
  entryCount: number;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
};

type ReportPayItemOption = {
  key: string;
  label: string;
  query: string;
};

type ReportResponse = {
  databaseConfigured?: boolean;
  error?: string;
  filteredEntryCount?: number;
  mode?: ReportMode;
  page?: number;
  pageSize?: number;
  payItemOptions?: ReportPayItemOption[];
  rows?: Array<PayItemReportRow | PayItemDetailAnalysisRow | CrewPerformanceRow>;
  totalRows?: number;
};

function ReportsView({
  currentUser,
  entries,
  myJobIds,
  projects,
  reportProjectId,
  reportStartDate,
  reportEndDate,
  setMyJobIds,
  setReportProjectId,
  setReportStartDate,
  setReportEndDate
}: {
  currentUser: AuthUser;
  entries: AllocationEntry[];
  myJobIds: string[];
  projects: Project[];
  reportProjectId: string;
  reportStartDate: string;
  reportEndDate: string;
  setMyJobIds: (jobIds: string[]) => void;
  setReportProjectId: (projectId: string) => void;
  setReportStartDate: (date: string) => void;
  setReportEndDate: (date: string) => void;
}) {
  const [reportMode, setReportMode] = useState<ReportMode>("summary");
  const [detailPayItemQuery, setDetailPayItemQuery] = useState("");
  const [detailGrouping, setDetailGrouping] = useState<DetailGrouping>("crew_day");
  const [detailSort, setDetailSort] = useState<DetailSort>("worst_average");
  const [crewPerformanceInfoOpen, setCrewPerformanceInfoOpen] = useState(false);
  const [myJobsEditorOpen, setMyJobsEditorOpen] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportsUseServerData, setReportsUseServerData] = useState(true);
  const reportStartInputRef = useRef<HTMLInputElement>(null);
  const reportEndInputRef = useRef<HTMLInputElement>(null);
  const reportPageSize = getReportPageSize(reportMode);
  const reportProjectOptions = useMemo(() => buildReportProjectOptions(projects, entries), [entries, projects]);
  const allowedReportProjectIds = useMemo(() => reportProjectOptions.map((project) => project.id), [reportProjectOptions]);
  const canManageMyJobs = currentUser.role === "project_manager" || currentUser.role === "admin";
  const reportJobPickerOptions = [
    {
      value: "all",
      label: "All Jobs"
    },
    ...(canManageMyJobs && myJobIds.length > 0
      ? [
          {
            value: "my-jobs",
            label: `My Projects (${myJobIds.length})`
          }
        ]
      : []),
    ...reportProjectOptions.map((project) => ({
      value: project.id,
      label: project.name
    }))
  ];
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesProject =
          reportProjectId === "all" ||
          (reportProjectId === "my-jobs" ? myJobIds.includes(entry.projectId) : entry.projectId === reportProjectId);
        const matchesStart = !reportStartDate || entry.date >= reportStartDate;
        const matchesEnd = !reportEndDate || entry.date <= reportEndDate;

        return matchesProject && matchesStart && matchesEnd;
      }),
    [entries, myJobIds, reportEndDate, reportProjectId, reportStartDate]
  );
  const normalizedDetailQuery = detailPayItemQuery.trim().toLowerCase();
  const localPayItemRows = useMemo(() => buildPayItemReport(filteredEntries, projects), [filteredEntries, projects]);
  const localDetailPayItemOptions = useMemo(() => buildReportPayItemOptions(filteredEntries), [filteredEntries]);
  const localDetailRows = useMemo(
    () =>
      normalizedDetailQuery
        ? buildPayItemDetailAnalysisRows(
            filteredEntries.filter((entry) => payItemMatchesQuery(entry, normalizedDetailQuery)),
            projects,
            detailGrouping,
            detailSort
          )
        : [],
    [detailGrouping, detailSort, filteredEntries, normalizedDetailQuery, projects]
  );
  const localCrewRows = useMemo(() => buildCrewPerformanceRows(filteredEntries, projects), [filteredEntries, projects]);
  const serverReportAvailable = Boolean(reportsUseServerData && reportData?.databaseConfigured && reportData.mode === reportMode);
  const payItemRows =
    serverReportAvailable && reportMode === "summary" ? (reportData?.rows ?? []) as PayItemReportRow[] : localPayItemRows;
  const detailRows =
    serverReportAvailable && reportMode === "detail" ? (reportData?.rows ?? []) as PayItemDetailAnalysisRow[] : localDetailRows;
  const detailPayItemOptions =
    serverReportAvailable && reportMode === "detail" ? reportData?.payItemOptions ?? [] : localDetailPayItemOptions;
  const crewRows = serverReportAvailable && reportMode === "crew" ? (reportData?.rows ?? []) as CrewPerformanceRow[] : localCrewRows;
  const reportPagination = serverReportAvailable
    ? {
        page: reportData?.page ?? reportPage,
        pageSize: reportData?.pageSize ?? reportPageSize,
        totalRows: reportData?.totalRows ?? 0
      }
    : null;
  const filteredReportEntryCount = reportData?.filteredEntryCount ?? 0;

  useEffect(() => {
    setReportPage(1);
  }, [detailGrouping, detailPayItemQuery, detailSort, reportEndDate, reportMode, reportProjectId, reportStartDate]);

  useEffect(() => {
    const controller = new AbortController();

    setReportLoading(true);
    setReportError("");

    fetch("/api/reports", {
      body: JSON.stringify({
        allowedProjectIds: allowedReportProjectIds,
        detailGrouping,
        detailPayItemQuery,
        detailSort,
        endDate: reportEndDate,
        mode: reportMode,
        myJobIds,
        page: reportPage,
        pageSize: reportPageSize,
        projectId: reportProjectId,
        startDate: reportStartDate
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as ReportResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load report.");
        }

        setReportData(data);
        setReportsUseServerData(Boolean(data.databaseConfigured));
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setReportError(error instanceof Error ? error.message : "Unable to load report.");
        setReportsUseServerData(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setReportLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    allowedReportProjectIds,
    detailGrouping,
    detailPayItemQuery,
    detailSort,
    myJobIds,
    reportEndDate,
    reportMode,
    reportPage,
    reportPageSize,
    reportProjectId,
    reportStartDate
  ]);

  async function exportSummaryReportCsv() {
    if (!reportsUseServerData) {
      exportPayItemSummaryToCsv(localPayItemRows);
      return;
    }

    setReportExporting(true);
    setReportError("");

    try {
      const response = await fetch("/api/reports/export", {
        body: JSON.stringify({
          allowedProjectIds: allowedReportProjectIds,
          endDate: reportEndDate,
          mode: "summary",
          myJobIds,
          projectId: reportProjectId,
          startDate: reportStartDate
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export report CSV."));
      }

      const blob = await response.blob();
      downloadBlob(blob, `time-allocation-summary-${todayInputValue()}.csv`);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Unable to export report CSV.");
    } finally {
      setReportExporting(false);
    }
  }

  return (
    <section className="allocation-grid">
      <div className="panel">
        <div className="panel-heading">
          <h2>{getReportTitle(reportMode)}</h2>
          {reportMode === "summary" ? (
            <button className="secondary-button" disabled={reportExporting} onClick={exportSummaryReportCsv} type="button">
              <Download aria-hidden="true" size={18} />
              {reportExporting ? "Exporting..." : "Export CSV"}
            </button>
          ) : reportMode === "crew" ? (
            <button
              aria-expanded={crewPerformanceInfoOpen}
              className="icon-button"
              onClick={() => setCrewPerformanceInfoOpen((current) => !current)}
              title="Crew performance report logic"
              type="button"
            >
              <Info aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
        <div className="report-mode-tabs" aria-label="Report type">
          <button
            className={reportMode === "summary" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("summary")}
            type="button"
          >
            Summary
          </button>
          <button
            className={reportMode === "detail" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("detail")}
            type="button"
          >
            Detailed Analysis
          </button>
          <button
            className={reportMode === "crew" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("crew")}
            type="button"
          >
            Crew Performance
          </button>
        </div>
        {canManageMyJobs ? (
          <div className="report-admin-toolbar">
            <button
              aria-expanded={myJobsEditorOpen}
              className="secondary-button"
              onClick={() => setMyJobsEditorOpen((current) => !current)}
              type="button"
            >
              <ListChecks aria-hidden="true" size={18} />
              Create/Update My Projects ({myJobIds.length})
            </button>
          </div>
        ) : null}
        {myJobsEditorOpen ? (
          <MyJobsManager myJobIds={myJobIds} projects={projects} setMyJobIds={setMyJobIds} />
        ) : null}
        {reportMode === "crew" && crewPerformanceInfoOpen ? <CrewPerformanceInfo /> : null}
        <div className="report-controls">
          <div className="field-group">
            <label htmlFor="report-project">Job</label>
            <select
              className="desktop-select"
              id="report-project"
              value={reportProjectId}
              onChange={(event) => setReportProjectId(event.target.value)}
            >
              {reportJobPickerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <MobileOptionPicker
              label="Report Job"
              options={reportJobPickerOptions}
              value={reportProjectId}
              onChange={setReportProjectId}
            />
          </div>
          <div className="field-group">
            <label htmlFor="report-start-date">From</label>
            <div className="date-input-wrap">
              <input
                id="report-start-date"
                ref={reportStartInputRef}
                type="date"
                value={reportStartDate}
                onChange={(event) => setReportStartDate(event.target.value)}
              />
              <button
                aria-label="Open report start date picker"
                className="date-input-button"
                onClick={() => openDatePicker(reportStartInputRef.current)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="report-end-date">To</label>
            <div className="date-input-wrap">
              <input
                id="report-end-date"
                ref={reportEndInputRef}
                type="date"
                value={reportEndDate}
                onChange={(event) => setReportEndDate(event.target.value)}
              />
              <button
                aria-label="Open report end date picker"
                className="date-input-button"
                onClick={() => openDatePicker(reportEndInputRef.current)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          <button
            className="secondary-button report-clear-button"
            disabled={reportProjectId === "all" && !reportStartDate && !reportEndDate}
            onClick={() => {
              setReportProjectId("all");
              setReportStartDate("");
              setReportEndDate("");
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
        {reportError ? <div className="inline-alert">{reportError}</div> : null}
        {reportLoading ? <div className="field-note">Loading report...</div> : null}
        {reportPagination && !reportLoading ? (
          <div className="field-note">
            Showing server-filtered report rows. {filteredReportEntryCount} saved{" "}
            {filteredReportEntryCount === 1 ? "entry" : "entries"} match the filters.
          </div>
        ) : null}
        {reportMode === "summary" ? (
          <>
            <PayItemReportTable rows={payItemRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : reportMode === "detail" ? (
          <>
            <DetailedPayItemReport
              detailGrouping={detailGrouping}
              detailPayItemOptions={detailPayItemOptions}
              detailPayItemQuery={detailPayItemQuery}
              detailRows={detailRows}
              detailSort={detailSort}
              setDetailGrouping={setDetailGrouping}
              setDetailPayItemQuery={setDetailPayItemQuery}
              setDetailSort={setDetailSort}
            />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : (
          <>
            <CrewPerformanceReport rows={crewRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function MyJobsManager({
  description = "Tag projects you want to filter quickly.",
  myJobIds,
  projects,
  setMyJobIds,
  title = "My Projects"
}: {
  description?: string;
  myJobIds: string[];
  projects: Project[];
  setMyJobIds: (jobIds: string[]) => void;
  title?: string;
}) {
  const selectedJobIds = new Set(myJobIds);
  const sortedProjects = sortProjectsByName(projects);

  function toggleJob(projectId: string, checked: boolean) {
    const nextSelectedJobIds = new Set(selectedJobIds);

    if (checked) {
      nextSelectedJobIds.add(projectId);
    } else {
      nextSelectedJobIds.delete(projectId);
    }

    setMyJobIds(sortedProjects.filter((project) => nextSelectedJobIds.has(project.id)).map((project) => project.id));
  }

  return (
    <div className="my-jobs-panel">
      <div className="my-jobs-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <div className="my-jobs-actions">
          <button className="secondary-button" onClick={() => setMyJobIds(sortedProjects.map((project) => project.id))} type="button">
            Select all
          </button>
          <button className="secondary-button" disabled={myJobIds.length === 0} onClick={() => setMyJobIds([])} type="button">
            Clear
          </button>
        </div>
      </div>
      {sortedProjects.length === 0 ? (
        <div className="empty-state">No jobs are available to tag yet.</div>
      ) : (
        <div className="my-jobs-list">
          {sortedProjects.map((project) => (
            <label className="my-job-row" key={project.id}>
              <input
                checked={selectedJobIds.has(project.id)}
                onChange={(event) => toggleJob(project.id, event.target.checked)}
                type="checkbox"
              />
              <span>{project.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyStatusReport({
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
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
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
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
  const sortedProjects = sortProjectsByName(projects);
  const weekDates = getWeekDates(weekStart);
  const activeProjectIds = useMyJobs ? myJobIds : selectedProjectIds;
  const activeProjectIdSet = new Set(activeProjectIds);
  const visibleProjects = sortedProjects.filter((project) => activeProjectIdSet.has(project.id));
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
      </div>
      {visibleProjects.length === 0 ? (
        <div className="empty-state">Select one or more projects, or tag My Projects, to view weekly status.</div>
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
                const status =
                  calendarStatusMode === "daily_reports"
                    ? getDailyReportCalendarStatus(dailyReportsByKey[dayKey], dailyReportUploadsByKey[dayKey])
                    : getEntryCalendarStatus(daySubmissions[dayKey]);

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

function getEntryCalendarStatus(daySubmission: DaySubmission | undefined) {
  if (daySubmission?.status === "submitted") {
    return {
      className: "submitted",
      label: "Submitted"
    };
  }

  return {
    className: "draft",
    label: "Draft"
  };
}

function getDailyReportCalendarStatus(dailyReport: DailyReport | undefined, upload: DailyReportUpload | undefined) {
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

  return {
    className: "missing",
    label: "Missing"
  };
}

function getDailyReportProcoreStatus(dailyReport: DailyReport | undefined, upload: DailyReportUpload | undefined) {
  if (!dailyReport) {
    return {
      className: "missing",
      label: "Not created",
      message: "Create and save a daily report before uploading to Procore."
    };
  }

  if (isUploadedDailyReportUpload(upload)) {
    const uploadedAt = upload?.uploadedAt ? ` on ${new Date(upload.uploadedAt).toLocaleString()}` : "";
    const fileName = upload?.fileName ? ` File: ${upload.fileName}.` : "";
    const folderPath = upload?.folderPath ? ` Folder: ${upload.folderPath}.` : "";

    return {
      className: "uploaded",
      label: "Uploaded",
      message: `Uploaded to Procore${uploadedAt}.${fileName}${folderPath}`
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
    label: "Pending upload",
    message: "Pending upload to Procore. Click Upload to Procore when the daily report is ready."
  };
}

function isUploadedDailyReportUpload(upload: DailyReportUpload | undefined) {
  return Boolean(upload && (upload.status === "uploaded" || (!upload.status && upload.uploadedAt)));
}

function PayItemReportTable({ rows }: { rows: PayItemReportRow[] }) {
  const [expandedPayItemKey, setExpandedPayItemKey] = useState<string | null>(null);

  if (rows.length === 0) {
    return <div className="empty-state">No saved entries available for pay item reporting.</div>;
  }

  return (
    <div className="report-table">
      <div className="report-row report-header">
        <span>Pay Item</span>
        <span>Entries</span>
        <span>Hours</span>
        <span>Quantity</span>
        <span>Avg Hrs / Unit</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedPayItemKey === row.key;
        const jobRollupRows = expanded ? row.jobRollupRows ?? [] : [];

        return (
          <div className="report-row-group" key={row.key}>
            <div className="report-row">
              <button
                className="report-drilldown-button"
                onClick={() => setExpandedPayItemKey(expanded ? null : row.key)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>
                  {row.code} - {row.name}
                </span>
              </button>
              <span data-label="Entries">{row.entryCount}</span>
              <span data-label="Hours">{row.totalHours.toFixed(2)}</span>
              <span data-label="Quantity">{row.totalQuantity.toFixed(2)}</span>
              <span data-label="Avg Hrs / Unit">{row.hoursPerUnit.toFixed(3)}</span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header summary-detail-row">
                  <span>Job</span>
                  <span>Entries</span>
                  <span>Hours</span>
                  <span>Quantity</span>
                  <span>Avg Hrs / Unit</span>
                </div>
                {jobRollupRows.map((jobRow) => (
                  <div className="report-detail-row summary-detail-row" key={jobRow.id}>
                    <span data-label="Job">{jobRow.projectName}</span>
                    <span data-label="Entries">{jobRow.entryCount}</span>
                    <span data-label="Hours">{jobRow.hours.toFixed(2)}</span>
                    <span data-label="Quantity">{jobRow.quantityCompleted.toFixed(2)}</span>
                    <span data-label="Avg Hrs / Unit">{jobRow.hoursPerUnit.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DetailedPayItemReport({
  detailGrouping,
  detailPayItemOptions,
  detailPayItemQuery,
  detailRows,
  detailSort,
  setDetailGrouping,
  setDetailPayItemQuery,
  setDetailSort
}: {
  detailGrouping: DetailGrouping;
  detailPayItemOptions: ReportPayItemOption[];
  detailPayItemQuery: string;
  detailRows: PayItemDetailAnalysisRow[];
  detailSort: DetailSort;
  setDetailGrouping: (grouping: DetailGrouping) => void;
  setDetailPayItemQuery: (query: string) => void;
  setDetailSort: (sort: DetailSort) => void;
}) {
  const normalizedQuery = detailPayItemQuery.trim().toLowerCase();

  return (
    <div className="report-detail-analysis">
      <div className="report-detail-controls">
        <div className="field-group">
          <label htmlFor="detail-pay-item-select">Pay Item</label>
          <select
            id="detail-pay-item-select"
            disabled={detailPayItemOptions.length === 0}
            value={detailPayItemOptions.some((option) => option.query === detailPayItemQuery) ? detailPayItemQuery : ""}
            onChange={(event) => setDetailPayItemQuery(event.target.value)}
          >
            <option value="">
              {detailPayItemOptions.length === 0 ? "No pay items with entries" : "Select pay item"}
            </option>
            {detailPayItemOptions.map((option) => (
              <option key={option.key} value={option.query}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="detail-pay-item-search">Pay Item Search</label>
          <input
            id="detail-pay-item-search"
            placeholder="Search code or description"
            value={detailPayItemQuery}
            onChange={(event) => setDetailPayItemQuery(event.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="detail-grouping">Group By</label>
          <select
            id="detail-grouping"
            value={detailGrouping}
            onChange={(event) => setDetailGrouping(event.target.value as DetailGrouping)}
          >
            <option value="crew_day">Crew member by day</option>
            <option value="crew_project">Crew member by project</option>
            <option value="job_day">Job by day</option>
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="detail-sort">Sort By</label>
          <select
            id="detail-sort"
            value={detailSort}
            onChange={(event) => setDetailSort(event.target.value as DetailSort)}
          >
            <option value="worst_average">Highest hrs/unit</option>
            <option value="best_average">Lowest hrs/unit</option>
            <option value="most_hours">Most hours</option>
            <option value="most_quantity">Most quantity</option>
          </select>
        </div>
        <button
          className="secondary-button report-clear-button"
          disabled={!detailPayItemQuery}
          onClick={() => setDetailPayItemQuery("")}
          type="button"
        >
          Clear search
        </button>
      </div>

      {!normalizedQuery ? (
        <div className="empty-state">Search for a pay item to load detailed crew performance rows.</div>
      ) : detailRows.length === 0 ? (
        <div className="empty-state">No saved entries match that pay item search.</div>
      ) : (
        <div className="report-table detail-analysis-table">
          <div className="report-row report-header detail-analysis-row">
            <span>Pay Item</span>
            <span>Date</span>
            <span>Job</span>
            <span>Crew Member</span>
            <span>Entries</span>
            <span>Hours</span>
            <span>Quantity</span>
            <span>Avg Hrs / Unit</span>
          </div>
          {detailRows.map((row) => (
            <div className="report-row detail-analysis-row" key={row.id}>
              <span data-label="Pay Item">{row.payItemLabel}</span>
              <span data-label="Date">{row.date ? formatDate(row.date) : "All dates"}</span>
              <span data-label="Job">{row.projectName}</span>
              <span data-label="Crew Member">
                {row.crewMemberName ? (
                  <>
                    <strong>{row.crewMemberName}</strong>
                    {row.jobTitle && row.jobTitle !== "-" ? ` - ${row.jobTitle}` : ""}
                  </>
                ) : (
                  "All crew"
                )}
              </span>
              <span data-label="Entries">{row.entryCount}</span>
              <span data-label="Hours">{row.hours.toFixed(2)}</span>
              <span data-label="Quantity">{row.quantityCompleted.toFixed(2)}</span>
              <span data-label="Avg Hrs / Unit">{row.hoursPerUnit.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrewPerformanceInfo() {
  return (
    <div className="report-info-panel">
      This report compares each crew member against the company average for the same pay items they worked on. Each
      pay-item variance is weighted by that crew member&apos;s hours, so larger work samples matter more than small
      one-off entries. Lower hours per unit is treated as better performance. Rows marked limited data have less than
      20 hours or fewer than 3 entries.
    </div>
  );
}

function CrewPerformanceReport({ rows }: { rows: CrewPerformanceRow[] }) {
  const [expandedCrewMemberId, setExpandedCrewMemberId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <div className="empty-state">No crew allocation entries are available for crew performance reporting.</div>;
  }

  return (
    <div className="report-table crew-performance-table">
      <div className="report-row report-header crew-performance-row">
        <span>Crew Member</span>
        <span>Hours</span>
        <span>Entries</span>
        <span>Pay Items</span>
        <span>Jobs</span>
        <span>Avg vs Company</span>
        <span>Status</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedCrewMemberId === row.id;

        return (
          <div className="report-row-group" key={row.id}>
            <div className="report-row crew-performance-row">
              <button
                className="report-drilldown-button"
                onClick={() => setExpandedCrewMemberId(expanded ? null : row.id)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>
                  <strong>{row.crewMemberName}</strong>
                  {row.jobTitle !== "-" ? ` - ${row.jobTitle}` : ""}
                </span>
              </button>
              <span data-label="Hours">{row.totalHours.toFixed(2)}</span>
              <span data-label="Entries">{row.entryCount}</span>
              <span data-label="Pay Items">{row.payItemCount}</span>
              <span data-label="Jobs">{row.jobCount}</span>
              <span data-label="Avg vs Company">{formatVariance(row.weightedVariance)}</span>
              <span data-label="Status">
                <span className={`performance-pill ${row.status}`}>{formatCrewPerformanceStatus(row.status)}</span>
              </span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header crew-performance-detail-row">
                  <span>Pay Item</span>
                  <span>Hours</span>
                  <span>Quantity</span>
                  <span>Crew Hrs / Unit</span>
                  <span>Company Hrs / Unit</span>
                  <span>Difference</span>
                  <span>Entries</span>
                  <span>Jobs</span>
                </div>
                {row.payItems.map((payItem) => (
                  <div className="report-detail-row crew-performance-detail-row" key={payItem.id}>
                    <span data-label="Pay Item">{payItem.payItemLabel}</span>
                    <span data-label="Hours">{payItem.hours.toFixed(2)}</span>
                    <span data-label="Quantity">{payItem.quantityCompleted.toFixed(2)}</span>
                    <span data-label="Crew Hrs / Unit">{payItem.hoursPerUnit.toFixed(3)}</span>
                    <span data-label="Company Hrs / Unit">{payItem.companyHoursPerUnit.toFixed(3)}</span>
                    <span data-label="Difference">{formatVariance(payItem.variance)}</span>
                    <span data-label="Entries">{payItem.entryCount}</span>
                    <span data-label="Jobs">{payItem.jobCount}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ReportPaginationControls({
  loading,
  onPageChange,
  page,
  pageSize,
  totalRows
}: {
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalRows: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (totalRows <= pageSize) {
    return null;
  }

  return (
    <div className="report-pagination">
      <button
        className="secondary-button"
        disabled={loading || page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages} ({totalRows} rows)
      </span>
      <button
        className="secondary-button"
        disabled={loading || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function SyncSummaryCard({ summary }: { summary: ProcoreSyncSummary }) {
  const remainingNewProjects = summary.remainingNewProjects ?? 0;

  return (
    <div className={hasSyncWarnings(summary) ? "sync-summary warning" : "sync-summary"}>
      <strong>
        Synced {summary.synced} of {summary.attempted} attempted project{summary.attempted === 1 ? "" : "s"}
      </strong>
      <span>{summary.skippedExisting} existing project{summary.skippedExisting === 1 ? "" : "s"} skipped.</span>
      {remainingNewProjects > 0 ? (
        <span>
          {remainingNewProjects} new project{remainingNewProjects === 1 ? "" : "s"} still queued. Run Sync New Projects again to continue.
        </span>
      ) : null}
      {summary.failed > 0 ? (
        <span>{summary.failed} project{summary.failed === 1 ? "" : "s"} failed or returned no budget lines.</span>
      ) : null}
      {summary.failedProjects.length > 0 ? (
        <details>
          <summary>Failed projects</summary>
          <ul>
            {summary.failedProjects.slice(0, 8).map((project) => (
              <li key={project}>{project}</li>
            ))}
          </ul>
          {summary.failedProjects.length > 8 ? <span>{summary.failedProjects.length - 8} more not shown.</span> : null}
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
              {entry.summary ? (
                <span>{formatSyncSummaryLine(entry.summary)}</span>
              ) : null}
              {entry.summary?.failedProjects.length ? (
                <details>
                  <summary>Failed projects</summary>
                  <ul>
                    {entry.summary.failedProjects.slice(0, 8).map((project) => (
                      <li key={project}>{project}</li>
                    ))}
                  </ul>
                  {entry.summary.failedProjects.length > 8 ? (
                    <span>{entry.summary.failedProjects.length - 8} more not shown.</span>
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

function AdminUsersPanel({
  currentUserId,
  editingUserId,
  form,
  loading,
  notice,
  onCancelEdit,
  onEditUser,
  onRefresh,
  onSaveUser,
  onSetUserActive,
  onUpdateForm,
  saving,
  users
}: {
  currentUserId: string;
  editingUserId: string;
  form: AdminUserFormState;
  loading: boolean;
  notice: string;
  onCancelEdit: () => void;
  onEditUser: (user: ManagedAppUser) => void;
  onRefresh: () => void;
  onSaveUser: () => void;
  onSetUserActive: (user: ManagedAppUser, active: boolean) => void;
  onUpdateForm: (field: keyof AdminUserFormState, value: string | boolean) => void;
  saving: boolean;
  users: ManagedAppUser[];
}) {
  const activeUserCount = users.filter((user) => user.active).length;

  return (
    <details className="admin-users">
      <summary>
        <Users aria-hidden="true" size={16} />
        Users ({activeUserCount}/{users.length})
      </summary>
      <div className="admin-users-body">
        {notice ? <div className={notice.toLowerCase().includes("unable") || notice.toLowerCase().includes("requires") ? "inline-alert" : "success-alert"}>{notice}</div> : null}
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
              onChange={(event) => onUpdateForm("role", event.target.value as AuthUser["role"])}
              value={form.role}
            >
              <option value="standard">Standard User</option>
              <option value="project_manager">Project Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
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
                  </span>
                </div>
                <div className="admin-user-row-actions">
                  <button className="icon-button" onClick={() => onEditUser(user)} title="Edit user" type="button">
                    <Edit3 aria-hidden="true" size={16} />
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

function buildPayItemReport(entries: AllocationEntry[], projects: Project[] = []): PayItemReportRow[] {
  const rows = new Map<string, PayItemReportRow>();

  for (const entry of entries) {
    const key = getPayItemReportKey(entry);
    const current = rows.get(key) ?? {
      key,
      code: entry.payItemCode,
      name: entry.payItemName,
      totalHours: 0,
      totalQuantity: 0,
      hoursPerUnit: 0,
      entryCount: 0
    };

    current.totalHours += entry.hours;
    current.totalQuantity += entry.quantityCompleted;
    current.entryCount += 1;
    current.hoursPerUnit = current.totalQuantity > 0 ? current.totalHours / current.totalQuantity : 0;
    rows.set(key, current);
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      jobRollupRows: buildPayItemJobRollupRows(
        entries.filter((entry) => getPayItemReportKey(entry) === row.key),
        projects
      )
    }))
    .sort((a, b) => b.hoursPerUnit - a.hoursPerUnit);
}

function buildPayItemJobRollupRows(entries: AllocationEntry[], projects: Project[]): PayItemJobRollupRow[] {
  const rows = new Map<string, PayItemJobRollupRow>();

  for (const entry of entries) {
    const current = rows.get(entry.projectId) ?? {
      id: entry.projectId,
      projectName: getEntryProjectName(entry, projects),
      entryCount: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0
    };

    current.entryCount += 1;
    current.hours += entry.hours;
    current.quantityCompleted += entry.quantityCompleted;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    rows.set(entry.projectId, current);
  }

  return Array.from(rows.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
}

function buildPayItemReportDetailRows(entries: AllocationEntry[], projects: Project[]): PayItemReportDetailRow[] {
  return entries.flatMap((entry) => {
    const projectName = getEntryProjectName(entry, projects);
    const payItemKey = getPayItemReportKey(entry);
    const payItemLabel = `${entry.payItemCode} - ${entry.payItemName}`;

    if (!entry.crewAllocations?.length || entry.hours <= 0) {
      return [
        {
          id: `${entry.id}-unassigned`,
          date: entry.date,
          payItemKey,
          payItemLabel,
          projectName,
          crewMemberId: "unassigned",
          crewMemberName: "Unassigned",
          jobTitle: "-",
          hours: entry.hours,
          quantityCompleted: entry.quantityCompleted,
          hoursPerUnit: entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : 0,
          savedByName: entry.savedByName
        }
      ];
    }

    return entry.crewAllocations.map((allocation) => {
      const hourShare = entry.hours > 0 ? allocation.hours / entry.hours : 0;

      return {
        id: `${entry.id}-${allocation.crewMemberId}`,
        date: entry.date,
        payItemKey,
        payItemLabel,
        projectName,
        crewMemberId: allocation.crewMemberId,
        crewMemberName: allocation.crewMemberName,
        jobTitle: allocation.jobTitle,
        hours: allocation.hours,
        quantityCompleted: entry.quantityCompleted * hourShare,
        hoursPerUnit: entry.quantityCompleted * hourShare > 0
          ? allocation.hours / (entry.quantityCompleted * hourShare)
          : 0,
        savedByName: entry.savedByName
      };
    });
  });
}

function buildPayItemDetailAnalysisRows(
  entries: AllocationEntry[],
  projects: Project[],
  grouping: DetailGrouping,
  sort: DetailSort
): PayItemDetailAnalysisRow[] {
  const detailRows = buildPayItemReportDetailRows(entries, projects);
  const rows = new Map<string, PayItemDetailAnalysisRow>();

  for (const detailRow of detailRows) {
    const key = getDetailAnalysisKey(detailRow, grouping);
    const current = rows.get(key) ?? {
      id: key,
      payItemLabel: detailRow.payItemLabel,
      date: grouping === "crew_day" || grouping === "job_day" ? detailRow.date : undefined,
      projectName: detailRow.projectName,
      crewMemberName: grouping === "crew_day" || grouping === "crew_project" ? detailRow.crewMemberName : undefined,
      jobTitle: grouping === "crew_day" || grouping === "crew_project" ? detailRow.jobTitle : undefined,
      entryCount: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0
    };

    current.entryCount += 1;
    current.hours += detailRow.hours;
    current.quantityCompleted += detailRow.quantityCompleted;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    rows.set(key, current);
  }

  return sortDetailAnalysisRows(Array.from(rows.values()), sort);
}

function buildCrewPerformanceRows(entries: AllocationEntry[], projects: Project[]): CrewPerformanceRow[] {
  const detailRows = buildPayItemReportDetailRows(entries, projects).filter(
    (row) => row.crewMemberId !== "unassigned" && row.quantityCompleted > 0 && row.hours > 0
  );
  const companyPayItemStats = new Map<string, { hours: number; quantity: number; hoursPerUnit: number }>();

  for (const row of detailRows) {
    const current = companyPayItemStats.get(row.payItemKey) ?? {
      hours: 0,
      quantity: 0,
      hoursPerUnit: 0
    };

    current.hours += row.hours;
    current.quantity += row.quantityCompleted;
    current.hoursPerUnit = current.quantity > 0 ? current.hours / current.quantity : 0;
    companyPayItemStats.set(row.payItemKey, current);
  }

  const crewPayItemRows = new Map<
    string,
    CrewPerformancePayItemRow & { crewMemberName: string; crewMemberId: string; jobTitle: string; jobIds: Set<string> }
  >();

  for (const row of detailRows) {
    const companyStats = companyPayItemStats.get(row.payItemKey);

    if (!companyStats || companyStats.hoursPerUnit <= 0) {
      continue;
    }

    const key = `${row.crewMemberId}|${row.payItemKey}`;
    const current = crewPayItemRows.get(key) ?? {
      id: key,
      crewMemberId: row.crewMemberId,
      crewMemberName: row.crewMemberName,
      jobTitle: row.jobTitle,
      payItemLabel: row.payItemLabel,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0,
      companyHoursPerUnit: companyStats.hoursPerUnit,
      variance: 0,
      entryCount: 0,
      jobCount: 0,
      jobIds: new Set<string>()
    };

    current.hours += row.hours;
    current.quantityCompleted += row.quantityCompleted;
    current.entryCount += 1;
    current.jobIds.add(row.projectName);
    current.jobCount = current.jobIds.size;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    current.companyHoursPerUnit = companyStats.hoursPerUnit;
    current.variance =
      current.companyHoursPerUnit > 0
        ? (current.hoursPerUnit - current.companyHoursPerUnit) / current.companyHoursPerUnit
        : 0;
    crewPayItemRows.set(key, current);
  }

  const crewRows = new Map<string, CrewPerformanceRow & { jobIds: Set<string> }>();

  for (const payItemRow of crewPayItemRows.values()) {
    const current = crewRows.get(payItemRow.crewMemberId) ?? {
      id: payItemRow.crewMemberId,
      crewMemberName: payItemRow.crewMemberName,
      jobTitle: payItemRow.jobTitle,
      totalHours: 0,
      totalQuantity: 0,
      entryCount: 0,
      jobCount: 0,
      payItemCount: 0,
      weightedVariance: 0,
      status: "average",
      payItems: [],
      jobIds: new Set<string>()
    };

    current.totalHours += payItemRow.hours;
    current.totalQuantity += payItemRow.quantityCompleted;
    current.entryCount += payItemRow.entryCount;
    for (const jobId of payItemRow.jobIds) {
      current.jobIds.add(jobId);
    }
    current.payItems.push({
      id: payItemRow.id,
      payItemLabel: payItemRow.payItemLabel,
      hours: payItemRow.hours,
      quantityCompleted: payItemRow.quantityCompleted,
      hoursPerUnit: payItemRow.hoursPerUnit,
      companyHoursPerUnit: payItemRow.companyHoursPerUnit,
      variance: payItemRow.variance,
      entryCount: payItemRow.entryCount,
      jobCount: payItemRow.jobCount
    });
    current.jobCount = current.jobIds.size;
    current.payItemCount = current.payItems.length;
    current.weightedVariance = getWeightedVariance(current.payItems);
    current.status = getCrewPerformanceStatus(current);
    crewRows.set(payItemRow.crewMemberId, current);
  }

  return Array.from(crewRows.values())
    .map((row) => ({
      id: row.id,
      crewMemberName: row.crewMemberName,
      jobTitle: row.jobTitle,
      totalHours: row.totalHours,
      totalQuantity: row.totalQuantity,
      entryCount: row.entryCount,
      jobCount: row.jobCount,
      payItemCount: row.payItemCount,
      weightedVariance: row.weightedVariance,
      status: row.status,
      payItems: [...row.payItems].sort((a, b) => b.hours - a.hours)
    }))
    .sort((a, b) => b.weightedVariance - a.weightedVariance);
}

function getWeightedVariance(payItems: CrewPerformancePayItemRow[]) {
  const totalWeight = payItems.reduce((total, row) => total + row.hours, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  return payItems.reduce((total, row) => total + row.variance * row.hours, 0) / totalWeight;
}

function getCrewPerformanceStatus(row: Pick<CrewPerformanceRow, "entryCount" | "totalHours" | "weightedVariance">) {
  if (row.totalHours < 20 || row.entryCount < 3) {
    return "limited";
  }

  if (row.weightedVariance <= -0.15) {
    return "strong";
  }

  if (row.weightedVariance >= 0.25) {
    return "review";
  }

  return "average";
}

function getDetailAnalysisKey(row: PayItemReportDetailRow, grouping: DetailGrouping) {
  if (grouping === "crew_project") {
    return `${row.payItemKey}|${row.projectName}|${row.crewMemberName}|${row.jobTitle}`;
  }

  if (grouping === "job_day") {
    return `${row.payItemKey}|${row.date}|${row.projectName}`;
  }

  return `${row.payItemKey}|${row.date}|${row.projectName}|${row.crewMemberName}|${row.jobTitle}`;
}

function sortDetailAnalysisRows(rows: PayItemDetailAnalysisRow[], sort: DetailSort) {
  return [...rows].sort((a, b) => {
    if (sort === "best_average") {
      return a.hoursPerUnit - b.hoursPerUnit;
    }

    if (sort === "most_hours") {
      return b.hours - a.hours;
    }

    if (sort === "most_quantity") {
      return b.quantityCompleted - a.quantityCompleted;
    }

    return b.hoursPerUnit - a.hoursPerUnit;
  });
}

function payItemMatchesQuery(entry: AllocationEntry, normalizedQuery: string) {
  return `${entry.payItemCode} ${entry.payItemName}`.toLowerCase().includes(normalizedQuery);
}

function getReportTitle(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return "Detailed Pay Item Analysis";
  }

  if (reportMode === "crew") {
    return "Crew Performance Summary";
  }

  return "Pay Item Production Report";
}

function getReportPageSize(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return 50;
  }

  return 25;
}

function formatVariance(variance: number) {
  const percent = Math.abs(variance * 100);

  if (percent < 0.5) {
    return "At average";
  }

  return `${percent.toFixed(1)}% ${variance < 0 ? "better" : "worse"}`;
}

function formatCrewPerformanceStatus(status: CrewPerformanceRow["status"]) {
  if (status === "strong") {
    return "Strong";
  }

  if (status === "review") {
    return "Needs review";
  }

  if (status === "limited") {
    return "Limited data";
  }

  return "At average";
}

function getPayItemReportKey(entry: AllocationEntry) {
  return `${entry.payItemCode}-${entry.payItemName}`;
}

function getEntryProjectName(entry: AllocationEntry, projects: Project[]) {
  return entry.projectName ?? projects.find((project) => project.id === entry.projectId)?.name ?? `Unknown job (${entry.projectId})`;
}

function buildReportProjectOptions(projects: Project[], entries: AllocationEntry[]) {
  const projectOptions = new Map(projects.map((project) => [project.id, project.name]));

  for (const entry of entries) {
    if (!projectOptions.has(entry.projectId)) {
      projectOptions.set(entry.projectId, entry.projectName ?? `Unknown job (${entry.projectId})`);
    }
  }

  return Array.from(projectOptions.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildReportPayItemOptions(entries: AllocationEntry[]) {
  const payItemOptions = new Map<string, { key: string; label: string; query: string }>();

  for (const entry of entries) {
    const key = getPayItemReportKey(entry);

    if (!payItemOptions.has(key)) {
      payItemOptions.set(key, {
        key,
        label: `${entry.payItemCode} - ${entry.payItemName}`,
        query: entry.payItemCode
      });
    }
  }

  return Array.from(payItemOptions.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function sortProjectsByName(projects: Project[]) {
  return [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function filterProjectsByBlacklist(projects: Project[], projectBlacklistById: ProjectBlacklistById) {
  return projects.filter((project) => !projectBlacklistById[project.id]);
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

function mergeCrewDirectories(primaryCrewMembers: CrewMember[], fallbackCrewMembers: CrewMember[]) {
  const crewMembersById = new Map<string, CrewMember>();

  for (const crewMember of [...fallbackCrewMembers, ...primaryCrewMembers]) {
    crewMembersById.set(crewMember.id, crewMember);
  }

  return sortCrewMembersByName(Array.from(crewMembersById.values()));
}

function buildSharedAppState(state: SharedAppState): SharedAppState {
  return {
    crewDirectory: sortCrewMembersByName(state.crewDirectory),
    crewMembersByProject: state.crewMembersByProject,
    dailyReportUploadsByKey: state.dailyReportUploadsByKey,
    dailyReportsByKey: state.dailyReportsByKey,
    dayEntryNotesByKey: state.dayEntryNotesByKey,
    daySubmissions: state.daySubmissions,
    entries: state.entries,
    myJobsByUser: state.myJobsByUser,
    projectBlacklistById: state.projectBlacklistById,
    syncLog: state.syncLog
  };
}

async function loadDatabaseEntries() {
  try {
    const response = await fetch("/api/entries", {
      cache: "no-store"
    });
    const data = (await response.json()) as EntriesResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return data.entries ?? [];
  } catch {
    return null;
  }
}

async function saveDatabaseEntries(entries: AllocationEntry[]) {
  const response = await fetch("/api/entries", {
    body: JSON.stringify({ entries }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to save entries.");
  }
}

async function deleteDatabaseEntry(entryId: string) {
  const response = await fetch(`/api/entries?entryId=${encodeURIComponent(entryId)}`, {
    method: "DELETE"
  });
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete entry.");
  }
}

async function deleteDatabaseDayEntries(projectId: string, date: string) {
  const response = await fetch(
    `/api/entries?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete day entries.");
  }
}

async function loadDatabaseCrewData() {
  try {
    const response = await fetch("/api/crew", {
      cache: "no-store"
    });
    const data = (await response.json()) as CrewDataResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      crewDirectory: data.crewDirectory ?? [],
      crewMembersByProject: data.crewMembersByProject ?? {}
    };
  } catch {
    return null;
  }
}

async function addDatabaseCrewMemberToProject(projectId: string, crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "add_to_project",
      crewMember,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save crew member.");
  }
}

async function updateDatabaseCrewMember(crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "update_member",
      crewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to update crew member.");
  }
}

async function removeDatabaseCrewMemberFromProject(projectId: string, crewMemberId: string) {
  const response = await fetch(
    `/api/crew?projectId=${encodeURIComponent(projectId)}&crewMemberId=${encodeURIComponent(crewMemberId)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to remove crew member from project.");
  }
}

async function mergeDatabaseCrewMembers(sourceCrewMemberId: string, targetCrewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "merge",
      sourceCrewMemberId,
      targetCrewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to merge crew members.");
  }
}

async function loadDatabaseDailyReportData() {
  try {
    const response = await fetch("/api/daily-reports", {
      cache: "no-store"
    });
    const data = (await response.json()) as DailyReportsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      dailyReportUploadsByKey: data.dailyReportUploadsByKey ?? {},
      dailyReportsByKey: data.dailyReportsByKey ?? {}
    };
  } catch {
    return null;
  }
}

async function saveDatabaseDailyReport(projectId: string, date: string, dailyReport: DailyReport) {
  const response = await fetch("/api/daily-reports", {
    body: JSON.stringify({
      action: "save_report",
      dailyReport,
      date,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save daily report.");
  }
}

async function saveDatabaseDailyReportUpload(projectId: string, date: string, dailyReportUpload: DailyReportUpload) {
  const response = await fetch("/api/daily-reports", {
    body: JSON.stringify({
      action: "save_upload",
      dailyReportUpload,
      date,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save daily report upload status.");
  }
}

async function deleteDatabaseDailyReportUpload(projectId: string, date: string) {
  const response = await fetch(
    `/api/daily-reports?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}&kind=upload`,
    {
      method: "DELETE"
    }
  );
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear daily report upload status.");
  }
}

async function loadDatabaseDayRecords() {
  try {
    const response = await fetch("/api/day-records", {
      cache: "no-store"
    });
    const data = (await response.json()) as DayRecordsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      dayEntryNotesByKey: data.dayEntryNotesByKey ?? {},
      daySubmissions: data.daySubmissions ?? {}
    };
  } catch {
    return null;
  }
}

async function saveDatabaseDayNotes(projectId: string, date: string, dayEntryNotes: DayEntryNotes) {
  const response = await fetch("/api/day-records", {
    body: JSON.stringify({
      action: "save_notes",
      date,
      dayEntryNotes,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save notes.");
  }
}

async function saveDatabaseDaySubmission(projectId: string, date: string, daySubmission: DaySubmission) {
  const response = await fetch("/api/day-records", {
    body: JSON.stringify({
      action: "save_submission",
      date,
      daySubmission,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save day status.");
  }
}

async function deleteDatabaseDaySubmission(projectId: string, date: string) {
  const response = await fetch(
    `/api/day-records?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to delete day status.");
  }
}

async function loadDatabaseProjectControls() {
  try {
    const response = await fetch("/api/project-controls", {
      cache: "no-store"
    });
    const data = (await response.json()) as ProjectControlsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      myJobsByUser: data.myJobsByUser ?? {},
      projectBlacklistById: data.projectBlacklistById ?? {},
      syncLog: data.syncLog ?? []
    };
  } catch {
    return null;
  }
}

async function saveDatabaseMyJobs(userId: string, projectIds: string[]) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "save_my_jobs",
      projectIds,
      userId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save My Projects.");
  }
}

async function saveDatabaseProjectBlacklist(projectId: string, blacklisted: boolean) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "set_blacklist",
      blacklisted,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save project blacklist.");
  }
}

async function saveDatabaseSyncLogEntry(syncLogEntry: SyncLogEntry) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "add_sync_log",
      syncLogEntry
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save sync log.");
  }
}

function normalizeSharedAppState(state: Partial<SharedAppState> | null | undefined): SharedAppState {
  const crewMembersByProject = state?.crewMembersByProject ?? {};
  const crewDirectory = mergeCrewDirectories(
    state?.crewDirectory ?? [],
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
    projectBlacklistById: state?.projectBlacklistById ?? {},
    syncLog: state?.syncLog ?? []
  });
}

function readLocalSharedAppState(): SharedAppState {
  const crewMembersByProject = readLocalJson<CrewMembersByProject>("project-crew-members", {});
  const crewDirectory = mergeCrewDirectories(
    readLocalJson<CrewMember[]>("crew-member-directory", []),
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
            crewMemberName: targetCrewMember.name,
            jobTitle: targetCrewMember.jobTitle
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
  const nextDraft = {
    ...draft,
    crewHours
  };

  if (draft.crewMemberIds.length === 1 && draft.hours !== "") {
    return {
      ...nextDraft,
      crewHours: {
        [draft.crewMemberIds[0]]: draft.hours
      }
    };
  }

  const totalHours = Number(draft.hours);
  const allocatedHours = draft.crewMemberIds.reduce((total, crewMemberId) => total + Number(crewHours[crewMemberId] || 0), 0);
  const hasMissingCrewHours = draft.crewMemberIds.some((crewMemberId) => crewHours[crewMemberId] === undefined || crewHours[crewMemberId] === "");

  if (
    draft.crewMemberIds.length > 1 &&
    Number.isFinite(totalHours) &&
    totalHours > 0 &&
    (hasMissingCrewHours || allocatedHours === 0 || Math.abs(allocatedHours - totalHours) > 0.01)
  ) {
    return splitCrewHoursEvenly(nextDraft);
  }

  return nextDraft;
}

function splitCrewHoursEvenly(draft: PayItemDraft) {
  const totalHours = Number(draft.hours);

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
    crewHours
  };
}

function getSelectedCrewMemberIds(draft: PayItemDraft | undefined, savedEntry: AllocationEntry | undefined) {
  return draft?.crewMemberIds ?? savedEntry?.crewAllocations?.map((allocation) => allocation.crewMemberId) ?? [];
}

function getSelectedCrewHours(draft: PayItemDraft | undefined, savedEntry: AllocationEntry | undefined) {
  if (draft) {
    return draft.crewHours;
  }

  return (
    savedEntry?.crewAllocations?.reduce<Record<string, string>>((hoursByCrewMemberId, allocation) => {
      hoursByCrewMemberId[allocation.crewMemberId] = String(allocation.hours);
      return hoursByCrewMemberId;
    }, {}) ?? {}
  );
}

function getSelectedCrewMembers(
  selectedCrewMemberIds: string[],
  crewMembers: CrewMember[],
  savedEntry: AllocationEntry | undefined
) {
  return selectedCrewMemberIds.map((crewMemberId) => {
    const currentCrewMember = crewMembers.find((member) => member.id === crewMemberId);
    const savedCrewMember = savedEntry?.crewAllocations?.find((allocation) => allocation.crewMemberId === crewMemberId);

    return {
      id: crewMemberId,
      name: currentCrewMember?.name ?? savedCrewMember?.crewMemberName ?? "Unknown crew member",
      jobTitle: currentCrewMember?.jobTitle ?? savedCrewMember?.jobTitle ?? "-"
    };
  });
}

function getCrewAllocationError(draft: PayItemDraft | undefined, crewMembers: CrewMember[]) {
  if (!draft || !draftIsSaveable(draft)) {
    return "";
  }

  const hours = Number(draft.hours);

  if (hours <= 0) {
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

  const allocatedHours = draft.crewMemberIds.reduce((total, crewMemberId) => {
    const value = draft.crewMemberIds.length === 1 && draft.crewHours[crewMemberId] === "" ? hours : Number(draft.crewHours[crewMemberId]);
    return total + value;
  }, 0);
  const hasInvalidAllocation = draft.crewMemberIds.some((crewMemberId) => {
    const value = Number(draft.crewHours[crewMemberId]);
    return !Number.isFinite(value) || value < 0;
  });

  if (hasInvalidAllocation) {
    return "Enter valid allocated hours for each selected crew member.";
  }

  if (Array.from(selectedCrewMemberIds).length !== draft.crewMemberIds.length) {
    return "Remove duplicate crew selections before saving.";
  }

  if (Math.abs(allocatedHours - hours) > 0.01) {
    return "Crew allocated hours must equal the pay item hours before saving.";
  }

  return "";
}

function buildCrewAllocations(draft: PayItemDraft | undefined, crewMembers: CrewMember[], totalHours: number) {
  if (!draft || totalHours <= 0 || draft.crewMemberIds.length === 0) {
    return [];
  }

  return draft.crewMemberIds.map((crewMemberId) => {
    const crewMember = crewMembers.find((member) => member.id === crewMemberId);
    const hours = draft.crewMemberIds.length === 1 ? totalHours : Number(draft.crewHours[crewMemberId]);

    return {
      crewMemberId,
      crewMemberName: crewMember?.name ?? "Unknown crew member",
      jobTitle: crewMember?.jobTitle ?? "-",
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
        hours: (rows.get("unassigned")?.hours ?? 0) + entry.hours
      });
      continue;
    }

    for (const allocation of entry.crewAllocations) {
      const crewMember = crewMembers.find((member) => member.id === allocation.crewMemberId);
      const row = rows.get(allocation.crewMemberId) ?? {
        crewMemberId: allocation.crewMemberId,
        name: crewMember?.name ?? allocation.crewMemberName,
        jobTitle: crewMember?.jobTitle ?? allocation.jobTitle,
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
    .map((allocation) => `${allocation.crewMemberName} ${allocation.hours.toFixed(2)}h`)
    .join(", ")}`;
}

function draftIsSaveable(draft: PayItemDraft | undefined) {
  const hasHoursInput = draft?.hours !== undefined && draft.hours !== "";
  const hasQuantityInput = draft?.quantity !== undefined && draft.quantity !== "";

  if (!hasHoursInput || !hasQuantityInput) {
    return false;
  }

  const hours = Number(draft.hours);
  const quantity = Number(draft.quantity);

  return hours >= 0 && quantity >= 0 && Number.isFinite(hours) && Number.isFinite(quantity);
}

function draftIsIncomplete(draft: PayItemDraft | undefined) {
  const hasHoursInput = draft?.hours !== undefined && draft.hours !== "";
  const hasQuantityInput = draft?.quantity !== undefined && draft.quantity !== "";

  return hasHoursInput !== hasQuantityInput;
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

function payItemHasWork(payItemId: string, draftsByPayItem: DraftsByPayItem, visibleEntries: AllocationEntry[]) {
  return visibleEntries.some((entry) => entry.payItemId === payItemId) || draftHasAnyInput(draftsByPayItem[payItemId]);
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
        entry.savedAt ?? "",
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
    itsfmCabinetEquipment: ""
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
    itsfmCabinetEquipment: report.itsfmCabinetEquipment ?? ""
  };
}

function normalizeDailyReportAnswersForSave(report: DailyReportAnswers): DailyReportAnswers {
  return {
    ...report,
    accidentReportFiled: report.incidentOccurred === "yes" ? report.accidentReportFiled : "",
    incidentDetails: report.incidentOccurred === "yes" ? report.incidentDetails : "",
    inspectorName: report.quantitiesTurnedIn === "yes" ? report.inspectorName : "",
    inspectorQuantityDetails: report.quantitiesTurnedIn === "yes" ? report.inspectorQuantityDetails : "",
    itsfmRows: normalizeDailyReportItsfmRows(report.itsfmRows)
  };
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

function buildDailyReportEmployeeRowsFromEntries(entries: AllocationEntry[], crewMembers: CrewMember[]) {
  const rowsByCrewMemberId = new Map<string, DailyReportEmployeeRow>();

  for (const entry of entries) {
    for (const allocation of entry.crewAllocations ?? []) {
      const crewMember = crewMembers.find((member) => member.id === allocation.crewMemberId);
      const row = rowsByCrewMemberId.get(allocation.crewMemberId) ?? {
        employeeClassification: `${crewMember?.name ?? allocation.crewMemberName} - ${
          crewMember?.jobTitle ?? allocation.jobTitle
        }`,
        truckNumber: "",
        timeIn: "",
        lunchOut: "",
        lunchIn: "",
        timeOut: "",
        totalHours: "0.00",
        driver: false,
        passenger: false
      };

      row.totalHours = (Number(row.totalHours || 0) + allocation.hours).toFixed(2);
      rowsByCrewMemberId.set(allocation.crewMemberId, row);
    }
  }

  const populatedRows = Array.from(rowsByCrewMemberId.values()).sort((a, b) =>
    a.employeeClassification.localeCompare(b.employeeClassification, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
  const emptyRows = createEmptyDailyReportEmployeeRows();

  return emptyRows.map((emptyRow, index) => populatedRows[index] ?? emptyRow);
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

function findPreviousDailyReportWithWorkRows(dailyReportsByKey: DailyReportsByKey, projectId: string, date: string) {
  const previousReports = Object.values(dailyReportsByKey)
    .filter(
      (report) =>
        report.projectId === projectId &&
        report.date < date &&
        normalizeDailyReportPayItemRows(report.payItemRows).some(dailyReportPayItemRowHasContent)
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
    Boolean(row.totalHours.trim()) ||
    row.driver ||
    row.passenger
  );
}

function dailyReportPayItemRowHasContent(row: DailyReportPayItemRow) {
  return Boolean(row.payItemId.trim()) || Boolean(row.quantity.trim());
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
      viewMode: parsed.viewMode === "calendar" || parsed.viewMode === "reports" ? parsed.viewMode : "entry"
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

  return "Standard User";
}

function buildSyncStatus(prefix: string, summary: ProcoreSyncSummary | undefined) {
  if (!summary) {
    return `${prefix} complete`;
  }

  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const queuedText = remainingNewProjects > 0 ? `, ${remainingNewProjects} queued` : "";

  return `${prefix}: ${summary.synced} synced, ${summary.failed} failed${queuedText}`;
}

function hasSyncWarnings(summary: ProcoreSyncSummary | undefined) {
  return Boolean(summary && (summary.failed > 0 || (summary.remainingNewProjects ?? 0) > 0));
}

function formatSyncSummaryLine(summary: ProcoreSyncSummary) {
  const remainingNewProjects = summary.remainingNewProjects ?? 0;
  const queuedText = remainingNewProjects > 0 ? `, ${remainingNewProjects} queued` : "";

  return `${summary.synced} synced, ${summary.skippedExisting} skipped, ${summary.failed} failed${queuedText}`;
}

async function postProjectsWithTimeout(path: string, timeoutMessage: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROCORE_SYNC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      signal: controller.signal
    });
    const data = (await response.json()) as ProjectsResponse;

    return { data, response };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getWeekStart(value: string) {
  const date = parseInputDate(value);
  const dayOfWeek = date.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  date.setDate(date.getDate() - daysFromMonday);

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

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const data = (await response.json()) as { error?: string };

    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function readDownloadFileName(headers: Headers) {
  const contentDisposition = headers.get("content-disposition") ?? "";
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);

  if (encodedMatch) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return quotedMatch?.[1] ?? plainMatch?.[1]?.trim();
}

function buildDailyReportUploadFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";

  return `${date}_${sanitizeDailyReportFileName(projectNumber)}_Daily_Report.pdf`;
}

function sanitizeDailyReportFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function exportPayItemSummaryToCsv(payItemRows: PayItemReportRow[]) {
  const headers = ["pay_item_code", "pay_item_name", "entries", "hours", "quantity", "avg_hours_per_unit"];
  const rows = payItemRows.map((row) => [
    row.code,
    row.name,
    row.entryCount,
    row.totalHours.toFixed(2),
    row.totalQuantity.toFixed(2),
    row.hoursPerUnit.toFixed(3)
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(",")).join("\r\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `time-allocation-summary-${todayInputValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
