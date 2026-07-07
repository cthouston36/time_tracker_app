import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= neon(databaseUrl);

  return sqlClient;
}

export async function readAppSetting<TValue>(key: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAppSettingsTable();

  const rows = await sql`
    select value
    from app_settings
    where key = ${key}
    limit 1
  `;
  const value = rows[0]?.value;

  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as TValue;
  }

  return value as TValue;
}

export async function writeAppSetting(key: string, value: unknown) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensureAppSettingsTable();

  await sql`
    insert into app_settings (key, value, updated_at)
    values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_at = now()
  `;

  return true;
}

async function ensureAppSettingsTable() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
}
