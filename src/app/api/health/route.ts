import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

const HEALTH_CHECK_TIMEOUT_MS = 4_000;

type HealthCheck = {
  latencyMs?: number;
  message?: string;
  status: "ok" | "warn" | "error" | "skipped";
};

type ProjectCatalogCheck = HealthCheck & {
  tables?: {
    payItems: boolean;
    projects: boolean;
    syncState: boolean;
  };
};

export async function GET() {
  const database = await checkDatabase();
  const projectCatalog = database.status === "ok" ? await checkProjectCatalogTables() : skippedCheck("Database check did not pass.");
  const hasError = [database, projectCatalog].some((check) => check.status === "error");
  const hasWarning = [database, projectCatalog].some((check) => check.status === "warn" || check.status === "skipped");
  const status = hasError ? "unhealthy" : hasWarning ? "degraded" : "ok";

  return NextResponse.json(
    {
      ok: !hasError,
      service: "time-tracker-app",
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      checks: {
        app: {
          status: "ok"
        },
        database,
        projectCatalog
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status: hasError ? 503 : 200
    }
  );
}

async function checkDatabase(): Promise<HealthCheck> {
  const startedAt = Date.now();
  const sql = getSql();

  if (!sql) {
    return {
      latencyMs: Date.now() - startedAt,
      message: "DATABASE_URL is not configured.",
      status: process.env.NODE_ENV === "production" ? "error" : "skipped"
    };
  }

  try {
    await withTimeout(sql`select 1 as ok`, HEALTH_CHECK_TIMEOUT_MS, "Database check timed out.");

    return {
      latencyMs: Date.now() - startedAt,
      status: "ok"
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Database check failed.",
      status: "error"
    };
  }
}

async function checkProjectCatalogTables(): Promise<ProjectCatalogCheck> {
  const startedAt = Date.now();
  const sql = getSql();

  if (!sql) {
    return skippedCheck("DATABASE_URL is not configured.");
  }

  try {
    const rows = (await withTimeout(
      sql`
        select
          to_regclass('public.project_catalog') is not null as projects,
          to_regclass('public.project_pay_items') is not null as pay_items,
          to_regclass('public.project_catalog_sync_state') is not null as sync_state
      `,
      HEALTH_CHECK_TIMEOUT_MS,
      "Project catalog table check timed out."
    )) as ProjectCatalogRow[];
    const row = rows[0];
    const tables = {
      payItems: Boolean(row?.pay_items),
      projects: Boolean(row?.projects),
      syncState: Boolean(row?.sync_state)
    };
    const allTablesReady = tables.projects && tables.payItems && tables.syncState;

    return {
      latencyMs: Date.now() - startedAt,
      message: allTablesReady ? undefined : "Project catalog tables have not all been created yet.",
      status: allTablesReady ? "ok" : "warn",
      tables
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Project catalog check failed.",
      status: "warn"
    };
  }
}

function skippedCheck(message: string): HealthCheck {
  return {
    message,
    status: "skipped"
  };
}

async function withTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

type ProjectCatalogRow = {
  pay_items: boolean;
  projects: boolean;
  sync_state: boolean;
}
