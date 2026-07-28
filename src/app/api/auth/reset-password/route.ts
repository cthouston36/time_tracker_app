import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getRequestIp,
  recordFailedLoginAttempt
} from "@/lib/auth/login-rate-limit";
import { resetPasswordWithToken } from "@/lib/auth/users";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    newPassword?: string;
    token?: string;
    userId?: string;
  };

  const userId = body.userId?.trim().toLowerCase() ?? "";
  const token = body.token?.trim() ?? "";
  const newPassword = body.newPassword ?? "";

  if (!userId || !token || !newPassword) {
    return NextResponse.json({ error: "Enter user ID, reset code, and new password." }, { status: 400 });
  }

  const rateLimitInput = {
    ipAddress: `reset:${getRequestIp(request.headers)}`,
    userId: `reset:${userId}`
  };
  const rateLimit = await checkLoginRateLimit(rateLimitInput);

  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const result = await resetPasswordWithToken(userId, token, newPassword);

  if (result === "database_not_configured") {
    return NextResponse.json({ error: "Database is not configured for password resets." }, { status: 503 });
  }

  if (result === "invalid_new_password") {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  if (result === "invalid_user") {
    const failedAttempt = await recordFailedLoginAttempt(rateLimitInput);

    if (failedAttempt.limited) {
      return rateLimitedResponse(failedAttempt.retryAfterSeconds);
    }

    return NextResponse.json({ error: "No active user was found for that user ID." }, { status: 400 });
  }

  if (result === "invalid_token") {
    const failedAttempt = await recordFailedLoginAttempt(rateLimitInput);

    if (failedAttempt.limited) {
      return rateLimitedResponse(failedAttempt.retryAfterSeconds);
    }

    return NextResponse.json({ error: "Reset code is invalid or expired." }, { status: 400 });
  }

  await clearLoginRateLimit(rateLimitInput);

  await recordAuditLog({
    action: "user.password_reset_self_service",
    metadata: {
      resetByToken: true
    },
    targetId: userId,
    targetType: "app_user",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    ok: true
  });
}

function rateLimitedResponse(retryAfterSeconds = 15 * 60) {
  return NextResponse.json(
    {
      error: `Too many failed reset attempts. Try again in ${formatRetryAfter(retryAfterSeconds)}.`
    },
    {
      headers: {
        "Retry-After": String(retryAfterSeconds)
      },
      status: 429
    }
  );
}

function formatRetryAfter(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
