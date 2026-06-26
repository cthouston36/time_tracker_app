import { NextResponse } from "next/server";
import { readProcoreCache } from "@/lib/procore/cache";
import { syncProjectsFromProcore } from "@/lib/procore/projects";

export async function POST() {
  try {
    const result = await syncProjectsFromProcore();
    const cache = await readProcoreCache();

    return NextResponse.json({
      projects: result.projects,
      summary: result.summary,
      syncedAt: cache?.syncedAt ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Procore data.";

    return NextResponse.json(
      {
        error: message,
        projects: []
      },
      { status: 502 }
    );
  }
}
