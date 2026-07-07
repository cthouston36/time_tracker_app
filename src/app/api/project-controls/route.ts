import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  readProjectControls,
  replaceProjectControls,
  type StoredMyJobsByUser,
  type StoredProjectBlacklistById,
  type StoredSyncLogEntry
} from "@/lib/project-controls-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading project controls." }, { status: 401 });
  }

  const projectControls = await readProjectControls();

  if (!projectControls) {
    return NextResponse.json({
      databaseConfigured: false,
      myJobsByUser: {},
      projectBlacklistById: {},
      syncLog: []
    });
  }

  return NextResponse.json({
    ...projectControls,
    databaseConfigured: true
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving project controls." }, { status: 401 });
  }

  const body = (await request.json()) as {
    myJobsByUser?: StoredMyJobsByUser;
    projectBlacklistById?: StoredProjectBlacklistById;
    syncLog?: StoredSyncLogEntry[];
  };

  if (!body || !isRecord(body.myJobsByUser) || !isRecord(body.projectBlacklistById) || !Array.isArray(body.syncLog)) {
    return NextResponse.json({ error: "Missing project controls." }, { status: 400 });
  }

  const result = await replaceProjectControls(body.myJobsByUser, body.projectBlacklistById, body.syncLog);

  if (!result) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true,
    ...result
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
