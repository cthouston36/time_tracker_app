import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import { replaceAllocationEntries } from "@/lib/allocation-entries-store";
import { replaceCrewData } from "@/lib/crew-store";
import { replaceDailyReportData } from "@/lib/daily-report-store";
import { replaceDayRecords } from "@/lib/day-record-store";

const CONFIRMATION_TEXT = "CLEAR_STAGING_DATA";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as { confirmation?: string };

  if (body.confirmation !== CONFIRMATION_TEXT) {
    return NextResponse.json({ error: "Confirmation text did not match." }, { status: 400 });
  }

  const entriesResult = await replaceAllocationEntries([]);
  const dayRecordsResult = await replaceDayRecords({}, {});
  const dailyReportsResult = await replaceDailyReportData({}, {});
  const crewResult = await replaceCrewData([], {});

  if (!entriesResult || !dayRecordsResult || !dailyReportsResult || !crewResult) {
    return NextResponse.json({ error: "Database is not configured for staging data cleanup." }, { status: 503 });
  }

  await recordAuditLog({
    action: "admin.staging_data_cleared",
    actor: currentUser,
    metadata: {
      cleared: {
        crew: crewResult,
        dailyEntries: entriesResult,
        dailyReports: dailyReportsResult,
        dayRecords: dayRecordsResult
      },
      preserved: [
        "users",
        "procore_projects",
        "procore_pay_items",
        "procore_sync_state",
        "project_blacklist",
        "my_jobs",
        "audit_log"
      ]
    },
    targetType: "staging_data",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    cleared: {
      crew: crewResult,
      dailyEntries: entriesResult,
      dailyReports: dailyReportsResult,
      dayRecords: dayRecordsResult
    },
    databaseConfigured: true,
    ok: true
  });
}
