import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { readProcoreCache } from "@/lib/procore/cache";
import { syncAllProjectsFromProcore } from "@/lib/procore/projects";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncAllProjectsFromProcore();
    const cache = await readProcoreCache();

    await recordAuditLog({
      action: "procore.sync_all_completed",
      actor: user,
      metadata: {
        summary: result.summary,
        syncedAt: cache?.syncedAt ?? null
      },
      targetType: "procore_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      projects: result.projects,
      summary: result.summary,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync all Procore projects.";

    await recordAuditLog({
      action: "procore.sync_all_failed",
      actor: user,
      metadata: {
        error: message
      },
      targetType: "procore_sync",
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
