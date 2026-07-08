import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readProcoreCache } from "@/lib/procore/cache";
import { getProjects } from "@/lib/procore/projects";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading Procore projects." }, { status: 401 });
  }

  try {
    const projects = await getProjects();
    const cache = await readProcoreCache();

    return NextResponse.json({
      projects,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Procore projects.";

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
