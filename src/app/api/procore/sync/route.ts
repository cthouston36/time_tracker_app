import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { readProcoreCache } from "@/lib/procore/cache";
import { syncProjectsFromProcore } from "@/lib/procore/projects";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncProjectsFromProcore();
    const cache = await readProcoreCache();

    await recordAuditLog({
      action: "procore.sync_new_completed",
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
    const message = error instanceof Error ? error.message : "Unable to sync Procore data.";

    await recordAuditLog({
      action: "procore.sync_new_failed",
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
