import { getSql } from "@/lib/db";

export type StoredMyJobsByUser = Record<string, string[]>;
export type StoredProjectBlacklistById = Record<string, true>;
export type StoredSyncLogEntry = {
  id: string;
  action: string;
  status: "success" | "warning" | "error";
  createdAt: string;
  message: string;
  summary?: unknown;
};

type MyJobRow = {
  user_id: string;
  project_id: string;
};

type ProjectBlacklistRow = {
  project_id: string;
};

type SyncLogRow = {
  id: string;
  action: string;
  status: string;
  created_at: string | null;
  message: string;
  summary: unknown;
  raw_log: unknown;
};

let projectControlTablesReady = false;

export async function readProjectControls() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProjectControlTables();

  const myJobRows = (await sql`
    select user_id, project_id
    from my_jobs
    order by user_id, project_id
  `) as MyJobRow[];

  const projectBlacklistRows = (await sql`
    select project_id
    from project_blacklist
    order by project_id
  `) as ProjectBlacklistRow[];

  const syncLogRows = (await sql`
    select
      id,
      action,
      status,
      created_at::text as created_at,
      message,
      summary,
      raw_log
    from sync_log_entries
    order by created_at desc nulls last, id desc
    limit 25
  `) as SyncLogRow[];

  const myJobsByUser: StoredMyJobsByUser = {};
  const projectBlacklistById: StoredProjectBlacklistById = {};

  for (const row of myJobRows) {
    myJobsByUser[row.user_id] = myJobsByUser[row.user_id] ?? [];
    myJobsByUser[row.user_id].push(row.project_id);
  }

  for (const row of projectBlacklistRows) {
    projectBlacklistById[row.project_id] = true;
  }

  return {
    myJobsByUser,
    projectBlacklistById,
    syncLog: syncLogRows.map(normalizeSyncLogRow).filter((entry) => entry !== null)
  };
}

export async function replaceProjectControls(
  myJobsByUser: StoredMyJobsByUser,
  projectBlacklistById: StoredProjectBlacklistById,
  syncLog: StoredSyncLogEntry[]
) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProjectControlTables();

  const normalizedMyJobs = normalizeMyJobsByUser(myJobsByUser);
  const normalizedProjectBlacklist = normalizeProjectBlacklist(projectBlacklistById);
  const normalizedSyncLog = normalizeSyncLog(syncLog);
  const queries = [sql`delete from my_jobs`, sql`delete from project_blacklist`, sql`delete from sync_log_entries`];

  for (const myJob of normalizedMyJobs) {
    queries.push(sql`
      insert into my_jobs (user_id, project_id, updated_at)
      values (${myJob.userId}, ${myJob.projectId}, now())
    `);
  }

  for (const projectId of normalizedProjectBlacklist) {
    queries.push(sql`
      insert into project_blacklist (project_id, blacklisted_at)
      values (${projectId}, now())
    `);
  }

  for (const logEntry of normalizedSyncLog) {
    queries.push(sql`
      insert into sync_log_entries (
        id,
        action,
        status,
        created_at,
        message,
        summary,
        raw_log,
        updated_at
      )
      values (
        ${logEntry.id},
        ${logEntry.action},
        ${logEntry.status},
        ${logEntry.createdAt}::timestamptz,
        ${logEntry.message},
        ${logEntry.summary === undefined ? null : JSON.stringify(logEntry.summary)}::jsonb,
        ${JSON.stringify(logEntry)}::jsonb,
        now()
      )
    `);
  }

  await sql.transaction(queries);

  return {
    myJobs: normalizedMyJobs.length,
    projectBlacklist: normalizedProjectBlacklist.length,
    syncLog: normalizedSyncLog.length
  };
}

async function ensureProjectControlTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (projectControlTablesReady) {
    return;
  }

  await sql`
    create table if not exists my_jobs (
      user_id text not null,
      project_id text not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, project_id)
    )
  `;

  await sql`
    create table if not exists project_blacklist (
      project_id text primary key,
      blacklisted_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists sync_log_entries (
      id text primary key,
      action text not null,
      status text not null,
      created_at timestamptz,
      message text not null,
      summary jsonb,
      raw_log jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists my_jobs_user_idx on my_jobs (user_id)`;
  await sql`create index if not exists sync_log_entries_created_at_idx on sync_log_entries (created_at)`;

  projectControlTablesReady = true;
}

function normalizeMyJobsByUser(myJobsByUser: StoredMyJobsByUser) {
  return Object.entries(myJobsByUser).flatMap(([userId, projectIds]) => {
    if (!userId || !Array.isArray(projectIds)) {
      return [];
    }

    return Array.from(new Set(projectIds))
      .filter((projectId) => typeof projectId === "string" && projectId.trim())
      .map((projectId) => ({
        projectId: projectId.trim(),
        userId
      }));
  });
}

function normalizeProjectBlacklist(projectBlacklistById: StoredProjectBlacklistById) {
  return Object.entries(projectBlacklistById)
    .filter(([projectId, blacklisted]) => Boolean(projectId) && Boolean(blacklisted))
    .map(([projectId]) => projectId);
}

function normalizeSyncLog(syncLog: StoredSyncLogEntry[]) {
  return syncLog
    .map((entry) => ({
      ...entry,
      action: readString(entry.action),
      createdAt: readValidTimestamp(entry.createdAt) ?? new Date().toISOString(),
      id: readString(entry.id),
      message: readString(entry.message),
      status: entry.status
    }))
    .filter(
      (entry) =>
        entry.id &&
        entry.action &&
        entry.message &&
        (entry.status === "success" || entry.status === "warning" || entry.status === "error")
    )
    .slice(0, 25);
}

function normalizeSyncLogRow(row: SyncLogRow) {
  const rawLog = asRecord(row.raw_log);
  const status = row.status;

  if (status !== "success" && status !== "warning" && status !== "error") {
    return null;
  }

  return {
    action: row.action,
    createdAt: row.created_at ?? readValidTimestamp(rawLog.createdAt) ?? new Date().toISOString(),
    id: row.id,
    message: row.message,
    status,
    ...(row.summary ? { summary: row.summary } : {})
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readValidTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}
