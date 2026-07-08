import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCachedProjectPayItems } from "@/lib/procore/projects";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading Procore pay items." }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const payItems = await getCachedProjectPayItems(projectId);
    return NextResponse.json({ payItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Procore pay items.";

    return NextResponse.json(
      {
        error: message,
        payItems: []
      },
      { status: 502 }
    );
  }
}
