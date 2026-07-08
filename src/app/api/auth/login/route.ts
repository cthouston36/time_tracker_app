import { NextRequest, NextResponse } from "next/server";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getRequestIp,
  recordFailedLoginAttempt
} from "@/lib/auth/login-rate-limit";
import { setCurrentUser } from "@/lib/auth/session";
import { validateUserCredentials } from "@/lib/auth/users";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    password?: string;
  };
  const userId = body.userId ?? "";
  const ipAddress = getRequestIp(request.headers);
  const rateLimit = await checkLoginRateLimit({ ipAddress, userId });

  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const user = await validateUserCredentials(body.userId ?? "", body.password ?? "");

  if (!user) {
    const failedAttempt = await recordFailedLoginAttempt({ ipAddress, userId });

    if (failedAttempt.limited) {
      return rateLimitedResponse(failedAttempt.retryAfterSeconds);
    }

    return NextResponse.json({ error: "Invalid user ID or password." }, { status: 401 });
  }

  await clearLoginRateLimit({ ipAddress, userId: user.id });
  await setCurrentUser(user);

  return NextResponse.json({ user });
}

function rateLimitedResponse(retryAfterSeconds = 15 * 60) {
  return NextResponse.json(
    {
      error: `Too many failed sign-in attempts. Try again in ${formatRetryAfter(retryAfterSeconds)}.`
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
