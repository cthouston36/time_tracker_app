import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { readProjectCatalog } from "@/lib/project-catalog/cache";
import { readProjectControls } from "@/lib/project-controls-store";
import { enqueueTask } from "@/lib/task-queue";
import { scheduleQueuedTaskProcessing } from "@/lib/task-queue-scheduler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const cache = await readProjectCatalog();
    const projectControls = await readProjectControls();
    const task = await enqueueTask({
      actorName: `${user.firstName} ${user.lastName}`.trim() || user.id,
      actorUserId: user.id,
      dedupeKey: "netsuite-sync-new",
      maxAttempts: 4,
      payload: {
        actionName: "Sync New Projects",
        actor: user,
        source: "manual"
      },
      priority: 5,
      targetType: "netsuite_sync",
      taskType: "netsuite.sync_new"
    });

    if (!task) {
      return NextResponse.json({ error: "Database is not configured for queued NetSuite syncs." }, { status: 503 });
    }

    scheduleQueuedTaskProcessing({
      limit: 1,
      timeBudgetMs: 45_000
    });

    await recordAuditLog({
      action: "netsuite.sync_new_queued",
      actor: user,
      metadata: {
        syncedAt: cache?.syncedAt ?? null,
        taskId: task.id
      },
      targetType: "netsuite_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      message: "Sync New Projects queued. The sync log will update when it finishes.",
      projectArchiveById: projectControls?.projectArchiveById ?? {},
      projects: cache?.projects ?? [],
      queued: true,
      syncedAt: cache?.syncedAt ?? null,
      taskId: task.id
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync NetSuite project data.";

    await recordAuditLog({
      action: "netsuite.sync_new_failed",
      actor: user,
      metadata: {
        error: message
      },
      targetType: "netsuite_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
