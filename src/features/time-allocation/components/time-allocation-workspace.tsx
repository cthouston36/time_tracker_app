"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Edit3,
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
  const [crewMembersByProject, setCrewMembersByProject] = useState<CrewMembersByProject>({});
  const [crewMemberName, setCrewMemberName] = useState("");
  const [crewMemberJobTitle, setCrewMemberJobTitle] = useState("");
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
  const selectedProjectCrewMembers = selectedProject ? crewMembersByProject[selectedProject.id] ?? [] : [];
  const crewSummaryRows = buildCrewSummary(visibleEntries, selectedProjectCrewMembers);
  const currentDaySubmission = daySubmissions[getDayKey(selectedProjectId, workDate)] ?? { status: "draft" };
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
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

        const lastSelectedProjectId = window.localStorage.getItem(getLastProjectStorageKey(currentUserId));
        const nextSelectedProjectId = data.projects.some((project) => project.id === lastSelectedProjectId)
          ? lastSelectedProjectId ?? ""
          : data.projects[0]?.id ?? "";

        setProjects(data.projects);
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
      setCrewMembersByProject(JSON.parse(savedCrewMembers) as CrewMembersByProject);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem("allocation-entries", JSON.stringify(entries));
    window.localStorage.setItem("day-submissions", JSON.stringify(daySubmissions));
    window.localStorage.setItem("project-crew-members", JSON.stringify(crewMembersByProject));
  }, [currentUser, crewMembersByProject, daySubmissions, entries]);

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
    setCrewMembersByProject({});
    setEditingCrewMember(null);
    setViewMode("entry");
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

    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: [
        ...(current[selectedProject.id] ?? []),
        {
          id: crypto.randomUUID(),
          name,
          jobTitle
        }
      ]
    }));
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setEditingCrewMember(null);
    setEntryNotice(`${name} added to ${selectedProject.name}.`);
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

    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: (current[selectedProject.id] ?? []).map((member) =>
        member.id === editingCrewMember.crewMemberId
          ? {
              ...member,
              name,
              jobTitle
            }
          : member
      )
    }));
    setEntries((current) =>
      current.map((entry) => {
        if (entry.projectId !== selectedProject.id || !entry.crewAllocations?.length) {
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
    setEntryNotice(`${name} updated across saved days for ${selectedProject.name}.`);
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

      setProjects(data.projects);
      setSelectedProjectId((currentProjectId) =>
        data.projects.some((project) => project.id === currentProjectId) ? currentProjectId : data.projects[0]?.id ?? ""
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

      setProjects(data.projects);
      setSelectedProjectId((currentProjectId) =>
        data.projects.some((project) => project.id === currentProjectId) ? currentProjectId : data.projects[0]?.id ?? ""
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

      setProjects(data.projects);
      setSelectedProjectId((currentProjectId) =>
        data.projects.some((project) => project.id === trimmedProjectId) ? trimmedProjectId : currentProjectId
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

                    return (
                      <div className="matrix-row" key={item.id} role="row">
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
            entries={entries}
            projects={projects}
            reportProjectId={reportProjectId}
            reportStartDate={reportStartDate}
            reportEndDate={reportEndDate}
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

      <div className="mobile-pay-item-card">
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

function ReportsView({
  entries,
  projects,
  reportProjectId,
  reportStartDate,
  reportEndDate,
  setReportProjectId,
  setReportStartDate,
  setReportEndDate
}: {
  entries: AllocationEntry[];
  projects: Project[];
  reportProjectId: string;
  reportStartDate: string;
  reportEndDate: string;
  setReportProjectId: (projectId: string) => void;
  setReportStartDate: (date: string) => void;
  setReportEndDate: (date: string) => void;
}) {
  const reportStartInputRef = useRef<HTMLInputElement>(null);
  const reportEndInputRef = useRef<HTMLInputElement>(null);
  const reportProjectOptions = buildReportProjectOptions(projects, entries);
  const filteredEntries = entries.filter((entry) => {
    const matchesProject = reportProjectId === "all" || entry.projectId === reportProjectId;
    const matchesStart = !reportStartDate || entry.date >= reportStartDate;
    const matchesEnd = !reportEndDate || entry.date <= reportEndDate;

    return matchesProject && matchesStart && matchesEnd;
  });
  const payItemRows = buildPayItemReport(filteredEntries);

  return (
    <section className="allocation-grid">
      <div className="panel">
        <div className="panel-heading">
          <h2>Pay Item Production Report</h2>
          <button className="secondary-button" onClick={() => exportReportsToExcel(payItemRows)} type="button">
            <Download aria-hidden="true" size={18} />
            Export Excel
          </button>
        </div>
        <div className="report-controls">
          <div className="field-group">
            <label htmlFor="report-project">Job</label>
            <select
              className="desktop-select"
              id="report-project"
              value={reportProjectId}
              onChange={(event) => setReportProjectId(event.target.value)}
            >
              <option value="all">All Jobs</option>
              {reportProjectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <MobileOptionPicker
              label="Report Job"
              options={[
                {
                  value: "all",
                  label: "All Jobs"
                },
                ...reportProjectOptions.map((project) => ({
                  value: project.id,
                  label: project.name
                }))
              ]}
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
        <PayItemReportTable entries={filteredEntries} projects={projects} rows={payItemRows} />
      </div>
    </section>
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
        const detailEntries = expanded
          ? entries
              .filter((entry) => getPayItemReportKey(entry) === row.key)
              .sort((a, b) => `${b.date}-${b.projectId}`.localeCompare(`${a.date}-${a.projectId}`))
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
                <div className="report-detail-row report-detail-header">
                  <span>Date</span>
                  <span>Job</span>
                  <span>Hours</span>
                  <span>Quantity</span>
                  <span>Saved By</span>
                </div>
                {detailEntries.map((entry) => (
                  <div className="report-detail-row" key={entry.id}>
                    <span data-label="Date">{formatDate(entry.date)}</span>
                    <span data-label="Job">{getEntryProjectName(entry, projects)}</span>
                    <span data-label="Hours">{entry.hours.toFixed(2)}</span>
                    <span data-label="Quantity">{entry.quantityCompleted.toFixed(2)}</span>
                    <span data-label="Saved By">{entry.savedByName ?? "-"}</span>
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
  if (!draftIsSaveable(draft)) {
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

function entryNoticeIsError(message: string) {
  return [
    "Add at least",
    "Crew member is already",
    "Crew allocated",
    "Enter both",
    "Enter valid",
    "One selected",
    "Remove duplicate",
    "Select at least"
  ].some((prefix) => message.startsWith(prefix));
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
