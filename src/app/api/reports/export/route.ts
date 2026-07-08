import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readAllocationEntriesForReport } from "@/lib/allocation-entries-store";
import {
  buildCrewPerformanceRows,
  buildPayItemDetailAnalysisRows,
  buildPayItemReport,
  type DetailGrouping,
  type DetailSort,
  type ReportMetric,
  type ReportMode
} from "@/lib/report-builders";
import { todayInputValue } from "@/lib/date";
import { getProjects } from "@/lib/procore/projects";
import type { AllocationEntry, Project } from "@/lib/procore/types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before exporting reports." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "project_manager") {
    return NextResponse.json({ error: "Project manager access is required to export reports." }, { status: 403 });
  }

  const body = (await request.json()) as ReportExportRequestBody;
  const mode = parseReportMode(body.mode);
  const reportOptions = {
    excludeOutliers: body.excludeOutliers === true,
    metric: parseReportMetric(body.reportMetric)
  };
  const projects = await getProjects();
  const projectIds = resolveProjectIds(body, projects.map((project) => project.id));
  const baseFilters = {
    endDate: parseIsoDate(body.endDate),
    projectIds,
    startDate: parseIsoDate(body.startDate)
  };
  const entries = await readAllocationEntriesForReport(baseFilters);

  if (!entries) {
    return NextResponse.json({ error: "Database storage is not configured for report exports." }, { status: 503 });
  }

  const csv = await buildReportCsv(mode, body, entries, projects, baseFilters, reportOptions);
  const fileName = `time-allocation-${mode}-report-${todayInputValue()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
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
    const headers = [
      "pay_item",
      "date",
      "job",
      "crew_member",
      "job_title",
      "entries",
      "hours",
      "quantity",
      "hours_per_unit",
      "excluded_outliers",
      "sample_size"
    ];
    const rows = detailPayItemQuery && detailEntries
      ? buildPayItemDetailAnalysisRows(detailEntries, projects, detailGrouping, detailSort, reportOptions).map((row) => [
          row.payItemLabel,
          row.date ?? "All dates",
          row.projectName,
          row.crewMemberName ?? "All crew",
          row.jobTitle ?? "",
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
  return [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(",")).join("\r\n");
}

function escapeCsvCell(value: string) {
  const safeValue = value.trimStart().match(/^[=+\-@]/) ? `'${value}` : value;

  if (/[",\r\n\t]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  return safeValue;
}

function resolveProjectIds(body: ReportExportRequestBody, cachedProjectIds: string[]) {
  const cachedProjectIdSet = new Set(cachedProjectIds);
  const allowedProjectIds = normalizeStringList(body.allowedProjectIds).filter((projectId) => cachedProjectIdSet.has(projectId));
  const allowedIds = Array.isArray(body.allowedProjectIds) ? allowedProjectIds : cachedProjectIds;
  const allowedIdSet = new Set(allowedIds);
  const projectId = readString(body.projectId);

  if (projectId === "my-jobs") {
    return normalizeStringList(body.myJobIds).filter((candidateProjectId) => allowedIdSet.has(candidateProjectId));
  }

  if (projectId && projectId !== "all") {
    return allowedIdSet.has(projectId) ? [projectId] : [];
  }

  return allowedIds;
}

function parseReportMode(value: unknown): ReportMode {
  return value === "detail" || value === "crew" ? value : "summary";
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

function parseIsoDate(value: unknown) {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value) ? value : undefined;
}

function normalizeStringList(values: unknown) {
  return Array.from(new Set(Array.isArray(values) ? values.map(readString).filter(Boolean) : []));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

type ReportExportRequestBody = {
  allowedProjectIds?: unknown;
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
