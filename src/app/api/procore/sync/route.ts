import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { syncProjectsFromNetSuite } from "@/lib/netsuite/projects";
import { readProjectControls } from "@/lib/project-controls-store";
import { readProcoreCache } from "@/lib/procore/cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncProjectsFromNetSuite();
    const cache = await readProcoreCache();
    const projectControls = await readProjectControls();

    await recordAuditLog({
      action: "netsuite.sync_new_completed",
      actor: user,
      metadata: {
        summary: result.summary,
        syncedAt: cache?.syncedAt ?? null
      },
      targetType: "netsuite_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      projectArchiveById: projectControls?.projectArchiveById ?? {},
      projects: result.projects,
      summary: result.summary,
      syncedAt: cache?.syncedAt ?? null
    });
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
