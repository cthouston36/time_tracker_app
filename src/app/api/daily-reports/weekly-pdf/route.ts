import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { canAccessReports, getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildCombinedDailyReportPdf,
  buildWeeklyDailyReportsPdfFileName,
  type DailyReportPdfPayload
} from "@/lib/daily-report-pdf";
import { readDailyReportsForRange } from "@/lib/daily-report-store";
import { readDayRecords } from "@/lib/day-record-store";
import { readProjectControls } from "@/lib/project-controls-store";
import { getProjects } from "@/lib/project-catalog/projects";
import { addDaysToInputDate, getWeekStart } from "@/lib/date";
import { getDayKey, isIsoDate } from "@/lib/day-key";
import { readString, readStringList } from "@/lib/records";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_COMBINED_DAILY_REPORTS = 120;

type WeeklyDailyReportsPdfRequest = {
  projectIds?: unknown;
  weekStart?: unknown;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before exporting daily reports." }, { status: 401 });
  }

  if (!canAccessReports(user)) {
    return NextResponse.json({ error: "Report access is required to export weekly daily reports." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as WeeklyDailyReportsPdfRequest;
    const requestedProjectIds = readStringList(body.projectIds);
    const requestedWeekStart = readString(body.weekStart);

    if (requestedProjectIds.length === 0 || !isIsoDate(requestedWeekStart)) {
      return NextResponse.json({ error: "Select at least one project and a valid week." }, { status: 400 });
    }

    const weekStart = getWeekStart(requestedWeekStart);
    const weekEnd = addDaysToInputDate(weekStart, 6);
    const allProjects = getAccessibleProjectsForUser(user, await getProjects());
    const projectControls = await readProjectControls();
    const unavailableProjectIds = new Set([
      ...Object.keys(projectControls?.projectArchiveById ?? {}),
      ...Object.keys(projectControls?.projectBlacklistById ?? {})
    ]);
    const requestedProjectIdSet = new Set(requestedProjectIds);
    const projects = allProjects
      .filter((project) => requestedProjectIdSet.has(project.id) && !unavailableProjectIds.has(project.id))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));

    if (projects.length === 0) {
      return NextResponse.json({ error: "No active selected projects were found." }, { status: 404 });
    }

    const dailyReportRows = await readDailyReportsForRange({
      endDate: weekEnd,
      projectIds: projects.map((project) => project.id),
      startDate: weekStart
    });

    if (dailyReportRows === null) {
      return NextResponse.json({ error: "Database storage is not configured for daily report exports." }, { status: 503 });
    }

    if (dailyReportRows.length === 0) {
      return NextResponse.json({ error: "No saved daily reports are available for the selected projects and week." }, { status: 404 });
    }

    if (dailyReportRows.length > MAX_COMBINED_DAILY_REPORTS) {
      return NextResponse.json(
        {
          error: `This export contains ${dailyReportRows.length} daily reports. Narrow the selection to ${MAX_COMBINED_DAILY_REPORTS} or fewer.`
        },
        { status: 400 }
      );
    }

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const dayRecords = await readDayRecords();
    const payloads = dailyReportRows
      .flatMap((row) => {
        const project = projectMap.get(row.projectId);

        if (!project) {
          return [];
        }

        return [
          {
            date: row.date,
            dayNotes: dayRecords?.dayEntryNotesByKey[getDayKey(row.projectId, row.date)],
            project,
            report: row.report
          } satisfies DailyReportPdfPayload
        ];
      })
      .sort((left, right) => left.project.name.localeCompare(right.project.name, undefined, { numeric: true, sensitivity: "base" }) || left.date.localeCompare(right.date));

    const fileName = buildWeeklyDailyReportsPdfFileName(weekStart, weekEnd);
    const pdf = await buildCombinedDailyReportPdf(payloads, fileName);

    await recordAuditLog({
      action: "daily_reports.weekly_pdf_exported",
      actor: user,
      metadata: {
        dailyReportCount: payloads.length,
        projectCount: projects.length,
        weekEnd,
        weekStart
      },
      targetType: "daily_reports",
      ...getAuditRequestMetadata(request.headers)
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
        "X-Daily-Report-Count": String(payloads.length)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export weekly daily reports." },
      { status: 500 }
    );
  }
}
