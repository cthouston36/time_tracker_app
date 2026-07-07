import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readAllocationEntries, replaceAllocationEntries } from "@/lib/allocation-entries-store";
import type { AllocationEntry } from "@/lib/procore/types";

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
