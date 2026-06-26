import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readProcoreCache } from "@/lib/procore/cache";
import { addOrUpdateProjectFromProcore } from "@/lib/procore/projects";

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
    const projects = await addOrUpdateProjectFromProcore(projectId);
    const cache = await readProcoreCache();

    return NextResponse.json({
      projects,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add or update project.";

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
