import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteAllocationEntriesForDay,
  deleteAllocationEntry,
  readAllocationEntries,
  replaceAllocationEntries,
  upsertAllocationEntries
} from "@/lib/allocation-entries-store";
import { readDayRecords } from "@/lib/day-record-store";
import type { AllocationEntry } from "@/lib/procore/types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading entries." }, { status: 401 });
  }

  const entries = await readAllocationEntries();

  if (!entries) {
    return NextResponse.json({
      databaseConfigured: false,
      entries: []
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    entries
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving entries." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required to replace all entries." }, { status: 403 });
  }

  const body = (await request.json()) as { entries?: AllocationEntry[] };

  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Missing entries." }, { status: 400 });
  }

  const result = await replaceAllocationEntries(body.entries);

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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving entries." }, { status: 401 });
  }

  const body = (await request.json()) as { entries?: AllocationEntry[] };

  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Missing entries." }, { status: 400 });
  }

  if (user.role !== "admin" && (await entriesTouchSubmittedDay(body.entries))) {
    return NextResponse.json({ error: "Submitted days must be reopened before entries can be changed." }, { status: 403 });
  }

  const result = await upsertAllocationEntries(body.entries);

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

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting entries." }, { status: 401 });
  }

  const entryId = request.nextUrl.searchParams.get("entryId")?.trim();
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
  const date = request.nextUrl.searchParams.get("date")?.trim();

  if (entryId) {
    if (user.role !== "admin" && (await entryIsSubmitted(entryId))) {
      return NextResponse.json({ error: "Submitted days must be reopened before entries can be deleted." }, { status: 403 });
    }

    const result = await deleteAllocationEntry(entryId);

    return NextResponse.json({
      databaseConfigured: Boolean(result),
      ok: true
    });
  }

  if (!projectId || !date || !ISO_DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Provide entryId or projectId and date." }, { status: 400 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete all entries for a day." }, { status: 403 });
  }

  const result = await deleteAllocationEntriesForDay(projectId, date);

  return NextResponse.json({
    databaseConfigured: Boolean(result),
    ok: true
  });
}

async function entriesTouchSubmittedDay(entries: AllocationEntry[]) {
  const dayRecords = await readDayRecords();

  if (!dayRecords) {
    return false;
  }

  return entries.some((entry) => dayRecords.daySubmissions[getDayKey(entry.projectId, entry.date)]?.status === "submitted");
}

async function entryIsSubmitted(entryId: string) {
  const entries = await readAllocationEntries();
  const entry = entries?.find((candidate) => candidate.id === entryId);

  if (!entry) {
    return false;
  }

  return entriesTouchSubmittedDay([entry]);
}

function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
}
