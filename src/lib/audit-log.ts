import { getSql } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/types";

export type AuditLogEntry = {
  action: string;
  actorName?: string;
  actorRole?: string;
  actorUserId?: string;
  createdAt: string;
  id: string;
  ipAddress?: string;
  metadata: Record<string, unknown>;
  targetId?: string;
  targetType?: string;
  userAgent?: string;
};

type AuditLogInput = {
  action: string;
  actor?: AuthUser | null;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  targetId?: string;
  targetType?: string;
  userAgent?: string;
};

type AuditLogRow = {
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  actor_user_id: string | null;
  created_at: string;
  id: string;
  ip_address: string | null;
  metadata: unknown;
  target_id: string | null;
  target_type: string | null;
  user_agent: string | null;
};

let auditLogTableReady = false;

export async function recordAuditLog(input: AuditLogInput) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  try {
    await ensureAuditLogTable();

    await sql`
      insert into audit_log (
        id,
        action,
        actor_user_id,
        actor_name,
        actor_role,
        target_type,
        target_id,
        metadata,
        ip_address,
        user_agent,
        created_at
      )
      values (
        ${crypto.randomUUID()},
        ${input.action},
        ${input.actor?.id ?? null},
        ${input.actor ? formatActorName(input.actor) : null},
        ${input.actor?.role ?? null},
        ${input.targetType ?? null},
        ${input.targetId ?? null},
        ${JSON.stringify(normalizeMetadata(input.metadata))}::jsonb,
        ${input.ipAddress ?? null},
        ${input.userAgent ?? null},
        now()
      )
    `;

    return true;
  } catch (error) {
    console.error("Audit log write failed", error);
    return false;
  }
}

export async function listAuditLogs(limit = 200) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAuditLogTable();

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = (await sql`
    select
      id,
      action,
      actor_user_id,
      actor_name,
      actor_role,
      target_type,
      target_id,
      metadata,
      ip_address,
      user_agent,
      created_at::text as created_at
    from audit_log
    order by created_at desc
    limit ${safeLimit}
  `) as AuditLogRow[];

  return rows.map((row) => ({
    action: row.action,
    ...(row.actor_name ? { actorName: row.actor_name } : {}),
    ...(row.actor_role ? { actorRole: row.actor_role } : {}),
    ...(row.actor_user_id ? { actorUserId: row.actor_user_id } : {}),
    createdAt: row.created_at,
    id: row.id,
    ...(row.ip_address ? { ipAddress: row.ip_address } : {}),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    ...(row.target_id ? { targetId: row.target_id } : {}),
    ...(row.target_type ? { targetType: row.target_type } : {}),
    ...(row.user_agent ? { userAgent: row.user_agent } : {})
  })) satisfies AuditLogEntry[];
}

export function getAuditRequestMetadata(headers: Headers) {
  return {
    ipAddress: getRequestIp(headers),
    userAgent: headers.get("user-agent")?.slice(0, 500) || undefined
  };
}

async function ensureAuditLogTable() {
  const sql = getSql();

  if (!sql || auditLogTableReady) {
    return;
  }

  await sql`
    create table if not exists audit_log (
      id text primary key,
      action text not null,
      actor_user_id text,
      actor_name text,
      actor_role text,
      target_type text,
      target_id text,
      metadata jsonb not null default '{}'::jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists audit_log_created_at_idx on audit_log (created_at desc)`;
  await sql`create index if not exists audit_log_actor_user_id_idx on audit_log (actor_user_id)`;
  await sql`create index if not exists audit_log_action_idx on audit_log (action)`;
  await sql`create index if not exists audit_log_target_idx on audit_log (target_type, target_id)`;

  auditLogTableReady = true;
}

function normalizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return {};
  }

  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || undefined;
}

function formatActorName(user: AuthUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
