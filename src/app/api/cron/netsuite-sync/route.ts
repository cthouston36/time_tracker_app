import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import type { AuthUser } from "@/lib/auth/types";
import { syncAllProjectsFromNetSuite, type NetSuiteSyncSummary } from "@/lib/netsuite/projects";
import { syncNetSuiteVendors } from "@/lib/netsuite/vendors";
import { insertSyncLogEntry, type StoredSyncLogEntry } from "@/lib/project-controls-store";
import { readProcoreCache } from "@/lib/procore/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const CRON_ACTOR: AuthUser = {
  firstName: "System",
  id: "system",
  lastName: "Cron",
  role: "admin"
};

type NightlySyncSummary = {
  projects?: NetSuiteSyncSummary;
  syncedAt?: string | null;
  vendors?: {
    synced: number;
    syncedAt: string | null;
  };
};

type NightlySyncFailure = {
  error: string;
  task: "projects" | "vendors";
};

export async function GET(request: NextRequest) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const failures: NightlySyncFailure[] = [];
  const summary: NightlySyncSummary = {};

  try {
    const projectResult = await syncAllProjectsFromNetSuite();
    const cache = await readProcoreCache();

    summary.projects = projectResult.summary;
    summary.syncedAt = cache?.syncedAt ?? null;
  } catch (error) {
    failures.push({
      error: error instanceof Error ? error.message : "Unable to sync NetSuite project data.",
      task: "projects"
    });
  }

  try {
    const vendorResult = await syncNetSuiteVendors();

    summary.vendors = {
      synced: vendorResult.vendors.length,
      syncedAt: vendorResult.syncedAt
    };
  } catch (error) {
    failures.push({
      error: error instanceof Error ? error.message : "Unable to sync NetSuite vendors.",
      task: "vendors"
    });
  }

  const status = failures.length === 0 ? "success" : summary.projects || summary.vendors ? "warning" : "error";
  const message = buildNightlySyncMessage(summary, failures);
  const syncLogEntry: StoredSyncLogEntry = {
    action: "Nightly NetSuite Sync",
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    message,
    status,
    summary: {
      ...summary,
      ...(failures.length ? { failures } : {})
    }
  };

  await insertSyncLogEntry(syncLogEntry);
  await recordAuditLog({
    action:
      status === "success"
        ? "netsuite.nightly_sync_completed"
        : status === "warning"
          ? "netsuite.nightly_sync_partially_completed"
          : "netsuite.nightly_sync_failed",
    actor: CRON_ACTOR,
    metadata: syncLogEntry.summary as Record<string, unknown>,
    targetType: "netsuite_sync",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json(
    {
      ok: status !== "error",
      message,
      status,
      summary: syncLogEntry.summary
    },
    { status: status === "error" ? 502 : 200 }
  );
}

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }

    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const expectedAuthorization = `Bearer ${cronSecret}`;

  if (request.headers.get("authorization") !== expectedAuthorization) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  return null;
}

function buildNightlySyncMessage(summary: NightlySyncSummary, failures: NightlySyncFailure[]) {
  const parts: string[] = [];

  if (summary.projects) {
    const archivedText =
      (summary.projects.autoArchivedProjects ?? 0) > 0
        ? `, ${summary.projects.autoArchivedProjects} archived inactive`
        : "";
    const unarchivedText =
      (summary.projects.autoUnarchivedProjects ?? 0) > 0
        ? `, ${summary.projects.autoUnarchivedProjects} unarchived active`
        : "";

    parts.push(`projects ${summary.projects.synced} synced, ${summary.projects.failed} failed${archivedText}${unarchivedText}`);
  }

  if (summary.vendors) {
    parts.push(`vendors ${summary.vendors.synced} synced`);
  }

  if (failures.length > 0) {
    parts.push(`failures: ${failures.map((failure) => `${failure.task}: ${failure.error}`).join("; ")}`);
  }

  return `Nightly NetSuite sync: ${parts.length > 0 ? parts.join("; ") : "no tasks completed"}`;
}
