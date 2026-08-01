import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import type { AuthUser } from "@/lib/auth/types";
import { insertSyncLogEntry, type StoredSyncLogEntry } from "@/lib/project-controls-store";
import { enqueueTask } from "@/lib/task-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
export const runtime = "nodejs";

const CRON_ACTOR: AuthUser = {
  firstName: "System",
  id: "system",
  lastName: "Cron",
  role: "admin"
};

export async function GET(request: NextRequest) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const projectTask = await enqueueTask({
    actorName: "System Cron",
    actorUserId: "system",
    dedupeKey: "netsuite-nightly-sync-all",
    maxAttempts: 4,
    payload: {
      actionName: "Nightly NetSuite Project Sync",
      actor: CRON_ACTOR,
      source: "nightly"
    },
    priority: 3,
    targetType: "netsuite_sync",
    taskType: "netsuite.sync_all"
  });
  const vendorTask = await enqueueTask({
    actorName: "System Cron",
    actorUserId: "system",
    dedupeKey: "netsuite-nightly-vendors-sync",
    maxAttempts: 4,
    payload: {
      actionName: "Nightly NetSuite Vendor Sync",
      actor: CRON_ACTOR,
      source: "nightly"
    },
    priority: 2,
    targetType: "netsuite_sync",
    taskType: "netsuite.vendors_sync"
  });

  if (!projectTask || !vendorTask) {
    return NextResponse.json({ error: "Database is not configured for queued NetSuite syncs." }, { status: 503 });
  }

  const syncLogEntry: StoredSyncLogEntry = {
    action: "Nightly NetSuite Sync",
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    message: "Nightly NetSuite sync queued.",
    status: "success",
    summary: {
      projectTaskId: projectTask.id,
      vendorTaskId: vendorTask.id
    }
  };

  await insertSyncLogEntry(syncLogEntry);
  await recordAuditLog({
    action: "netsuite.nightly_sync_queued",
    actor: CRON_ACTOR,
    metadata: {
      projectTaskId: projectTask.id,
      vendorTaskId: vendorTask.id
    },
    targetType: "netsuite_sync",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    ok: true,
    projectTaskId: projectTask.id,
    status: "queued",
    vendorTaskId: vendorTask.id
  });
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
