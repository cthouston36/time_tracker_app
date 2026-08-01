import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import { getSql } from "@/lib/db";

const CONFIRMATION_TEXT = "CLEAR_PROJECT_CATALOG";
const PROJECT_CATALOG_SETTING_KEY = "project_catalog";
const LEGACY_PROCORE_CACHE_SETTING_KEY = "procore_cache";

export const runtime = "nodejs";

type ClearedProjectCatalogCounts = {
  appSettings: number;
  legacyPayItems: number;
  legacyProjects: number;
  legacySyncState: number;
  payItems: number;
  projects: number;
  syncState: number;
};

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as { confirmation?: string };

  if (body.confirmation !== CONFIRMATION_TEXT) {
    return NextResponse.json({ error: "Confirmation text did not match." }, { status: 400 });
  }

  const sql = getSql();

  if (!sql) {
    return NextResponse.json({ error: "Database is not configured for project catalog cleanup." }, { status: 503 });
  }

  const cleared: ClearedProjectCatalogCounts = {
    appSettings: 0,
    legacyPayItems: 0,
    legacyProjects: 0,
    legacySyncState: 0,
    payItems: 0,
    projects: 0,
    syncState: 0
  };

  if (await tableExists("project_pay_items")) {
    const rows = await sql`delete from project_pay_items returning id`;
    cleared.payItems = rows.length;
  }

  if (await tableExists("project_catalog")) {
    const rows = await sql`delete from project_catalog returning id`;
    cleared.projects = rows.length;
  }

  if (await tableExists("project_catalog_sync_state")) {
    const rows = await sql`
      delete from project_catalog_sync_state
      where key = ${PROJECT_CATALOG_SETTING_KEY}
        or key = ${LEGACY_PROCORE_CACHE_SETTING_KEY}
      returning key
    `;
    cleared.syncState = rows.length;
  }

  if (await tableExists("procore_pay_items")) {
    const rows = await sql`delete from procore_pay_items returning id`;
    cleared.legacyPayItems = rows.length;
  }

  if (await tableExists("procore_projects")) {
    const rows = await sql`delete from procore_projects returning id`;
    cleared.legacyProjects = rows.length;
  }

  if (await tableExists("procore_sync_state")) {
    const rows = await sql`
      delete from procore_sync_state
      where key = ${LEGACY_PROCORE_CACHE_SETTING_KEY}
      returning key
    `;
    cleared.legacySyncState = rows.length;
  }

  if (await tableExists("app_settings")) {
    const rows = await sql`
      delete from app_settings
      where key = ${PROJECT_CATALOG_SETTING_KEY}
        or key = ${LEGACY_PROCORE_CACHE_SETTING_KEY}
      returning key
    `;
    cleared.appSettings = rows.length;
  }

  await recordAuditLog({
    action: "admin.project_catalog_cleared",
    actor: currentUser,
    metadata: {
      cleared,
      preserved: [
        "users",
        "allocation_entries",
        "crew_members",
        "daily_reports",
        "daily_report_uploads",
        "day_records",
        "project_blacklist",
        "my_jobs",
        "sync_log_entries",
        "audit_log"
      ]
    },
    targetType: "project_catalog",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    cleared,
    databaseConfigured: true,
    ok: true
  });
}

async function tableExists(tableName: string) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    select to_regclass(${`public.${tableName}`}) as table_name
  `) as Array<{ table_name: string | null }>;

  return Boolean(rows[0]?.table_name);
}
