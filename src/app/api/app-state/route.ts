import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { mirrorSharedAppStateToTables, type AppStateMirrorStatus } from "@/lib/app-state-normalized";
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

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required to load legacy app state." }, { status: 403 });
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

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required to save legacy app state." }, { status: 403 });
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

  let mirrorStatus: AppStateMirrorStatus | "failed" = "not_configured";

  try {
    mirrorStatus = await mirrorSharedAppStateToTables(body.state);
  } catch (error) {
    mirrorStatus = "failed";
    console.error("App state normalized table mirror failed", error);
  }

  await recordAuditLog({
    action: "app_state.replaced",
    actor: user,
    metadata: {
      mirrorStatus
    },
    targetType: "app_state",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    ok: true,
    mirrorStatus
  });
}
