import { useCallback, useState } from "react";
import {
  postProjectsWithTimeout,
  readApiJson,
  saveDatabaseSyncLogEntry
} from "@/features/time-allocation/lib/api-client";
import {
  filterActiveProjects,
  normalizeSyncLogEntry,
  normalizeSyncSummary,
  projectMatchesIdentifier,
  sortProjectsByName
} from "@/features/time-allocation/lib/selectors";
import {
  buildSyncStatus,
  hasSyncWarnings
} from "@/features/time-allocation/lib/sync-status-helpers";
import type {
  ProjectArchiveById,
  ProjectBlacklistById,
  ProjectsResponse,
  SyncLogEntry
} from "@/features/time-allocation/types";
import type { Project } from "@/lib/domain/types";

type ApplySyncedProjectsOptions = {
  preferredProjectIdentifier?: string;
  projects: Project[];
  projectArchiveById: ProjectArchiveById;
};

export function useProjectSync({
  onConnectionStatus,
  onDraftsReset,
  onProjectArchiveChange,
  onProjectLoadError,
  onProjectsChange,
  onSelectedProjectChange,
  projectArchiveById,
  projectBlacklistById,
  selectedProjectId,
  userIsOffline
}: {
  onConnectionStatus: (message: string) => void;
  onDraftsReset: () => void;
  onProjectArchiveChange: (projectArchiveById: ProjectArchiveById) => void;
  onProjectLoadError: (message: string) => void;
  onProjectsChange: (projects: Project[]) => void;
  onSelectedProjectChange: (projectId: string | ((currentProjectId: string) => string)) => void;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  selectedProjectId: string;
  userIsOffline: boolean;
}) {
  const [syncSummary, setSyncSummary] = useState<ProjectsResponse["summary"] | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);

  const replaceSyncLog = useCallback((entries: SyncLogEntry[]) => {
    setSyncLog(entries);
  }, []);

  const resetProjectSyncState = useCallback(() => {
    setSyncedAt(null);
    setSyncSummary(null);
  }, []);

  const addSyncLog = useCallback(
    (entry: Omit<SyncLogEntry, "id" | "createdAt">) => {
      const syncLogEntry = normalizeSyncLogEntry({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...entry
      });

      if (!syncLogEntry) {
        return;
      }

      setSyncLog((current) => [syncLogEntry, ...current].slice(0, 25));
      void saveDatabaseSyncLogEntry(syncLogEntry).catch((error) => {
        onProjectLoadError(error instanceof Error ? error.message : "Sync log saved locally, but did not sync.");
      });
    },
    [onProjectLoadError]
  );

  const applySyncedProjects = useCallback(
    ({ preferredProjectIdentifier, projects, projectArchiveById: nextProjectArchiveById }: ApplySyncedProjectsOptions) => {
      const sortedProjects = sortProjectsByName(projects);
      const visibleSyncedProjects = filterActiveProjects(sortedProjects, projectBlacklistById, nextProjectArchiveById);
      const syncedProject = preferredProjectIdentifier
        ? visibleSyncedProjects.find((project) => projectMatchesIdentifier(project, preferredProjectIdentifier))
        : undefined;

      onProjectsChange(sortedProjects);
      onProjectArchiveChange(nextProjectArchiveById);
      onSelectedProjectChange((currentProjectId) => {
        if (syncedProject) {
          return syncedProject.id;
        }

        return visibleSyncedProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : visibleSyncedProjects[0]?.id ?? "";
      });
      onDraftsReset();
    },
    [onDraftsReset, onProjectArchiveChange, onProjectsChange, onSelectedProjectChange, projectBlacklistById]
  );

  const syncNewProjects = useCallback(async () => {
    if (userIsOffline) {
      onProjectLoadError("You appear to be offline. Reconnect before saving, syncing, or uploading.");
      return;
    }

    setSyncing(true);
    onProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/netsuite/sync",
        "Sync New Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync NetSuite project data.");
      }

      const nextProjectArchiveById = data.projectArchiveById ?? projectArchiveById;
      const summary = normalizeSyncSummary(data.summary);
      const message = buildSyncStatus("New project sync", summary);

      applySyncedProjects({
        projects: data.projects,
        projectArchiveById: nextProjectArchiveById
      });
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(summary ?? null);
      onConnectionStatus(message);
      addSyncLog({
        action: "Sync New Projects",
        status: hasSyncWarnings(summary) ? "warning" : "success",
        message,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync NetSuite project data.";
      onProjectLoadError(message);
      onConnectionStatus("Project sync failed");
      addSyncLog({
        action: "Sync New Projects",
        status: "error",
        message
      });
    } finally {
      setSyncing(false);
    }
  }, [
    addSyncLog,
    applySyncedProjects,
    onConnectionStatus,
    onProjectLoadError,
    projectArchiveById,
    userIsOffline
  ]);

  const syncAllProjects = useCallback(async () => {
    if (userIsOffline) {
      onProjectLoadError("You appear to be offline. Reconnect before saving, syncing, or uploading.");
      return;
    }

    setSyncingAll(true);
    onProjectLoadError("");
    setSyncSummary(null);

    try {
      const { data, response } = await postProjectsWithTimeout(
        "/api/netsuite/sync-all",
        "Sync All Projects timed out before the server returned. Try again, or use Add/Update Project for a specific job."
      );

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sync all NetSuite projects.");
      }

      const nextProjectArchiveById = data.projectArchiveById ?? projectArchiveById;
      const summary = normalizeSyncSummary(data.summary);
      const message = buildSyncStatus("Full sync", summary);

      applySyncedProjects({
        projects: data.projects,
        projectArchiveById: nextProjectArchiveById
      });
      setSyncedAt(data.syncedAt ?? null);
      setSyncSummary(summary ?? null);
      onConnectionStatus(message);
      addSyncLog({
        action: "Sync All Projects",
        status: hasSyncWarnings(summary) ? "warning" : "success",
        message,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync all NetSuite projects.";
      onProjectLoadError(message);
      onConnectionStatus("Full sync failed");
      addSyncLog({
        action: "Sync All Projects",
        status: "error",
        message
      });
    } finally {
      setSyncingAll(false);
    }
  }, [
    addSyncLog,
    applySyncedProjects,
    onConnectionStatus,
    onProjectLoadError,
    projectArchiveById,
    userIsOffline
  ]);

  const addOrUpdateProject = useCallback(async () => {
    if (userIsOffline) {
      onProjectLoadError("You appear to be offline. Reconnect before saving, syncing, or uploading.");
      return;
    }

    const projectId = window.prompt("Enter the NetSuite project ID or Procore project ID to add or update.", selectedProjectId);
    const trimmedProjectId = projectId?.trim();

    if (!trimmedProjectId) {
      return;
    }

    setUpdatingProject(true);
    onProjectLoadError("");
    setSyncSummary(null);

    try {
      const response = await fetch(`/api/netsuite/projects/${encodeURIComponent(trimmedProjectId)}/sync`, {
        method: "POST"
      });
      const data = (await readApiJson(response)) as ProjectsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add or update project.");
      }

      applySyncedProjects({
        preferredProjectIdentifier: trimmedProjectId,
        projects: data.projects,
        projectArchiveById: data.projectArchiveById ?? projectArchiveById
      });
      setSyncedAt(data.syncedAt ?? null);
      onConnectionStatus("Project added or updated");
      addSyncLog({
        action: "Add/Update Project",
        status: "success",
        message: `Project ${trimmedProjectId} added or updated`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add or update project.";
      onProjectLoadError(message);
      onConnectionStatus("Project add/update failed");
      addSyncLog({
        action: "Add/Update Project",
        status: "error",
        message
      });
    } finally {
      setUpdatingProject(false);
    }
  }, [
    addSyncLog,
    applySyncedProjects,
    onConnectionStatus,
    onProjectLoadError,
    projectArchiveById,
    selectedProjectId,
    userIsOffline
  ]);

  return {
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
  };
}
