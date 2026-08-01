import { NextResponse } from "next/server";
import { getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { readProjectControls } from "@/lib/project-controls-store";
import { getProjectCatalog } from "@/lib/project-catalog/projects";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in before loading projects." }, { status: 401 });
    }

    const projectControls = await readProjectControls();
    const assignedProjectIdsByUser = projectControls?.myJobsByUser ?? {};
    const cacheOptions =
      user.role === "project_manager" && user.netSuiteProjectManagerId
        ? { netSuiteProjectManagerId: user.netSuiteProjectManagerId }
        : user.role === "standard"
          ? { projectIds: assignedProjectIdsByUser[user.id] ?? [] }
          : {};
    const cache = await getProjectCatalog(cacheOptions);
    const projects = getAccessibleProjectsForUser(user, cache?.projects ?? [], { assignedProjectIdsByUser });

    return NextResponse.json({
      projects,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load projects.";

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
