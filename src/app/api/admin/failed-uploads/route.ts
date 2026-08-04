import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readDailyReportData } from "@/lib/daily-report-store";
import { listUnresolvedFailedJobImageUploads } from "@/lib/job-image-store";
import { isRecord } from "@/lib/records";

export const runtime = "nodejs";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const [dailyReportData, jobImageFailures] = await Promise.all([
    readDailyReportData(),
    listUnresolvedFailedJobImageUploads(200)
  ]);

  if (!dailyReportData || !jobImageFailures) {
    return NextResponse.json({
      dailyReports: [],
      databaseConfigured: false,
      jobImages: []
    });
  }

  const dailyReports = Object.entries(dailyReportData.dailyReportUploadsByKey).flatMap(([dayKey, upload]) => {
    if (!isRecord(upload) || upload.status !== "failed") {
      return [];
    }

    const parsedDayKey = parseDayKey(dayKey);

    if (!parsedDayKey) {
      return [];
    }

    return [
      {
        attemptedAt: readString(upload.attemptedAt),
        date: parsedDayKey.date,
        dayKey,
        error: readString(upload.error) || "Daily report upload failed.",
        fileName: readString(upload.fileName) || "Daily report",
        folderPath: readString(upload.folderPath) || "Daily Reports",
        folderUrl: readString(upload.folderUrl),
        projectId: parsedDayKey.projectId
      }
    ];
  });

  return NextResponse.json({
    dailyReports,
    databaseConfigured: true,
    jobImages: jobImageFailures.map((upload) => ({
      attemptedAt: upload.attemptedAt,
      caption: upload.caption,
      date: upload.date,
      error: upload.error ?? "Image upload failed.",
      fileName: upload.fileName,
      folderPath: upload.folderPath,
      folderUrl: upload.folderUrl,
      id: upload.id,
      originalFileName: upload.originalFileName,
      projectId: upload.projectId,
      uploadedByName: upload.uploadedByName
    }))
  });
}

function parseDayKey(dayKey: string) {
  const [projectId, date] = dayKey.split("|");

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return {
    date,
    projectId
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
