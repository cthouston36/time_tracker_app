"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Edit3,
  Info,
  ListChecks,
  LogOut,
  PlugZap,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { todayInputValue } from "@/lib/date";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/procore/types";

type ProjectsResponse = {
  projects: Project[];
  syncedAt?: string | null;
  summary?: ProcoreSyncSummary;
  error?: string;
};

type ProcoreSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skippedExisting: number;
  failedProjects: string[];
};

type SyncLogEntry = {
  id: string;
  action: string;
  status: "success" | "warning" | "error";
  createdAt: string;
  message: string;
  summary?: ProcoreSyncSummary;
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

type DaySubmission = {
  status: "draft" | "submitted";
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAt?: string;
};

type DaySubmissionsByKey = Record<string, DaySubmission>;

type MyJobsByUser = Record<string, string[]>;

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

type ViewMode = "entry" | "reports";

export function TimeAllocationWorkspace() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("entry");
  const [reportProjectId, setReportProjectId] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [mobileSelectedPayItemId, setMobileSelectedPayItemId] = useState("");
  const [workDate, setWorkDate] = useState(todayInputValue());
  const [entries, setEntries] = useState<AllocationEntry[]>([]);
  const [daySubmissions, setDaySubmissions] = useState<DaySubmissionsByKey>({});
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
  const [syncSummary, setSyncSummary] = useState<ProcoreSyncSummary | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const mobileSelectedPayItem = useMemo(
    () =>
      selectedProject?.payItems.find((payItem) => payItem.id === mobileSelectedPayItemId) ??
      selectedProject?.payItems[0] ??
      null,
    [mobileSelectedPayItemId, selectedProject]
  );

  const visibleEntries = entries.filter(
    (entry) => entry.projectId === selectedProject?.id && entry.date === workDate
  );
  const selectedProjectCrewMembers = selectedProject
    ? sortCrewMembersByName(crewMembersByProject[selectedProject.id] ?? [])
    : [];
  const existingCrewMemberOptions = selectedProject
    ? crewDirectory.filter((member) => !projectHasCrewMember(selectedProjectCrewMembers, member.id))
    : [];
  const crewSummaryRows = buildCrewSummary(visibleEntries, selectedProjectCrewMembers);
  const currentDaySubmission = daySubmissions[getDayKey(selectedProjectId, workDate)] ?? { status: "draft" };
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
  const currentUserMyJobIds = currentUser ? myJobsByUser[currentUser.id] ?? [] : [];
  const totalHours = visibleEntries.reduce((total, entry) => total + entry.hours, 0);
  const draftEntryCount = selectedProject
    ? selectedProject.payItems.filter((item) => draftIsSaveable(draftsByPayItem[item.id])).length
    : 0;

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

    async function loadProjects() {
      try {
        const response = await fetch("/api/procore/projects");
        const data = (await response.json()) as ProjectsResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load projects.");
        }

        const sortedProjects = sortProjectsByName(data.projects);
        const lastSelectedProjectId = window.localStorage.getItem(getLastProjectStorageKey(currentUserId));
        const nextSelectedProjectId = sortedProjects.some((project) => project.id === lastSelectedProjectId)
          ? lastSelectedProjectId ?? ""
          : sortedProjects[0]?.id ?? "";

        setProjects(sortedProjects);
        setSelectedProjectId(nextSelectedProjectId);
        setSyncedAt(data.syncedAt ?? null);
        setConnectionStatus(data.syncedAt ? "Cached Procore data loaded" : "No cached Procore data");
      } catch (error) {
        setProjectLoadError(error instanceof Error ? error.message : "Unable to load projects.");
      }
    }

    void loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedProjectId) {
      return;
    }

    window.localStorage.setItem(getLastProjectStorageKey(currentUser.id), selectedProjectId);
  }, [currentUser, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject?.payItems.length) {
      if (mobileSelectedPayItemId) {
        setMobileSelectedPayItemId("");
      }
      return;
    }

    if (!selectedProject.payItems.some((payItem) => payItem.id === mobileSelectedPayItemId)) {
      setMobileSelectedPayItemId(selectedProject.payItems[0].id);
    }
  }, [mobileSelectedPayItemId, selectedProject]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const savedEntries = window.localStorage.getItem("allocation-entries");
    const savedSubmissions = window.localStorage.getItem("day-submissions");
    const savedSyncLog = window.localStorage.getItem("procore-sync-log");
    const savedCrewMembers = window.localStorage.getItem("project-crew-members");
    const savedCrewDirectory = window.localStorage.getItem("crew-member-directory");
    const savedMyJobs = window.localStorage.getItem("my-jobs-by-user");
    let parsedCrewMembersByProject: CrewMembersByProject = {};

    if (savedEntries) {
      setEntries(JSON.parse(savedEntries) as AllocationEntry[]);
    }

    if (savedSubmissions) {
      setDaySubmissions(JSON.parse(savedSubmissions) as DaySubmissionsByKey);
    }

    if (savedSyncLog) {
      setSyncLog(JSON.parse(savedSyncLog) as SyncLogEntry[]);
    }

    if (savedCrewMembers) {
      parsedCrewMembersByProject = JSON.parse(savedCrewMembers) as CrewMembersByProject;
      setCrewMembersByProject(parsedCrewMembersByProject);
    }

    if (savedCrewDirectory) {
      setCrewDirectory(
        mergeCrewDirectories(
          JSON.parse(savedCrewDirectory) as CrewMember[],
          buildCrewDirectoryFromProjects(parsedCrewMembersByProject)
        )
      );
    } else {
      setCrewDirectory(buildCrewDirectoryFromProjects(parsedCrewMembersByProject));
    }

    if (savedMyJobs) {
      setMyJobsByUser(JSON.parse(savedMyJobs) as MyJobsByUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem("allocation-entries", JSON.stringify(entries));
    window.localStorage.setItem("day-submissions", JSON.stringify(daySubmissions));
    window.localStorage.setItem("crew-member-directory", JSON.stringify(crewDirectory));
    window.localStorage.setItem("project-crew-members", JSON.stringify(crewMembersByProject));
    window.localStorage.setItem("my-jobs-by-user", JSON.stringify(myJobsByUser));
  }, [currentUser, crewDirectory, crewMembersByProject, daySubmissions, entries, myJobsByUser]);

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
    await fetch("/api/auth/logout", {
      method: "POST"
    });

    setCurrentUser(null);
    setProjects([]);
    setSelectedProjectId("");
    setEntries([]);
    setDaySubmissions({});
    setMyJobsByUser({});
    setCrewDirectory([]);
    setCrewMembersByProject({});
    setSelectedExistingCrewMemberId("");
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId("");
    setEditingCrewMember(null);
    setViewMode("entry");
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
    setEntries((current) =>
      current.map((entry) => {
        if (!entry.crewAllocations?.length) {
          return entry;
        }

        return {
          ...entry,
          crewAllocations: entry.crewAllocations.map((allocation) =>
            allocation.crewMemberId === editingCrewMember.crewMemberId
              ? {
                  ...allocation,
                  crewMemberName: name,
                  jobTitle
                }
              : allocation
          )
        };
      })
    );
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

    setCrewDirectory((current) => current.filter((member) => member.id !== sourceCrewMember.id));
    setCrewMembersByProject((current) => mergeProjectCrewMembers(current, sourceCrewMember.id, targetCrewMember));
    setEntries((current) => current.map((entry) => mergeEntryCrewAllocations(entry, sourceCrewMember.id, targetCrewMember)));
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
    setSyncLog((current) =>
      [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...entry
        },
        ...current
      ].slice(0, 25)
    );
  }

  async function syncProcoreData() {
    setSyncing(true);
    setProjectLoadError("");
    setSyncSummary(null);

    try {
      const response = await fetch("/api/procore/sync", {
        method: "POST"
      });
      const data = (await response.json()) as ProjectsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync Procore data.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      setProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        sortedProjects.some((project) => project.id === currentProjectId) ? currentProjectId : sortedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(data.summary ?? null);
      const message = buildSyncStatus("New project sync", data.summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync New Projects",
        status: data.summary && data.summary.failed > 0 ? "warning" : "success",
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
      const response = await fetch("/api/procore/sync-all", {
        method: "POST"
      });
      const data = (await response.json()) as ProjectsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync all Procore projects.");
      }

      const sortedProjects = sortProjectsByName(data.projects);
      setProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        sortedProjects.some((project) => project.id === currentProjectId) ? currentProjectId : sortedProjects[0]?.id ?? ""
      );
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(data.summary ?? null);
      const message = buildSyncStatus("Full sync", data.summary);
      setConnectionStatus(message);
      setDraftsByPayItem({});
      addSyncLog({
        action: "Sync All Projects",
        status: data.summary && data.summary.failed > 0 ? "warning" : "success",
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
      setProjects(sortedProjects);
      setSelectedProjectId((currentProjectId) =>
        sortedProjects.some((project) => project.id === trimmedProjectId) ? trimmedProjectId : currentProjectId
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

  function saveAllocationEntries() {
    if (!selectedProject || !currentUser || dayIsSubmitted) {
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
    setDraftsByPayItem({});
    setEntryNotice(`${nextEntries.length} row${nextEntries.length === 1 ? "" : "s"} saved for ${formatDate(workDate)}.`);
  }

  function clearDraftInputs() {
    setDraftsByPayItem({});
    setEntryNotice("Draft inputs cleared.");
  }

  function removeEntry(entryId: string) {
    if (dayIsSubmitted) {
      return;
    }

    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  }

  function deleteSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject) {
      return;
    }

    const dayKey = getDayKey(selectedProject.id, workDate);

    setEntries((current) =>
      current.filter((entry) => !(entry.projectId === selectedProject.id && entry.date === workDate))
    );
    setDaySubmissions((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
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

  function saveEditedEntry() {
    if (!editingEntry || dayIsSubmitted || !currentUser) {
      return;
    }

    const hours = Number(editingEntry.hours);
    const quantity = Number(editingEntry.quantity);

    if (hours < 0 || quantity < 0 || !Number.isFinite(hours) || !Number.isFinite(quantity)) {
      return;
    }

    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== editingEntry.entryId) {
          return entry;
        }

        return {
          ...entry,
          hours,
          quantityCompleted: quantity,
          crewAllocations: scaleCrewAllocations(entry.crewAllocations ?? [], hours),
          savedByUserId: currentUser.id,
          savedByName: formatUserName(currentUser),
          savedAt: new Date().toISOString()
        };
      })
    );
    setEditingEntry(null);
    setEntryNotice("Daily allocation row updated.");
  }

  function submitDay() {
    if (!selectedProject || !currentUser || visibleEntries.length === 0) {
      return;
    }

    if (!window.confirm(`Submit ${selectedProject.name} for ${formatDate(workDate)}? This will lock the day for standard edits.`)) {
      return;
    }

    setDaySubmissions((current) => ({
      ...current,
      [getDayKey(selectedProject.id, workDate)]: {
        status: "submitted",
        submittedByUserId: currentUser.id,
        submittedByName: formatUserName(currentUser),
        submittedAt: new Date().toISOString()
      }
    }));
    setEditingEntry(null);
    setDraftsByPayItem({});
    setEntryNotice("Day submitted.");
  }

  function reopenSubmittedDay() {
    if (currentUser?.role !== "admin" || !selectedProject || !dayIsSubmitted) {
      return;
    }

    const dayKey = getDayKey(selectedProject.id, workDate);

    setDaySubmissions((current) => ({
      ...current,
      [dayKey]: {
        status: "draft"
      }
    }));
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
          <h1>Crew Time Allocation</h1>
          <p>Assign field hours and installed quantities to project pay items.</p>
        </div>
        <div className="header-actions">
          <span className="user-chip">
            {formatUserName(currentUser)} - {formatRole(currentUser.role)}
          </span>
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
              <a className="primary-button" href="/api/procore/oauth/login">
                <PlugZap aria-hidden="true" size={18} />
                Connect Procore
              </a>
            </>
          ) : null}
          <button className="secondary-button" onClick={logout} type="button">
            <LogOut aria-hidden="true" size={18} />
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel">
          {currentUser.role === "project_manager" || currentUser.role === "admin" ? (
            <div className="view-tabs" aria-label="View">
              <button
                className={viewMode === "entry" ? "tab-button active" : "tab-button"}
                onClick={() => setViewMode("entry")}
                type="button"
              >
                Entry
              </button>
              <button
                className={viewMode === "reports" ? "tab-button active" : "tab-button"}
                onClick={() => setViewMode("reports")}
                type="button"
              >
                <BarChart3 aria-hidden="true" size={16} />
                Reports
              </button>
            </div>
          ) : null}
          <h2>Job Setup</h2>
          <div className="field-group">
            <label htmlFor="project">Job</label>
            <select
              className="desktop-select"
              id="project"
              disabled={projects.length === 0}
              value={selectedProjectId}
              onChange={(event) => {
                setSelectedProjectId(event.target.value);
                setMobileSelectedPayItemId("");
                setEditingEntry(null);
                setEditingCrewMember(null);
                setSelectedExistingCrewMemberId("");
                setDraftsByPayItem({});
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <MobileOptionPicker
              disabled={projects.length === 0}
              label="Job"
              options={projects.map((project) => ({
                value: project.id,
                label: project.name
              }))}
              value={selectedProjectId}
              onChange={(value) => {
                setSelectedProjectId(value);
                setMobileSelectedPayItemId("");
                setEditingEntry(null);
                setEditingCrewMember(null);
                setSelectedExistingCrewMemberId("");
                setDraftsByPayItem({});
              }}
            />
          </div>
          {projects.length === 0 && !projectLoadError ? (
            <div className="empty-state">No projects with pay items returned from Procore.</div>
          ) : null}
          {projectLoadError ? <div className="inline-alert">{projectLoadError}</div> : null}
          {syncSummary ? <SyncSummaryCard summary={syncSummary} /> : null}
          {syncedAt ? (
            <div className="field-note">Last synced {new Date(syncedAt).toLocaleString()}</div>
          ) : (
            <div className="field-note">Use Sync New Projects to load uncached jobs and pay items.</div>
          )}
          {currentUser.role === "admin" ? <SyncLogPanel entries={syncLog} /> : null}

          <div className="field-group">
            <label htmlFor="work-date">Date</label>
            <div className="date-input-wrap">
              <input
                id="work-date"
                ref={dateInputRef}
                type="date"
                value={workDate}
                onChange={(event) => {
                  setWorkDate(event.target.value);
                  setEditingEntry(null);
                  setDraftsByPayItem({});
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
            <div className="crew-setup-heading">
              <h3>Crew Members</h3>
              <span>{selectedProjectCrewMembers.length}</span>
            </div>
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
        </aside>

        {viewMode === "entry" ? (
          <section className="allocation-grid">
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
              </div>
              {!selectedProject?.payItems.length ? <div className="empty-state">No pay items returned for this job.</div> : null}
              {selectedProject?.payItems.length ? (
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
                  {selectedProject.payItems.map((item) => {
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
              {selectedProject?.payItems.length && mobileSelectedPayItem ? (
                <MobilePayItemEntry
                  dayIsSubmitted={dayIsSubmitted}
                  draftsByPayItem={draftsByPayItem}
                  payItems={selectedProject.payItems}
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
                <h2>Daily Allocation</h2>
                <button
                  className="primary-button"
                  disabled={dayIsSubmitted || visibleEntries.length === 0}
                  onClick={submitDay}
                  type="button"
                >
                  <Send aria-hidden="true" size={18} />
                  Submit day
                </button>
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
          </section>
        ) : (
          <ReportsView
            currentUser={currentUser}
            daySubmissions={daySubmissions}
            entries={entries}
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
    </main>
  );
}

type MobileOption = {
  value: string;
  label: string;
};

function MobileOptionPicker({
  disabled = false,
  label,
  options,
  value,
  onChange
}: {
  disabled?: boolean;
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
          disabled={dayIsSubmitted}
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

type ReportMode = "summary" | "detail" | "crew" | "weekly_status";
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

function ReportsView({
  currentUser,
  daySubmissions,
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
  daySubmissions: DaySubmissionsByKey;
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
  const [weeklyStatusWeekStart, setWeeklyStatusWeekStart] = useState(getWeekStart(todayInputValue()));
  const [weeklyStatusProjectIds, setWeeklyStatusProjectIds] = useState<string[]>([]);
  const [weeklyStatusUseMyJobs, setWeeklyStatusUseMyJobs] = useState(false);
  const reportStartInputRef = useRef<HTMLInputElement>(null);
  const reportEndInputRef = useRef<HTMLInputElement>(null);
  const reportProjectOptions = buildReportProjectOptions(projects, entries);
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
            label: `My Jobs (${myJobIds.length})`
          }
        ]
      : []),
    ...reportProjectOptions.map((project) => ({
      value: project.id,
      label: project.name
    }))
  ];
  const filteredEntries = entries.filter((entry) => {
    const matchesProject =
      reportProjectId === "all" ||
      (reportProjectId === "my-jobs" ? myJobIds.includes(entry.projectId) : entry.projectId === reportProjectId);
    const matchesStart = !reportStartDate || entry.date >= reportStartDate;
    const matchesEnd = !reportEndDate || entry.date <= reportEndDate;

    return matchesProject && matchesStart && matchesEnd;
  });
  const payItemRows = buildPayItemReport(filteredEntries);

  return (
    <section className="allocation-grid">
      <div className="panel">
        <div className="panel-heading">
          <h2>{getReportTitle(reportMode)}</h2>
          {reportMode === "summary" ? (
            <button className="secondary-button" onClick={() => exportReportsToExcel(payItemRows)} type="button">
              <Download aria-hidden="true" size={18} />
              Export Excel
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
          <button
            className={reportMode === "weekly_status" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("weekly_status")}
            type="button"
          >
            Weekly Status
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
              Create/Update My Jobs ({myJobIds.length})
            </button>
          </div>
        ) : null}
        {myJobsEditorOpen ? (
          <MyJobsManager myJobIds={myJobIds} projects={projects} setMyJobIds={setMyJobIds} />
        ) : null}
        {reportMode === "crew" && crewPerformanceInfoOpen ? <CrewPerformanceInfo /> : null}
        {reportMode !== "weekly_status" ? (
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
        ) : null}
        {reportMode === "summary" ? (
          <PayItemReportTable entries={filteredEntries} projects={projects} rows={payItemRows} />
        ) : reportMode === "detail" ? (
          <DetailedPayItemReport
            detailGrouping={detailGrouping}
            detailPayItemQuery={detailPayItemQuery}
            detailSort={detailSort}
            entries={filteredEntries}
            projects={projects}
            setDetailGrouping={setDetailGrouping}
            setDetailPayItemQuery={setDetailPayItemQuery}
            setDetailSort={setDetailSort}
          />
        ) : reportMode === "weekly_status" ? (
          <WeeklyStatusReport
            daySubmissions={daySubmissions}
            myJobIds={myJobIds}
            projects={projects}
            selectedProjectIds={weeklyStatusProjectIds}
            setSelectedProjectIds={setWeeklyStatusProjectIds}
            setUseMyJobs={setWeeklyStatusUseMyJobs}
            setWeekStart={setWeeklyStatusWeekStart}
            useMyJobs={weeklyStatusUseMyJobs}
            weekStart={weeklyStatusWeekStart}
          />
        ) : (
          <CrewPerformanceReport entries={filteredEntries} projects={projects} />
        )}
      </div>
    </section>
  );
}

function MyJobsManager({
  myJobIds,
  projects,
  setMyJobIds
}: {
  myJobIds: string[];
  projects: Project[];
  setMyJobIds: (jobIds: string[]) => void;
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
          <strong>My Jobs</strong>
          <span>Tag the jobs you want to filter quickly in reports.</span>
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
  daySubmissions,
  myJobIds,
  projects,
  selectedProjectIds,
  setSelectedProjectIds,
  setUseMyJobs,
  setWeekStart,
  useMyJobs,
  weekStart
}: {
  daySubmissions: DaySubmissionsByKey;
  myJobIds: string[];
  projects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (projectIds: string[]) => void;
  setUseMyJobs: (useMyJobs: boolean) => void;
  setWeekStart: (weekStart: string) => void;
  useMyJobs: boolean;
  weekStart: string;
}) {
  const sortedProjects = sortProjectsByName(projects);
  const weekDates = getWeekDates(weekStart);
  const activeProjectIds = useMyJobs ? myJobIds : selectedProjectIds;
  const activeProjectIdSet = new Set(activeProjectIds);
  const visibleProjects = sortedProjects.filter((project) => activeProjectIdSet.has(project.id));
  const selectedLabel = useMyJobs
    ? `My Jobs (${myJobIds.length})`
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
                disabled={myJobIds.length === 0}
                onChange={(event) => setUseMyJobs(event.target.checked)}
                type="checkbox"
              />
              <span>My Jobs{myJobIds.length === 0 ? " (none tagged)" : ""}</span>
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
      </div>
      {visibleProjects.length === 0 ? (
        <div className="empty-state">Select one or more jobs, or tag My Jobs, to view weekly status.</div>
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
                const status = daySubmissions[getDayKey(project.id, date)]?.status ?? "draft";

                return (
                  <span className={`status-badge ${status}`} data-label={formatWeekDayLabel(date)} key={date}>
                    {status === "submitted" ? "Submitted" : "Draft"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayItemReportTable({
  entries,
  projects,
  rows
}: {
  entries: AllocationEntry[];
  projects: Project[];
  rows: PayItemReportRow[];
}) {
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
        const jobRollupRows = expanded
          ? buildPayItemJobRollupRows(
              entries.filter((entry) => getPayItemReportKey(entry) === row.key),
              projects
            )
          : [];

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
  detailPayItemQuery,
  detailSort,
  entries,
  projects,
  setDetailGrouping,
  setDetailPayItemQuery,
  setDetailSort
}: {
  detailGrouping: DetailGrouping;
  detailPayItemQuery: string;
  detailSort: DetailSort;
  entries: AllocationEntry[];
  projects: Project[];
  setDetailGrouping: (grouping: DetailGrouping) => void;
  setDetailPayItemQuery: (query: string) => void;
  setDetailSort: (sort: DetailSort) => void;
}) {
  const payItemOptions = buildReportPayItemOptions(entries);
  const normalizedQuery = detailPayItemQuery.trim().toLowerCase();
  const matchingEntries = normalizedQuery
    ? entries.filter((entry) => payItemMatchesQuery(entry, normalizedQuery))
    : [];
  const detailRows = normalizedQuery
    ? buildPayItemDetailAnalysisRows(matchingEntries, projects, detailGrouping, detailSort)
    : [];

  return (
    <div className="report-detail-analysis">
      <div className="report-detail-controls">
        <div className="field-group">
          <label htmlFor="detail-pay-item-select">Pay Item</label>
          <select
            id="detail-pay-item-select"
            disabled={payItemOptions.length === 0}
            value={payItemOptions.some((option) => option.query === detailPayItemQuery) ? detailPayItemQuery : ""}
            onChange={(event) => setDetailPayItemQuery(event.target.value)}
          >
            <option value="">
              {payItemOptions.length === 0 ? "No pay items with entries" : "Select pay item"}
            </option>
            {payItemOptions.map((option) => (
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

function CrewPerformanceReport({ entries, projects }: { entries: AllocationEntry[]; projects: Project[] }) {
  const [expandedCrewMemberId, setExpandedCrewMemberId] = useState<string | null>(null);
  const rows = buildCrewPerformanceRows(entries, projects);

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

function SyncSummaryCard({ summary }: { summary: ProcoreSyncSummary }) {
  return (
    <div className={summary.failed > 0 ? "sync-summary warning" : "sync-summary"}>
      <strong>
        Synced {summary.synced} of {summary.attempted} attempted project{summary.attempted === 1 ? "" : "s"}
      </strong>
      <span>{summary.skippedExisting} existing project{summary.skippedExisting === 1 ? "" : "s"} skipped.</span>
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
                <span>
                  {entry.summary.synced} synced, {entry.summary.skippedExisting} skipped, {entry.summary.failed} failed
                </span>
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

function buildPayItemReport(entries: AllocationEntry[]): PayItemReportRow[] {
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

  return Array.from(rows.values()).sort((a, b) => b.hoursPerUnit - a.hoursPerUnit);
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

  if (reportMode === "weekly_status") {
    return "Weekly Job Status";
  }

  return "Pay Item Production Report";
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
    "Select two different"
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

function getLastProjectStorageKey(userId: string) {
  return `last-selected-project-${userId}`;
}

function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
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

  return `${prefix}: ${summary.synced} synced, ${summary.failed} failed`;
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

function exportReportsToExcel(payItemRows: PayItemReportRow[]) {
  const html = `
    <html>
      <body>
        <h1>Pay Item Production Report</h1>
        ${buildExcelTable(
          ["Pay Item", "Entries", "Hours", "Quantity", "Avg Hrs / Unit"],
          payItemRows.map((row) => [
            `${row.code} - ${row.name}`,
            row.entryCount,
            row.totalHours.toFixed(2),
            row.totalQuantity.toFixed(2),
            row.hoursPerUnit.toFixed(3)
          ])
        )}
      </body>
    </html>
  `;
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `time-allocation-report-${todayInputValue()}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildExcelTable(headers: string[], rows: Array<Array<string | number>>) {
  return `
    <table border="1">
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
