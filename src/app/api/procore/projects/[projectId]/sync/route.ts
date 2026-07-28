import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { addOrUpdateProjectFromNetSuite } from "@/lib/netsuite/projects";
import { readProjectControls } from "@/lib/project-controls-store";
import { readProcoreCache } from "@/lib/procore/cache";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();

  if (user?.role !== "admin" && user?.role !== "project_manager") {
    return NextResponse.json({ error: "Project Manager access is required." }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const projects = await addOrUpdateProjectFromNetSuite(projectId);
    const cache = await readProcoreCache();
    const projectControls = await readProjectControls();

    await recordAuditLog({
      action: "netsuite.project_sync_completed",
      actor: user,
      metadata: {
        projectId,
        syncedAt: cache?.syncedAt ?? null
      },
      targetId: projectId,
      targetType: "project",
      ...getAuditRequestMetadata(_request.headers)
    });

    return NextResponse.json({
      projectArchiveById: projectControls?.projectArchiveById ?? {},
      projects,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add or update project.";

    await recordAuditLog({
      action: "netsuite.project_sync_failed",
      actor: user,
      metadata: {
        error: message,
        projectId
      },
      targetId: projectId,
      targetType: "project",
      ...getAuditRequestMetadata(_request.headers)
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
