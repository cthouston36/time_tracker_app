import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteDaySubmission,
  readDayRecords,
  replaceDayRecords,
  upsertDayNotes,
  upsertDaySubmission,
  type StoredDayEntryNotes,
  type StoredDayEntryNotesByKey,
  type StoredDaySubmission,
  type StoredDaySubmissionsByKey
} from "@/lib/day-record-store";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading day records." }, { status: 401 });
  }

  const dayRecords = await readDayRecords();

  if (!dayRecords) {
    return NextResponse.json({
      databaseConfigured: false,
      dayEntryNotesByKey: {},
      daySubmissions: {}
    });
  }

  return NextResponse.json({
    ...dayRecords,
    databaseConfigured: true
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving day records." }, { status: 401 });
  }

  const body = (await request.json()) as {
    dayEntryNotesByKey?: StoredDayEntryNotesByKey;
    daySubmissions?: StoredDaySubmissionsByKey;
  };

  if (!body || !isRecord(body.dayEntryNotesByKey) || !isRecord(body.daySubmissions)) {
    return NextResponse.json({ error: "Missing day records." }, { status: 400 });
  }

  const result = await replaceDayRecords(body.daySubmissions, body.dayEntryNotesByKey);

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
    return NextResponse.json({ error: "Sign in before saving day records." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    date?: string;
    dayEntryNotes?: StoredDayEntryNotes;
    daySubmission?: StoredDaySubmission;
    projectId?: string;
  };
  const projectId = body.projectId?.trim() ?? "";
  const date = body.date?.trim() ?? "";

  if (!projectId || !ISO_DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Provide projectId and date." }, { status: 400 });
  }

  let result: boolean | null;

  if (body.action === "save_submission") {
    if (!isRecord(body.daySubmission)) {
      return NextResponse.json({ error: "Missing day submission." }, { status: 400 });
    }

    if (body.daySubmission.status === "draft" && user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can reopen submitted days." }, { status: 403 });
    }

    result = await upsertDaySubmission(projectId, date, body.daySubmission as StoredDaySubmission);
  } else if (body.action === "save_notes") {
    if (!isRecord(body.dayEntryNotes)) {
      return NextResponse.json({ error: "Missing day notes." }, { status: 400 });
    }

    result = await upsertDayNotes(projectId, date, body.dayEntryNotes as StoredDayEntryNotes);
  } else {
    return NextResponse.json({ error: "Unsupported day record action." }, { status: 400 });
  }

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid day record payload." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting day records." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete submitted day status." }, { status: 403 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";

  if (!projectId || !ISO_DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Provide projectId and date." }, { status: 400 });
  }

  const result = await deleteDaySubmission(projectId, date);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid day record payload." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
