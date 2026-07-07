import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  readDailyReportData,
  replaceDailyReportData,
  type StoredDailyReportUploadsByKey,
  type StoredDailyReportsByKey
} from "@/lib/daily-report-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading daily reports." }, { status: 401 });
  }

  const dailyReportData = await readDailyReportData();

  if (!dailyReportData) {
    return NextResponse.json({
      dailyReportUploadsByKey: {},
      dailyReportsByKey: {},
      databaseConfigured: false
    });
  }

  return NextResponse.json({
    ...dailyReportData,
    databaseConfigured: true
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving daily reports." }, { status: 401 });
  }

  const body = (await request.json()) as {
    dailyReportUploadsByKey?: StoredDailyReportUploadsByKey;
    dailyReportsByKey?: StoredDailyReportsByKey;
  };

  if (!body || !isRecord(body.dailyReportsByKey) || !isRecord(body.dailyReportUploadsByKey)) {
    return NextResponse.json({ error: "Missing daily report data." }, { status: 400 });
  }

  const result = await replaceDailyReportData(body.dailyReportsByKey, body.dailyReportUploadsByKey);

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
