import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { syncAllProjectsFromNetSuite } from "@/lib/netsuite/projects";
import { readProcoreCache } from "@/lib/procore/cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncAllProjectsFromNetSuite();
    const cache = await readProcoreCache();

    await recordAuditLog({
      action: "netsuite.sync_all_completed",
      actor: user,
      metadata: {
        summary: result.summary,
        syncedAt: cache?.syncedAt ?? null
      },
      targetType: "netsuite_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      projects: result.projects,
      summary: result.summary,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync all NetSuite projects.";

    await recordAuditLog({
      action: "netsuite.sync_all_failed",
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
