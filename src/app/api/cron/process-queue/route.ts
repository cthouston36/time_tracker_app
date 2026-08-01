import { NextRequest, NextResponse } from "next/server";
import { processQueuedTasks } from "@/lib/task-queue-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const result = await processQueuedTasks({
    limit: 10,
    timeBudgetMs: 45_000
  });

  if (!result) {
    return NextResponse.json({ error: "Database is not configured for queued tasks." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    ...result
  });
}

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }

    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const expectedAuthorization = `Bearer ${cronSecret}`;

  if (request.headers.get("authorization") !== expectedAuthorization) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  return null;
}
