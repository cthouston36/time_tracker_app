import { NextResponse } from "next/server";
import { getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { getProjectCache } from "@/lib/procore/projects";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in before loading projects." }, { status: 401 });
    }

    const cacheOptions =
      user.role === "project_manager" && user.netSuiteProjectManagerId
        ? { netSuiteProjectManagerId: user.netSuiteProjectManagerId }
        : {};
    const cache = await getProjectCache(cacheOptions);
    const projects = getAccessibleProjectsForUser(user, cache?.projects ?? []);

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
