import { todayInputValue } from "@/lib/date";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import type {
  CrewPerformanceRow,
  DailyWorkReportRow,
  DailyWorkReportSourceRow,
  EmployeeHoursReportRow,
  EmployeeHoursReportSourceRow,
  PayItemDetailAnalysisRow,
  PayItemReportRow,
  ReportMode,
  ReportPayItemOption
} from "@/lib/report-builders";
import { downloadBlob } from "@/features/time-allocation/lib/browser-actions";
import { formatCsvIdentifier, formatCsvNumber, rowsToCsv } from "@/features/time-allocation/lib/csv-utils";

export type ReportsDailyReport = {
  date: string;
  employeeRows?: EmployeeHoursReportSourceRow["report"]["employeeRows"];
  payItemRows?: DailyWorkReportSourceRow["report"]["payItemRows"];
  projectId: string;
};

export type DailyReportsByKey = Record<string, ReportsDailyReport>;

export type ReportResponse = {
  databaseConfigured?: boolean;
  error?: string;
  filteredEntryCount?: number;
  mode?: ReportMode;
  page?: number;
  pageSize?: number;
  payItemOptions?: ReportPayItemOption[];
  rows?: Array<PayItemReportRow | PayItemDetailAnalysisRow | CrewPerformanceRow | EmployeeHoursReportRow | DailyWorkReportRow>;
  totalRows?: number;
};

export function buildReportProjectOptions(
  projects: Project[],
  entries: AllocationEntry[],
  dailyReportsByKey: DailyReportsByKey = {}
) {
  const projectOptions = new Map(projects.map((project) => [project.id, project.name]));

  for (const entry of entries) {
    if (!projectOptions.has(entry.projectId)) {
      projectOptions.set(entry.projectId, entry.projectName ?? `Unknown job (${entry.projectId})`);
    }
  }

  for (const report of Object.values(dailyReportsByKey)) {
    if (!projectOptions.has(report.projectId)) {
      projectOptions.set(report.projectId, `Unknown job (${report.projectId})`);
    }
  }

  return Array.from(projectOptions.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function exportDailyWorkReportToCsv(rows: DailyWorkReportRow[]) {
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
  const csv = rowsToCsv([headers, ...csvRows]);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  downloadBlob(blob, `time-allocation-daily-work-${todayInputValue()}.csv`);
}

export function exportPayItemSummaryToCsv(payItemRows: PayItemReportRow[]) {
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
  const rows = payItemRows.map((row) => [
    row.code,
    row.name,
    row.entryCount,
    row.totalHours.toFixed(2),
    row.totalQuantity.toFixed(2),
    row.hoursPerUnit.toFixed(3),
    row.excludedEntryCount,
    row.sampleSize
  ]);
  const csv = rowsToCsv([headers, ...rows]);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  downloadBlob(blob, `time-allocation-summary-${todayInputValue()}.csv`);
}

export function getFilteredDailyWorkReportSourceRows({
  dailyReportsByKey,
  endDate,
  myJobIds,
  projectId,
  startDate
}: {
  dailyReportsByKey: DailyReportsByKey;
  endDate: string;
  myJobIds: string[];
  projectId: string;
  startDate: string;
}): DailyWorkReportSourceRow[] {
  return Object.values(dailyReportsByKey)
    .filter((report) => dailyReportMatchesReportFilters(report, projectId, myJobIds, startDate, endDate))
    .map((report) => ({
      date: report.date,
      projectId: report.projectId,
      report
    }));
}

export function getFilteredEmployeeHoursReportSourceRows({
  dailyReportsByKey,
  endDate,
  myJobIds,
  projectId,
  startDate
}: {
  dailyReportsByKey: DailyReportsByKey;
  endDate: string;
  myJobIds: string[];
  projectId: string;
  startDate: string;
}): EmployeeHoursReportSourceRow[] {
  return Object.values(dailyReportsByKey)
    .filter((report) => dailyReportMatchesReportFilters(report, projectId, myJobIds, startDate, endDate))
    .map((report) => ({
      date: report.date,
      projectId: report.projectId,
      report
    }));
}

export function getReportPageSize(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return 50;
  }

  if (reportMode === "employee_hours") {
    return 100;
  }

  if (reportMode === "daily_work") {
    return 50;
  }

  return 25;
}

export function getReportSkeletonRowCount(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return 7;
  }

  if (reportMode === "employee_hours" || reportMode === "daily_work") {
    return 5;
  }

  return 6;
}

export function getReportTitle(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return "Detailed Pay Item Analysis";
  }

  if (reportMode === "crew") {
    return "Crew Performance Summary";
  }

  if (reportMode === "employee_hours") {
    return "Employee Hours Report";
  }

  if (reportMode === "daily_work") {
    return "Daily Work Completed";
  }

  return "Pay Item Production Report";
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function payItemMatchesQuery(entry: AllocationEntry, normalizedQuery: string) {
  return `${entry.payItemCode} ${entry.payItemName}`.toLowerCase().includes(normalizedQuery);
}

export async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const data = (await readApiJson(response)) as { error?: string };

    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function readApiJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) {
      throw new Error("The server returned an unreadable response.");
    }

    throw new Error(text.slice(0, 300) || `${response.status} ${response.statusText || "Request failed"}`.trim());
  }
}

function dailyReportMatchesReportFilters(
  report: ReportsDailyReport,
  projectId: string,
  myJobIds: string[],
  startDate: string,
  endDate: string
) {
  const matchesProject =
    projectId === "all" || (projectId === "my-jobs" ? myJobIds.includes(report.projectId) : report.projectId === projectId);
  const matchesStart = !startDate || report.date >= startDate;
  const matchesEnd = !endDate || report.date <= endDate;

  return matchesProject && matchesStart && matchesEnd;
}
