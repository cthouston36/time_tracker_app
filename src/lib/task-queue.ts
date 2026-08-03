import { getSql } from "@/lib/db";

export const TASK_QUEUE_STATUSES = ["queued", "processing", "completed", "failed"] as const;

export type TaskQueueStatus = (typeof TASK_QUEUE_STATUSES)[number];

export const TASK_QUEUE_TYPES = [
  "netsuite.sync_all",
  "netsuite.sync_new",
  "netsuite.vendors_sync",
  "procore.daily_report_upload",
  "procore.job_image_upload"
] as const;

export type TaskQueueType = (typeof TASK_QUEUE_TYPES)[number];

export type TaskQueueTask = {
  actorName?: string;
  actorUserId?: string;
  attempts: number;
  createdAt: string;
  dedupeKey?: string;
  error?: string;
  id: string;
  lockedAt?: string;
  lockedBy?: string;
  maxAttempts: number;
  payload: Record<string, unknown>;
  priority: number;
  result?: Record<string, unknown>;
  runAfter: string;
  status: TaskQueueStatus;
  targetId?: string;
  targetType?: string;
  taskType: TaskQueueType;
  updatedAt: string;
};

export type TaskQueueMaintenanceStats = {
  cleanupCandidates: {
    completed: number;
    failed: number;
  };
  statuses: Record<TaskQueueStatus, number>;
  total: number;
};

export type TaskQueuePurgeResult = {
  completed: number;
  failed: number;
  total: number;
};

export type EnqueueTaskInput = {
  actorName?: string;
  actorUserId?: string;
  dedupeKey?: string;
  id?: string;
  maxAttempts?: number;
  payload: Record<string, unknown>;
  priority?: number;
  runAfter?: string;
  targetId?: string;
  targetType?: string;
  taskType: TaskQueueType;
};

type TaskQueueRow = {
  actor_name: string | null;
  actor_user_id: string | null;
  attempts: number | string;
  created_at: string;
  dedupe_key: string | null;
  error: string | null;
  id: string;
  locked_at: string | null;
  locked_by: string | null;
  max_attempts: number | string;
  payload: unknown;
  priority: number | string;
  result: unknown;
  run_after: string;
  status: string;
  target_id: string | null;
  target_type: string | null;
  task_type: string;
  updated_at: string;
};

let taskQueueTableReady = false;

const DEFAULT_COMPLETED_TASK_RETENTION_DAYS = 45;
const DEFAULT_FAILED_TASK_RETENTION_DAYS = 90;

export async function enqueueTask(input: EnqueueTaskInput) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();

  const normalizedInput = normalizeTaskInput(input);

  if (!normalizedInput) {
    throw new Error("Invalid task queue input.");
  }

  if (normalizedInput.dedupeKey) {
    const existingRows = (await sql`
      select
        id,
        task_type,
        status,
        priority,
        attempts,
        max_attempts,
        run_after::text as run_after,
        payload,
        result,
        error,
        actor_user_id,
        actor_name,
        target_id,
        target_type,
        dedupe_key,
        locked_at::text as locked_at,
        locked_by,
        created_at::text as created_at,
        updated_at::text as updated_at
      from task_queue
      where dedupe_key = ${normalizedInput.dedupeKey}
        and status in ('queued', 'processing')
      order by created_at desc
      limit 1
    `) as TaskQueueRow[];
    const existingTask = existingRows[0] ? normalizeTaskQueueRow(existingRows[0]) : null;

    if (existingTask?.status === "processing") {
      return existingTask;
    }

    if (existingTask) {
      const updatedRows = (await sql`
        update task_queue
        set actor_name = ${normalizedInput.actorName ?? null},
            actor_user_id = ${normalizedInput.actorUserId ?? null},
            error = null,
            max_attempts = ${normalizedInput.maxAttempts},
            payload = ${JSON.stringify(normalizedInput.payload)}::jsonb,
            priority = ${normalizedInput.priority},
            run_after = ${normalizedInput.runAfter}::timestamptz,
            target_id = ${normalizedInput.targetId ?? null},
            target_type = ${normalizedInput.targetType ?? null},
            updated_at = now()
        where id = ${existingTask.id}
        returning
          id,
          task_type,
          status,
          priority,
          attempts,
          max_attempts,
          run_after::text as run_after,
          payload,
          result,
          error,
          actor_user_id,
          actor_name,
          target_id,
          target_type,
          dedupe_key,
          locked_at::text as locked_at,
          locked_by,
          created_at::text as created_at,
          updated_at::text as updated_at
      `) as TaskQueueRow[];

      return normalizeTaskQueueRow(updatedRows[0]);
    }
  }

  const rows = (await sql`
    insert into task_queue (
      id,
      task_type,
      status,
      priority,
      attempts,
      max_attempts,
      run_after,
      payload,
      actor_user_id,
      actor_name,
      target_id,
      target_type,
      dedupe_key,
      created_at,
      updated_at
    )
    values (
      ${normalizedInput.id},
      ${normalizedInput.taskType},
      'queued',
      ${normalizedInput.priority},
      0,
      ${normalizedInput.maxAttempts},
      ${normalizedInput.runAfter}::timestamptz,
      ${JSON.stringify(normalizedInput.payload)}::jsonb,
      ${normalizedInput.actorUserId ?? null},
      ${normalizedInput.actorName ?? null},
      ${normalizedInput.targetId ?? null},
      ${normalizedInput.targetType ?? null},
      ${normalizedInput.dedupeKey ?? null},
      now(),
      now()
    )
    returning
      id,
      task_type,
      status,
      priority,
      attempts,
      max_attempts,
      run_after::text as run_after,
      payload,
      result,
      error,
      actor_user_id,
      actor_name,
      target_id,
      target_type,
      dedupe_key,
      locked_at::text as locked_at,
      locked_by,
      created_at::text as created_at,
      updated_at::text as updated_at
  `) as TaskQueueRow[];

  return normalizeTaskQueueRow(rows[0]);
}

export async function claimQueuedTasks({
  limit,
  workerId
}: {
  limit: number;
  workerId: string;
}) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();
  await releaseStaleProcessingTasks();

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
  const rows = (await sql`
    with next_tasks as (
      select id
      from task_queue
      where status = 'queued'
        and run_after <= now()
      order by priority desc, created_at asc
      limit ${safeLimit}
      for update skip locked
    )
    update task_queue
    set status = 'processing',
        locked_at = now(),
        locked_by = ${workerId},
        attempts = attempts + 1,
        updated_at = now()
    where id in (select id from next_tasks)
    returning
      id,
      task_type,
      status,
      priority,
      attempts,
      max_attempts,
      run_after::text as run_after,
      payload,
      result,
      error,
      actor_user_id,
      actor_name,
      target_id,
      target_type,
      dedupe_key,
      locked_at::text as locked_at,
      locked_by,
      created_at::text as created_at,
      updated_at::text as updated_at
  `) as TaskQueueRow[];

  return rows.map(normalizeTaskQueueRow).filter((task): task is TaskQueueTask => task !== null);
}

export async function completeTask(
  taskId: string,
  result: Record<string, unknown> = {},
  options: { clearPayload?: boolean } = {}
) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();

  await sql`
    update task_queue
    set status = 'completed',
        payload = case when ${Boolean(options.clearPayload)} then '{}'::jsonb else payload end,
        result = ${JSON.stringify(result)}::jsonb,
        error = null,
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = ${taskId}
  `;

  return true;
}

export async function failTask(task: TaskQueueTask, error: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();

  const shouldRetry = task.attempts < task.maxAttempts;
  const nextStatus: TaskQueueStatus = shouldRetry ? "queued" : "failed";
  const runAfter = shouldRetry ? new Date(Date.now() + calculateBackoffMs(task.attempts)).toISOString() : new Date().toISOString();
  const nextPayload = shouldRetry ? task.payload : {};

  await sql`
    update task_queue
    set status = ${nextStatus},
        run_after = ${runAfter}::timestamptz,
        payload = ${JSON.stringify(nextPayload)}::jsonb,
        error = ${error.slice(0, 2000)},
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = ${task.id}
  `;

  return {
    retrying: shouldRetry,
    runAfter,
    status: nextStatus
  };
}

export async function readTaskQueueMaintenanceStats({
  completedRetentionDays = DEFAULT_COMPLETED_TASK_RETENTION_DAYS,
  failedRetentionDays = DEFAULT_FAILED_TASK_RETENTION_DAYS
}: {
  completedRetentionDays?: number;
  failedRetentionDays?: number;
} = {}): Promise<TaskQueueMaintenanceStats | null> {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();

  const completedDays = normalizeRetentionDays(completedRetentionDays, DEFAULT_COMPLETED_TASK_RETENTION_DAYS);
  const failedDays = normalizeRetentionDays(failedRetentionDays, DEFAULT_FAILED_TASK_RETENTION_DAYS);
  const rows = (await sql`
    select
      count(*)::int as total,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (
        where status = 'completed'
          and updated_at < now() - (${completedDays}::int * interval '1 day')
      )::int as completed_cleanup_candidates,
      count(*) filter (
        where status = 'failed'
          and updated_at < now() - (${failedDays}::int * interval '1 day')
      )::int as failed_cleanup_candidates
    from task_queue
  `) as Array<{
    completed: number | string;
    completed_cleanup_candidates: number | string;
    failed: number | string;
    failed_cleanup_candidates: number | string;
    processing: number | string;
    queued: number | string;
    total: number | string;
  }>;
  const row = rows[0];

  return {
    cleanupCandidates: {
      completed: toInteger(row?.completed_cleanup_candidates),
      failed: toInteger(row?.failed_cleanup_candidates)
    },
    statuses: {
      completed: toInteger(row?.completed),
      failed: toInteger(row?.failed),
      processing: toInteger(row?.processing),
      queued: toInteger(row?.queued)
    },
    total: toInteger(row?.total)
  };
}

export async function purgeTaskQueueRecords({
  completedRetentionDays = DEFAULT_COMPLETED_TASK_RETENTION_DAYS,
  failedRetentionDays = DEFAULT_FAILED_TASK_RETENTION_DAYS
}: {
  completedRetentionDays?: number;
  failedRetentionDays?: number;
} = {}): Promise<TaskQueuePurgeResult | null> {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureTaskQueueTable();

  const completedDays = normalizeRetentionDays(completedRetentionDays, DEFAULT_COMPLETED_TASK_RETENTION_DAYS);
  const failedDays = normalizeRetentionDays(failedRetentionDays, DEFAULT_FAILED_TASK_RETENTION_DAYS);
  const rows = (await sql`
    with deleted as (
      delete from task_queue
      where (
          status = 'completed'
          and updated_at < now() - (${completedDays}::int * interval '1 day')
        )
        or (
          status = 'failed'
          and updated_at < now() - (${failedDays}::int * interval '1 day')
        )
      returning status
    )
    select
      count(*)::int as total,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'failed')::int as failed
    from deleted
  `) as Array<{
    completed: number | string;
    failed: number | string;
    total: number | string;
  }>;
  const row = rows[0];

  return {
    completed: toInteger(row?.completed),
    failed: toInteger(row?.failed),
    total: toInteger(row?.total)
  };
}

async function releaseStaleProcessingTasks() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    update task_queue
    set status = 'queued',
        locked_at = null,
        locked_by = null,
        run_after = now(),
        updated_at = now()
    where status = 'processing'
      and locked_at < now() - interval '15 minutes'
      and attempts < max_attempts
  `;

  await sql`
    update task_queue
    set status = 'failed',
        locked_at = null,
        locked_by = null,
        error = coalesce(error, 'Task timed out while processing.'),
        payload = '{}'::jsonb,
        updated_at = now()
    where status = 'processing'
      and locked_at < now() - interval '15 minutes'
      and attempts >= max_attempts
  `;
}

function normalizeRetentionDays(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 730);
}

function toInteger(value: number | string | undefined) {
  return Number(value ?? 0) || 0;
}

async function ensureTaskQueueTable() {
  const sql = getSql();

  if (!sql || taskQueueTableReady) {
    return;
  }

  await sql`
    create table if not exists task_queue (
      id text primary key,
      task_type text not null,
      status text not null default 'queued',
      priority integer not null default 0,
      attempts integer not null default 0,
      max_attempts integer not null default 5,
      run_after timestamptz not null default now(),
      payload jsonb not null default '{}'::jsonb,
      result jsonb,
      error text,
      actor_user_id text,
      actor_name text,
      target_id text,
      target_type text,
      dedupe_key text,
      locked_at timestamptz,
      locked_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists task_queue_ready_idx on task_queue (status, run_after, priority desc, created_at)`;
  await sql`create index if not exists task_queue_type_idx on task_queue (task_type, status)`;
  await sql`create index if not exists task_queue_target_idx on task_queue (target_type, target_id)`;
  await sql`create index if not exists task_queue_dedupe_idx on task_queue (dedupe_key)`;

  taskQueueTableReady = true;
}

function normalizeTaskInput(input: EnqueueTaskInput) {
  const taskType = isTaskQueueType(input.taskType) ? input.taskType : null;
  const priority = Number.isFinite(input.priority) ? Math.trunc(input.priority ?? 0) : 0;
  const maxAttempts = Math.min(Math.max(Math.trunc(input.maxAttempts ?? 5), 1), 20);
  const runAfter = normalizeTimestamp(input.runAfter) ?? new Date().toISOString();
  const id = readString(input.id) || crypto.randomUUID();

  if (!taskType || !id || !isRecord(input.payload)) {
    return null;
  }

  return {
    actorName: readOptionalString(input.actorName),
    actorUserId: readOptionalString(input.actorUserId),
    dedupeKey: readOptionalString(input.dedupeKey),
    id,
    maxAttempts,
    payload: sanitizeJsonRecord(input.payload),
    priority,
    runAfter,
    targetId: readOptionalString(input.targetId),
    targetType: readOptionalString(input.targetType),
    taskType
  };
}

function normalizeTaskQueueRow(row: TaskQueueRow | undefined): TaskQueueTask | null {
  if (!row || !isTaskQueueType(row.task_type) || !isTaskQueueStatus(row.status)) {
    return null;
  }

  return {
    attempts: Number(row.attempts) || 0,
    createdAt: row.created_at,
    id: row.id,
    maxAttempts: Number(row.max_attempts) || 1,
    payload: isRecord(row.payload) ? row.payload : {},
    priority: Number(row.priority) || 0,
    result: isRecord(row.result) ? row.result : undefined,
    runAfter: row.run_after,
    status: row.status,
    taskType: row.task_type,
    updatedAt: row.updated_at,
    ...(row.actor_name ? { actorName: row.actor_name } : {}),
    ...(row.actor_user_id ? { actorUserId: row.actor_user_id } : {}),
    ...(row.dedupe_key ? { dedupeKey: row.dedupe_key } : {}),
    ...(row.error ? { error: row.error } : {}),
    ...(row.locked_at ? { lockedAt: row.locked_at } : {}),
    ...(row.locked_by ? { lockedBy: row.locked_by } : {}),
    ...(row.target_id ? { targetId: row.target_id } : {}),
    ...(row.target_type ? { targetType: row.target_type } : {})
  };
}

function calculateBackoffMs(attempts: number) {
  const delaySeconds = Math.min(3600, Math.max(30, 30 * 2 ** Math.max(0, attempts - 1)));

  return delaySeconds * 1000;
}

function sanitizeJsonRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const text = readString(value);
  return text || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTaskQueueType(value: unknown): value is TaskQueueType {
  return typeof value === "string" && TASK_QUEUE_TYPES.includes(value as TaskQueueType);
}

function isTaskQueueStatus(value: unknown): value is TaskQueueStatus {
  return typeof value === "string" && TASK_QUEUE_STATUSES.includes(value as TaskQueueStatus);
}
