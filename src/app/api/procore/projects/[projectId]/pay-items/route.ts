import { NextRequest, NextResponse } from "next/server";
import { userCanAccessProjectId } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { getCachedProjectPayItems, getProjects } from "@/lib/procore/projects";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading pay items." }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    if (!userCanAccessProjectId(user, projectId, await getProjects())) {
      return NextResponse.json({ error: "You do not have access to load pay items for this project." }, { status: 403 });
    }

    const payItems = await getCachedProjectPayItems(projectId);
    return NextResponse.json({ payItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load pay items.";

    return NextResponse.json(
      {
        error: message,
        payItems: []
      },
      { status: 502 }
    );
  }
}
