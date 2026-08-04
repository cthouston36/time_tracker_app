import { NextRequest, NextResponse } from "next/server";
import { canAccessReports, getProjectAccessScopeForUser, getReportProjectsForUser } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { readAllocationEntriesForReport } from "@/lib/allocation-entries-store";
import {
  buildCrewPerformanceRows,
  buildDailyWorkReportRows,
  filterEntriesByCrewLaborTypes,
  buildPayItemDetailAnalysisRows,
  buildPayItemReport,
  type DetailGrouping,
  type DetailSort,
  type ReportMetric,
  type ReportMode
} from "@/lib/report-builders";
import { todayInputValue } from "@/lib/date";
import { isIsoDate } from "@/lib/day-key";
import { getProjects } from "@/lib/project-catalog/projects";
import { backfillReportRollupsIfEmpty, readDailyWorkRollupSourceRows } from "@/lib/report-rollups";
import {
  CREW_LABOR_TYPES,
  isCrewLaborType,
  type AllocationEntry,
  type CrewLaborType,
  type Project
} from "@/lib/domain/types";
import { readString, readStringList } from "@/lib/records";
import { formatCsvIdentifier, formatCsvNumber, rowsToCsv } from "@/features/time-allocation/lib/csv-utils";
import { formatCrewLaborType } from "@/features/time-allocation/lib/crew-formatters";

const DEFAULT_CREW_LABOR_TYPES: CrewLaborType[] = [...CREW_LABOR_TYPES];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before exporting reports." }, { status: 401 });
  }

  if (!canAccessReports(user)) {
    return NextResponse.json({ error: "Report access is required to export reports." }, { status: 403 });
  }

  const body = (await request.json()) as ReportExportRequestBody;
  const mode = parseReportMode(body.mode);
  const reportOptions = {
    excludeOutliers: body.excludeOutliers === true,
    metric: parseReportMetric(body.reportMetric)
  };
  const allProjects = await getProjects();
  const projects = getReportProjectsForUser(user, allProjects);
  const projectIds = resolveProjectIds(
    body,
    projects.map((project) => project.id),
    getMyReportProjectIds(user, allProjects, body)
  );
  const baseFilters = {
    endDate: parseIsoDate(body.endDate),
    projectIds,
    startDate: parseIsoDate(body.startDate)
  };

  if (mode === "daily_work") {
    const dailyReportRows = await readDailyWorkRollupSourceRows(baseFilters);

    if (!dailyReportRows) {
      return NextResponse.json({ error: "Database storage is not configured for report exports." }, { status: 503 });
    }

    const csv = buildDailyWorkReportCsv(buildDailyWorkReportRows(dailyReportRows, projects));
    const fileName = `time-allocation-daily-work-report-${todayInputValue()}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  }

  await backfillReportRollupsForRequest();

  const entries = await readAllocationEntriesForReport(baseFilters);

  if (!entries) {
    return NextResponse.json({ error: "Database storage is not configured for report exports." }, { status: 503 });
  }

  const reportEntries = filterEntriesByCrewLaborTypes(entries, parseCrewLaborTypes(body.crewLaborTypes));
  const csv = await buildReportCsv(mode, body, reportEntries, projects, baseFilters, reportOptions);
  const fileName = `time-allocation-${mode}-report-${todayInputValue()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

async function backfillReportRollupsForRequest() {
  try {
    await backfillReportRollupsIfEmpty();
  } catch (error) {
    console.error("Unable to backfill report rollups for report export.", error);
  }
}

async function buildReportCsv(
  mode: ReportMode,
  body: ReportExportRequestBody,
  entries: AllocationEntry[],
  projects: Project[],
  baseFilters: { endDate?: string; projectIds: string[]; startDate?: string },
  reportOptions: { excludeOutliers: boolean; metric: ReportMetric }
) {
  if (mode === "crew") {
    const headers = [
      "crew_member_name",
      "job_title",
      "labor_type",
      "subcontractor_company",
      "hours",
      "entries",
      "pay_items",
      "jobs",
      "avg_vs_company",
      "excluded_outliers",
      "sample_size",
      "status"
    ];
    const rows = buildCrewPerformanceRows(entries, projects, reportOptions).map((row) => [
      row.crewMemberName,
      row.jobTitle,
      formatCrewLaborType(row.laborType),
      row.subcontractorCompany ?? "",
      row.totalHours.toFixed(2),
      row.entryCount,
      row.payItemCount,
      row.jobCount,
      formatPercent(row.weightedVariance),
      row.excludedEntryCount,
      row.sampleSize,
      row.status
    ]);

    return buildCsv(headers, rows);
  }

  if (mode === "detail") {
    const detailPayItemQuery = readString(body.detailPayItemQuery);
    const detailGrouping = parseDetailGrouping(body.detailGrouping);
    const detailSort = parseDetailSort(body.detailSort);
    const detailEntries = detailPayItemQuery
      ? await readAllocationEntriesForReport({
          ...baseFilters,
          payItemQuery: detailPayItemQuery
        })
      : [];
    const filteredDetailEntries = filterEntriesByCrewLaborTypes(detailEntries ?? [], parseCrewLaborTypes(body.crewLaborTypes));
    const headers = [
      "pay_item",
      "date",
      "job",
      "crew_member",
      "job_title",
      "labor_type",
      "subcontractor_company",
      "entries",
      "hours",
      "quantity",
      "hours_per_unit",
      "excluded_outliers",
      "sample_size"
    ];
    const rows = detailPayItemQuery && detailEntries
      ? buildPayItemDetailAnalysisRows(filteredDetailEntries, projects, detailGrouping, detailSort, reportOptions).map((row) => [
          row.payItemLabel,
          row.date ?? "All dates",
          row.projectName,
          row.crewMemberName ?? "All crew",
          row.jobTitle ?? "",
          row.laborType ? formatCrewLaborType(row.laborType) : "",
          row.subcontractorCompany ?? "",
          row.entryCount,
          row.hours.toFixed(2),
          row.quantityCompleted.toFixed(2),
          row.hoursPerUnit.toFixed(3),
          row.excludedEntryCount,
          row.sampleSize
        ])
      : [];

    return buildCsv(headers, rows);
  }

  const headers = [
    "pay_item_code",
    "pay_item_name",
    "entries",
    "hours",
    "quantity",
    "hours_per_unit",
    "excluded_outliers",
    "sample_size"
  ];
  const rows = buildPayItemReport(entries, projects, reportOptions).map((row) => [
    row.code,
    row.name,
    row.entryCount,
    row.totalHours.toFixed(2),
    row.totalQuantity.toFixed(2),
    row.hoursPerUnit.toFixed(3),
    row.excludedEntryCount,
    row.sampleSize
  ]);

  return buildCsv(headers, rows);
}

function buildCsv(headers: string[], rows: Array<Array<number | string>>) {
  return rowsToCsv([headers, ...rows]);
}

function buildDailyWorkReportCsv(rows: ReturnType<typeof buildDailyWorkReportRows>) {
  const headers = [
    "job",
    "project_id",
    "pay_item_code",
    "pay_item_name",
    "unit_of_measure",
    "total_quantity",
    "daily_report_count",
    "work_row_count",
    "first_date",
    "last_date",
    "detail_date",
    "detail_quantity",
    "detail_notes"
  ];
  const csvRows = rows.flatMap((row) =>
    row.detailRows.length
      ? row.detailRows.map((detailRow) => [
          row.projectName,
          formatCsvIdentifier(row.projectId),
          row.payItemCode,
          row.payItemName,
          row.unitOfMeasure ?? "",
          formatCsvNumber(row.totalQuantity),
          row.dailyReportCount,
          row.rowCount,
          row.firstDate,
          row.lastDate,
          detailRow.date,
          formatCsvNumber(detailRow.quantity),
          detailRow.notes
        ])
      : [
          [
            row.projectName,
            formatCsvIdentifier(row.projectId),
            row.payItemCode,
            row.payItemName,
            row.unitOfMeasure ?? "",
            formatCsvNumber(row.totalQuantity),
            row.dailyReportCount,
            row.rowCount,
            row.firstDate,
            row.lastDate,
            "",
            "",
            ""
          ]
        ]
  );

  return buildCsv(headers, csvRows);
}

function resolveProjectIds(body: ReportExportRequestBody, cachedProjectIds: string[], myProjectIds: string[]) {
  const cachedProjectIdSet = new Set(cachedProjectIds);
  const projectId = readString(body.projectId);

  if (projectId === "my-jobs") {
    return myProjectIds.filter((candidateProjectId) => cachedProjectIdSet.has(candidateProjectId));
  }

  if (projectId && projectId !== "all") {
    return cachedProjectIdSet.has(projectId) ? [projectId] : [];
  }

  return cachedProjectIds;
}

function getMyReportProjectIds(user: AuthUser, projects: Project[], body: ReportExportRequestBody) {
  const projectAccessScope = getProjectAccessScopeForUser(user, projects);

  if (projectAccessScope !== null) {
    return projectAccessScope;
  }

  return readStringList(body.myJobIds);
}

function parseReportMode(value: unknown): ReportMode {
  return value === "detail" || value === "crew" || value === "daily_work" ? value : "summary";
}

function parseDetailGrouping(value: unknown): DetailGrouping {
  if (value === "crew_project" || value === "job_day") {
    return value;
  }

  return "crew_day";
}

function parseDetailSort(value: unknown): DetailSort {
  if (value === "best_average" || value === "most_hours" || value === "most_quantity") {
    return value;
  }

  return "worst_average";
}

function parseReportMetric(value: unknown): ReportMetric {
  return value === "mean" ? "mean" : "median";
}

function parseCrewLaborTypes(value: unknown): CrewLaborType[] {
  const selectedTypes = readStringList(value).filter(isCrewLaborType);
  return selectedTypes.length > 0 ? selectedTypes : DEFAULT_CREW_LABOR_TYPES;
}

function parseIsoDate(value: unknown) {
  return isIsoDate(value) ? value : undefined;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

type ReportExportRequestBody = {
  allowedProjectIds?: unknown;
  crewLaborTypes?: unknown;
  detailGrouping?: unknown;
  detailPayItemQuery?: unknown;
  detailSort?: unknown;
  endDate?: unknown;
  excludeOutliers?: unknown;
  mode?: unknown;
  myJobIds?: unknown;
  projectId?: unknown;
  reportMetric?: unknown;
  startDate?: unknown;
};
