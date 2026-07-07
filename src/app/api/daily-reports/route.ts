import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteDailyReportUpload,
  readDailyReportData,
  replaceDailyReportData,
  upsertDailyReport,
  upsertDailyReportUpload,
  type StoredDailyReport,
  type StoredDailyReportUpload,
  type StoredDailyReportUploadsByKey,
  type StoredDailyReportsByKey
} from "@/lib/daily-report-store";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving daily reports." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    dailyReport?: StoredDailyReport;
    dailyReportUpload?: StoredDailyReportUpload;
    date?: string;
    projectId?: string;
  };
  const projectId = body.projectId?.trim() ?? "";
  const date = body.date?.trim() ?? "";

  if (!projectId || !ISO_DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Provide projectId and date." }, { status: 400 });
  }

  let result: boolean | null;

  if (body.action === "save_report") {
    if (!isRecord(body.dailyReport)) {
      return NextResponse.json({ error: "Missing daily report." }, { status: 400 });
    }

    result = await upsertDailyReport(projectId, date, body.dailyReport as StoredDailyReport);
  } else if (body.action === "save_upload") {
    if (!isRecord(body.dailyReportUpload)) {
      return NextResponse.json({ error: "Missing daily report upload." }, { status: 400 });
    }

    result = await upsertDailyReportUpload(projectId, date, body.dailyReportUpload as StoredDailyReportUpload);
  } else {
    return NextResponse.json({ error: "Unsupported daily report action." }, { status: 400 });
  }

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid daily report payload." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting daily reports." }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  const kind = request.nextUrl.searchParams.get("kind")?.trim() ?? "";

  if (!projectId || !ISO_DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Provide projectId and date." }, { status: 400 });
  }

  if (kind !== "upload") {
    return NextResponse.json({ error: "Unsupported daily report delete." }, { status: 400 });
  }

  const result = await deleteDailyReportUpload(projectId, date);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid daily report payload." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
