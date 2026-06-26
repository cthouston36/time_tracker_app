import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readProcoreCache } from "@/lib/procore/cache";
import { syncAllProjectsFromProcore } from "@/lib/procore/projects";

export async function POST() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncAllProjectsFromProcore();
    const cache = await readProcoreCache();

    return NextResponse.json({
      projects: result.projects,
      summary: result.summary,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync all Procore projects.";

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
