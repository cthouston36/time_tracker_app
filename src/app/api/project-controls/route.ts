import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  insertSyncLogEntry,
  readProjectControls,
  replaceMyJobsForUser,
  replaceProjectControls,
  setProjectBlacklist,
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

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving project controls." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    blacklisted?: boolean;
    projectId?: string;
    projectIds?: unknown;
    syncLogEntry?: StoredSyncLogEntry;
    userId?: string;
  };

  let result: boolean | null;

  if (body.action === "save_my_jobs") {
    const userId = body.userId?.trim() ?? "";

    if (!userId || !Array.isArray(body.projectIds)) {
      return NextResponse.json({ error: "Provide userId and projectIds." }, { status: 400 });
    }

    if (user.id !== userId && user.role !== "admin") {
      return NextResponse.json({ error: "You can only update your own My Jobs list." }, { status: 403 });
    }

    result = await replaceMyJobsForUser(userId, body.projectIds.filter((projectId) => typeof projectId === "string"));
  } else if (body.action === "set_blacklist") {
    const projectId = body.projectId?.trim() ?? "";

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can update the project blacklist." }, { status: 403 });
    }

    if (!projectId || typeof body.blacklisted !== "boolean") {
      return NextResponse.json({ error: "Provide projectId and blacklisted." }, { status: 400 });
    }

    result = await setProjectBlacklist(projectId, body.blacklisted);
  } else if (body.action === "add_sync_log") {
    if (user.role !== "admin" && user.role !== "project_manager") {
      return NextResponse.json({ error: "Only project managers and admins can add sync log entries." }, { status: 403 });
    }

    if (!isRecord(body.syncLogEntry)) {
      return NextResponse.json({ error: "Missing sync log entry." }, { status: 400 });
    }

    result = await insertSyncLogEntry(body.syncLogEntry as StoredSyncLogEntry);
  } else {
    return NextResponse.json({ error: "Unsupported project controls action." }, { status: 400 });
  }

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid project controls payload." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
