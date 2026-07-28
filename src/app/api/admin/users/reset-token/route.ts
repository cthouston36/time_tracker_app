import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import { createPasswordResetToken } from "@/lib/auth/users";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim().toLowerCase() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Provide user ID." }, { status: 400 });
  }

  const result = await createPasswordResetToken(userId);

  if (result === null) {
    return NextResponse.json({ error: "Database is not configured for password resets." }, { status: 503 });
  }

  if (!result) {
    return NextResponse.json({ error: "No active user was found for that user ID." }, { status: 404 });
  }

  await recordAuditLog({
    action: "user.password_reset_token_created",
    actor: currentUser,
    metadata: {
      expiresAt: result.expiresAt
    },
    targetId: result.userId,
    targetType: "app_user",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    expiresAt: result.expiresAt,
    ok: true,
    token: result.token,
    userId: result.userId
  });
}
