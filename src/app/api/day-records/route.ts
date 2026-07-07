import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  readDayRecords,
  replaceDayRecords,
  type StoredDayEntryNotesByKey,
  type StoredDaySubmissionsByKey
} from "@/lib/day-record-store";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
