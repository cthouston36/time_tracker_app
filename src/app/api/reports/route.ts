import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readAllocationEntriesForReport } from "@/lib/allocation-entries-store";
import {
  buildCrewPerformanceRows,
  buildPayItemDetailAnalysisRows,
  buildPayItemReport,
  buildReportPayItemOptions,
  paginateRows,
  type DetailGrouping,
  type DetailSort,
  type ReportMetric,
  type ReportMode
} from "@/lib/report-builders";
import { getProjects } from "@/lib/procore/projects";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PAGE_SIZE_BY_MODE: Record<ReportMode, number> = {
  crew: 25,
  detail: 50,
  summary: 25
};
const MAX_PAGE_SIZE = 100;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading reports." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "project_manager") {
    return NextResponse.json({ error: "Project manager access is required to load reports." }, { status: 403 });
  }

  const body = (await request.json()) as ReportRequestBody;
  const mode = parseReportMode(body.mode);
  const reportOptions = {
    excludeOutliers: body.excludeOutliers === true,
    metric: parseReportMetric(body.reportMetric)
  };
  const page = parsePositiveInteger(body.page, 1);
  const pageSize = Math.min(parsePositiveInteger(body.pageSize, DEFAULT_PAGE_SIZE_BY_MODE[mode]), MAX_PAGE_SIZE);
  const projects = await getProjects();
  const projectIds = resolveProjectIds(body, projects.map((project) => project.id));
  const baseFilters = {
    endDate: parseIsoDate(body.endDate),
    projectIds,
    startDate: parseIsoDate(body.startDate)
  };
  const entries = await readAllocationEntriesForReport(baseFilters);

  if (!entries) {
    return NextResponse.json({
      databaseConfigured: false,
      filteredEntryCount: 0,
      mode,
      page,
      pageSize,
      payItemOptions: [],
      rows: [],
      totalRows: 0
    });
  }

  if (mode === "summary") {
    const reportRows = buildPayItemReport(entries, projects, reportOptions);
    const pagedRows = paginateRows(reportRows, page, pageSize);

    return NextResponse.json({
      databaseConfigured: true,
      filteredEntryCount: entries.length,
      mode,
      page: pagedRows.page,
      pageSize: pagedRows.pageSize,
      rows: pagedRows.rows,
      totalRows: pagedRows.totalRows
    });
  }

  if (mode === "crew") {
    const reportRows = buildCrewPerformanceRows(entries, projects, reportOptions);
    const pagedRows = paginateRows(reportRows, page, pageSize);

    return NextResponse.json({
      databaseConfigured: true,
      filteredEntryCount: entries.length,
      mode,
      page: pagedRows.page,
      pageSize: pagedRows.pageSize,
      rows: pagedRows.rows,
      totalRows: pagedRows.totalRows
    });
  }

  const detailPayItemQuery = readString(body.detailPayItemQuery);
  const detailGrouping = parseDetailGrouping(body.detailGrouping);
  const detailSort = parseDetailSort(body.detailSort);
  const detailEntries = detailPayItemQuery
    ? await readAllocationEntriesForReport({
        ...baseFilters,
        payItemQuery: detailPayItemQuery
      })
    : [];
  const reportRows = detailPayItemQuery && detailEntries
    ? buildPayItemDetailAnalysisRows(detailEntries, projects, detailGrouping, detailSort, reportOptions)
    : [];
  const pagedRows = paginateRows(reportRows, page, pageSize);
  const filteredEntryCount = detailPayItemQuery && detailEntries ? detailEntries.length : entries.length;

  return NextResponse.json({
    databaseConfigured: true,
    filteredEntryCount,
    mode,
    page: pagedRows.page,
    pageSize: pagedRows.pageSize,
    payItemOptions: buildReportPayItemOptions(entries),
    rows: pagedRows.rows,
    totalRows: pagedRows.totalRows
  });
}

function resolveProjectIds(body: ReportRequestBody, cachedProjectIds: string[]) {
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

function parsePositiveInteger(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeStringList(values: unknown) {
  return Array.from(new Set(Array.isArray(values) ? values.map(readString).filter(Boolean) : []));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type ReportRequestBody = {
  allowedProjectIds?: unknown;
  detailGrouping?: unknown;
  detailPayItemQuery?: unknown;
  detailSort?: unknown;
  endDate?: unknown;
  excludeOutliers?: unknown;
  mode?: unknown;
  myJobIds?: unknown;
  page?: unknown;
  pageSize?: unknown;
  projectId?: unknown;
  reportMetric?: unknown;
  startDate?: unknown;
};
