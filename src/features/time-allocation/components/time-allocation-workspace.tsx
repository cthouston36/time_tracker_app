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
};

type DraftsByPayItem = Record<string, PayItemDraft>;

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
  const [draftsByPayItem, setDraftsByPayItem] = useState<DraftsByPayItem>({});
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
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

    if (savedEntries) {
      setEntries(JSON.parse(savedEntries) as AllocationEntry[]);
    }

    if (savedSubmissions) {
      setDaySubmissions(JSON.parse(savedSubmissions) as DaySubmissionsByKey);
    }

    if (savedSyncLog) {
      setSyncLog(JSON.parse(savedSyncLog) as SyncLogEntry[]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem("allocation-entries", JSON.stringify(entries));
    window.localStorage.setItem("day-submissions", JSON.stringify(daySubmissions));
  }, [currentUser, daySubmissions, entries]);

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
    setViewMode("entry");
  }

  function updateDraft(payItemId: string, field: keyof PayItemDraft, value: string) {
    setEntryNotice("");
    setDraftsByPayItem((current) => ({
      ...current,
      [payItemId]: {
        hours: current[payItemId]?.hours ?? "",
        quantity: current[payItemId]?.quantity ?? "",
        [field]: value
      }
    }));
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
      current.map((entry) =>
        entry.id === editingEntry.entryId
          ? {
              ...entry,
              hours,
              quantityCompleted: quantity,
              savedByUserId: currentUser.id,
              savedByName: formatUserName(currentUser),
              savedAt: new Date().toISOString()
            }
          : entry
      )
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
              <button className="secondary-button" disabled={syncing} onClick={syncProcoreData} type="button">
                <RefreshCw aria-hidden="true" size={18} />
                {syncing ? "Syncing..." : "Sync New Projects"}
              </button>
              {currentUser.role === "admin" ? (
                <button className="secondary-button" disabled={syncingAll} onClick={syncAllProcoreData} type="button">
                  <RefreshCw aria-hidden="true" size={18} />
                  {syncingAll ? "Syncing All..." : "Sync All Projects"}
                </button>
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
                    <span>Hours</span>
                    <span>Quantity</span>
                  </div>
                  {selectedProject.payItems.map((item) => {
                    const draft = draftsByPayItem[item.id] ?? { hours: "", quantity: "" };
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
                          value={draft.hours}
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
                          value={draft.quantity}
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
                  onDraftChange={updateDraft}
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
              {entryNotice ? <div className={entryNotice.includes("Enter both") ? "inline-alert" : "success-alert"}>{entryNotice}</div> : null}
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

function MobilePayItemEntry({
  dayIsSubmitted,
  draftsByPayItem,
  payItems,
  savedEntries,
  selectedPayItem,
  onDraftChange,
  onSelectedPayItemChange
}: {
  dayIsSubmitted: boolean;
  draftsByPayItem: DraftsByPayItem;
  payItems: Project["payItems"];
  savedEntries: AllocationEntry[];
  selectedPayItem: Project["payItems"][number];
  onDraftChange: (payItemId: string, field: keyof PayItemDraft, value: string) => void;
  onSelectedPayItemChange: (payItemId: string) => void;
}) {
  const draft = draftsByPayItem[selectedPayItem.id] ?? { hours: "", quantity: "" };
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
            value={draft.hours}
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
            value={draft.quantity}
            onChange={(event) => onDraftChange(selectedPayItem.id, "quantity", event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </div>
      </div>
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
