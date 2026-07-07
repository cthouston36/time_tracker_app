import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readAppSetting, writeAppSetting } from "@/lib/db";

const APP_STATE_KEY = "time_allocation_app_state";

type StoredAppState = {
  state?: unknown;
  updatedAt?: string;
  updatedBy?: string;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading app state." }, { status: 401 });
  }

  const storedState = await readAppSetting<StoredAppState>(APP_STATE_KEY);

  return NextResponse.json({
    state: storedState?.state ?? null,
    updatedAt: storedState?.updatedAt,
    updatedBy: storedState?.updatedBy
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving app state." }, { status: 401 });
  }

  const body = (await request.json()) as { state?: unknown };

  if (!body || typeof body !== "object" || !("state" in body)) {
    return NextResponse.json({ error: "Missing app state." }, { status: 400 });
  }

  await writeAppSetting(APP_STATE_KEY, {
    state: body.state,
    updatedAt: new Date().toISOString(),
    updatedBy: user.id
  });

  return NextResponse.json({
    ok: true
  });
}
