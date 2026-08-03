import type { AuthUser } from "@/lib/auth/types";
import type {
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById,
  SyncLogEntry
} from "@/features/time-allocation/types";
import { readApiJson, type OkResponse } from "@/features/time-allocation/lib/api-utils";

type ProjectControlsResponse = {
  myJobsByUser?: MyJobsByUser;
  projectArchiveById?: ProjectArchiveById;
  projectBlacklistById?: ProjectBlacklistById;
  syncLog?: SyncLogEntry[];
  databaseConfigured?: boolean;
  error?: string;
};

type FieldUsersResponse = {
  databaseConfigured?: boolean;
  error?: string;
  users?: AuthUser[];
};

type AdminClearStagingDataResponse = {
  cleared?: Record<string, unknown>;
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
};

type AdminClearProjectCatalogResponse = {
  cleared?: {
    appSettings: number;
    legacyPayItems: number;
    legacyProjects: number;
    legacySyncState: number;
    payItems: number;
    projects: number;
    syncState: number;
  };
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
};

export async function loadDatabaseProjectControls() {
  try {
    const response = await fetch("/api/project-controls", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as ProjectControlsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      myJobsByUser: data.myJobsByUser ?? {},
      projectArchiveById: data.projectArchiveById ?? {},
      projectBlacklistById: data.projectBlacklistById ?? {},
      syncLog: data.syncLog ?? []
    };
  } catch {
    return null;
  }
}

export async function saveDatabaseMyJobs(userId: string, projectIds: string[]) {
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
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save My Projects.");
  }
}

export async function loadAssignableFieldUsers() {
  const response = await fetch("/api/field-users", {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as FieldUsersResponse;

  if (!response.ok || data.databaseConfigured === false) {
    throw new Error(data.error ?? "Unable to load Field users.");
  }

  return data.users ?? [];
}

export async function saveDatabaseProjectFieldUsers(projectId: string, fieldUserIds: string[]) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "assign_project_field_users",
      fieldUserIds,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as { assignedFieldUserIds?: string[]; error?: string; ok?: boolean };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save Field project access.");
  }

  return data.assignedFieldUserIds ?? fieldUserIds;
}

export async function saveDatabaseProjectBlacklist(projectId: string, blacklisted: boolean) {
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
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save project blacklist.");
  }
}

export async function saveDatabaseProjectArchive(projectId: string, archived: boolean) {
  const response = await fetch("/api/project-controls", {
    body: JSON.stringify({
      action: "set_archive",
      archived,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save project archive.");
  }
}

export async function saveDatabaseSyncLogEntry(syncLogEntry: SyncLogEntry) {
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
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save sync log.");
  }
}

export async function clearDatabaseStagingOperationalData() {
  const response = await fetch("/api/admin/clear-staging-data", {
    body: JSON.stringify({
      confirmation: "CLEAR_STAGING_DATA"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as AdminClearStagingDataResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear staging data.");
  }

  return data;
}

export async function clearDatabaseProjectCatalog() {
  const response = await fetch("/api/admin/clear-project-cache", {
    body: JSON.stringify({
      confirmation: "CLEAR_PROJECT_CATALOG"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as AdminClearProjectCatalogResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to clear the project catalog.");
  }

  return data;
}
