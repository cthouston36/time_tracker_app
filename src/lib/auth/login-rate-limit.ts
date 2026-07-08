import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";

type LoginRateLimitInput = {
  ipAddress: string;
  userId: string;
};

type LoginRateLimitRow = {
  failed_attempts: number | string;
  first_failed_at: string;
  key: string;
  locked_until: string | null;
};

type LoginRateLimitDecision = {
  limited: boolean;
  retryAfterSeconds?: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOCKOUT_SECONDS = 15 * 60;
const CLEANUP_AFTER_SECONDS = 2 * 24 * 60 * 60;

const inMemoryLoginAttempts = new Map<
  string,
  {
    failedAttempts: number;
    firstFailedAt: number;
    lockedUntil: number | null;
    updatedAt: number;
  }
>();

let loginRateLimitTableReady = false;

export async function checkLoginRateLimit(input: LoginRateLimitInput) {
  const keys = getRateLimitKeys(input);

  if (keys.length === 0) {
    return { limited: false } satisfies LoginRateLimitDecision;
  }

  const sql = getSql();

  if (!sql) {
    return checkInMemoryLoginRateLimit(keys);
  }

  await ensureLoginRateLimitTable();
  await cleanupExpiredLoginRateLimits();

  const rows = (await sql`
    select key, failed_attempts, first_failed_at::text as first_failed_at, locked_until::text as locked_until
    from auth_login_rate_limits
    where key = any(${keys})
  `) as LoginRateLimitRow[];
  const now = Date.now();
  const retryAfterSeconds = rows
    .map((row) => getRetryAfterSeconds(row.locked_until, now))
    .filter((retryAfter): retryAfter is number => retryAfter !== null)
    .sort((a, b) => b - a)[0];

  return {
    limited: retryAfterSeconds !== undefined,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
  } satisfies LoginRateLimitDecision;
}

export async function recordFailedLoginAttempt(input: LoginRateLimitInput) {
  const keys = getRateLimitKeys(input);

  if (keys.length === 0) {
    return { limited: false } satisfies LoginRateLimitDecision;
  }

  const sql = getSql();

  if (!sql) {
    return recordInMemoryFailedLoginAttempt(keys);
  }

  await ensureLoginRateLimitTable();

  const rows = (await sql`
    select key, failed_attempts, first_failed_at::text as first_failed_at, locked_until::text as locked_until
    from auth_login_rate_limits
    where key = any(${keys})
  `) as LoginRateLimitRow[];
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const now = Date.now();
  const updatedRows = keys.map((key) => buildFailedAttemptUpdate(key, rowsByKey.get(key), now));
  const queries = updatedRows.map((row) => sql`
    insert into auth_login_rate_limits (
      key,
      failed_attempts,
      first_failed_at,
      locked_until,
      updated_at
    )
    values (
      ${row.key},
      ${row.failedAttempts},
      ${new Date(row.firstFailedAt).toISOString()}::timestamptz,
      ${row.lockedUntil ? new Date(row.lockedUntil).toISOString() : null}::timestamptz,
      now()
    )
    on conflict (key) do update
    set failed_attempts = excluded.failed_attempts,
        first_failed_at = excluded.first_failed_at,
        locked_until = excluded.locked_until,
        updated_at = now()
  `);

  await sql.transaction(queries);

  const retryAfterSeconds = updatedRows
    .map((row) => (row.lockedUntil ? Math.ceil((row.lockedUntil - now) / 1000) : null))
    .filter((retryAfter): retryAfter is number => retryAfter !== null)
    .sort((a, b) => b - a)[0];

  return {
    limited: retryAfterSeconds !== undefined,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
  } satisfies LoginRateLimitDecision;
}

export async function clearLoginRateLimit(input: LoginRateLimitInput) {
  const keys = getRateLimitKeys(input);

  if (keys.length === 0) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    for (const key of keys) {
      inMemoryLoginAttempts.delete(key);
    }
    return;
  }

  await ensureLoginRateLimitTable();
  await sql`
    delete from auth_login_rate_limits
    where key = any(${keys})
  `;
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

function checkInMemoryLoginRateLimit(keys: string[]) {
  cleanupExpiredInMemoryLoginRateLimits();

  const now = Date.now();
  const retryAfterSeconds = keys
    .map((key) => {
      const row = inMemoryLoginAttempts.get(key);
      return row?.lockedUntil ? Math.ceil((row.lockedUntil - now) / 1000) : null;
    })
    .filter((retryAfter): retryAfter is number => retryAfter !== null && retryAfter > 0)
    .sort((a, b) => b - a)[0];

  return {
    limited: retryAfterSeconds !== undefined,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
  } satisfies LoginRateLimitDecision;
}

function recordInMemoryFailedLoginAttempt(keys: string[]) {
  const now = Date.now();
  const updatedRows = keys.map((key) => {
    const existingRow = inMemoryLoginAttempts.get(key);
    const updatedRow = buildFailedAttemptUpdate(key, existingRow ? {
      failed_attempts: existingRow.failedAttempts,
      first_failed_at: new Date(existingRow.firstFailedAt).toISOString(),
      key,
      locked_until: existingRow.lockedUntil ? new Date(existingRow.lockedUntil).toISOString() : null
    } : undefined, now);

    inMemoryLoginAttempts.set(key, {
      failedAttempts: updatedRow.failedAttempts,
      firstFailedAt: updatedRow.firstFailedAt,
      lockedUntil: updatedRow.lockedUntil,
      updatedAt: now
    });

    return updatedRow;
  });
  const retryAfterSeconds = updatedRows
    .map((row) => (row.lockedUntil ? Math.ceil((row.lockedUntil - now) / 1000) : null))
    .filter((retryAfter): retryAfter is number => retryAfter !== null)
    .sort((a, b) => b - a)[0];

  return {
    limited: retryAfterSeconds !== undefined,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
  } satisfies LoginRateLimitDecision;
}

function buildFailedAttemptUpdate(key: string, row: LoginRateLimitRow | undefined, now: number) {
  const firstFailedAt = row ? Date.parse(row.first_failed_at) : now;
  const lockedUntil = row?.locked_until ? Date.parse(row.locked_until) : null;
  const windowHasExpired = !Number.isFinite(firstFailedAt) || now - firstFailedAt > getWindowSeconds() * 1000;
  const lockoutHasExpired = lockedUntil !== null && now >= lockedUntil;
  const shouldResetWindow = !row || windowHasExpired || lockoutHasExpired;
  const failedAttempts = shouldResetWindow ? 1 : Number(row.failed_attempts) + 1;
  const nextFirstFailedAt = shouldResetWindow ? now : firstFailedAt;
  const nextLockedUntil = failedAttempts >= getMaxAttempts() ? now + getLockoutSeconds() * 1000 : null;

  return {
    failedAttempts,
    firstFailedAt: nextFirstFailedAt,
    key,
    lockedUntil: nextLockedUntil
  };
}

async function ensureLoginRateLimitTable() {
  const sql = getSql();

  if (!sql || loginRateLimitTableReady) {
    return;
  }

  await sql`
    create table if not exists auth_login_rate_limits (
      key text primary key,
      failed_attempts integer not null default 0,
      first_failed_at timestamptz not null default now(),
      locked_until timestamptz,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists auth_login_rate_limits_updated_at_idx on auth_login_rate_limits (updated_at)`;

  loginRateLimitTableReady = true;
}

async function cleanupExpiredLoginRateLimits() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    delete from auth_login_rate_limits
    where updated_at < now() - (${CLEANUP_AFTER_SECONDS} * interval '1 second')
  `;
}

function cleanupExpiredInMemoryLoginRateLimits() {
  const now = Date.now();
  const cutoff = now - CLEANUP_AFTER_SECONDS * 1000;

  for (const [key, row] of inMemoryLoginAttempts) {
    if (row.updatedAt < cutoff) {
      inMemoryLoginAttempts.delete(key);
    }
  }
}

function getRateLimitKeys({ ipAddress, userId }: LoginRateLimitInput) {
  const normalizedUserId = userId.trim().toLowerCase();
  const normalizedIpAddress = ipAddress.trim().toLowerCase();
  const keys = [];

  if (normalizedUserId) {
    keys.push(hashRateLimitKey(`user:${normalizedUserId}`));
  }

  if (normalizedIpAddress) {
    keys.push(hashRateLimitKey(`ip:${normalizedIpAddress}`));
  }

  return keys;
}

function getRetryAfterSeconds(lockedUntil: string | null, now: number) {
  if (!lockedUntil) {
    return null;
  }

  const lockedUntilTime = Date.parse(lockedUntil);

  if (!Number.isFinite(lockedUntilTime) || lockedUntilTime <= now) {
    return null;
  }

  return Math.ceil((lockedUntilTime - now) / 1000);
}

function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getMaxAttempts() {
  return readPositiveInteger(process.env.AUTH_LOGIN_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
}

function getWindowSeconds() {
  return readPositiveInteger(process.env.AUTH_LOGIN_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS);
}

function getLockoutSeconds() {
  return readPositiveInteger(process.env.AUTH_LOGIN_LOCKOUT_SECONDS, DEFAULT_LOCKOUT_SECONDS);
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}
