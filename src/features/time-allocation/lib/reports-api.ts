import type { CrewLaborType } from "@/lib/domain/types";
import type {
  DetailGrouping,
  DetailSort,
  EmployeeHoursGrouping,
  ReportMetric,
  ReportMode
} from "@/lib/report-builders";
import { readApiError, readApiJson } from "@/features/time-allocation/lib/api-utils";
import type { ReportResponse } from "@/features/time-allocation/lib/report-view-helpers";

type ReportRequestOptions = {
  allowedProjectIds: string[];
  crewLaborTypes: CrewLaborType[];
  detailGrouping: DetailGrouping;
  detailPayItemQuery: string;
  detailSort: DetailSort;
  employeeHoursGrouping: EmployeeHoursGrouping;
  endDate: string;
  excludeOutliers: boolean;
  mode: ReportMode;
  myJobIds: string[];
  page: number;
  pageSize: number;
  projectId: string;
  reportMetric: ReportMetric;
  signal?: AbortSignal;
  startDate: string;
};

type ReportExportOptions = {
  allowedProjectIds: string[];
  crewLaborTypes: CrewLaborType[];
  endDate: string;
  excludeOutliers: boolean;
  mode: "daily_work" | "summary";
  myJobIds: string[];
  projectId: string;
  reportMetric: ReportMetric;
  startDate: string;
};

export async function loadServerReport({
  signal,
  ...requestBody
}: ReportRequestOptions) {
  const response = await fetch("/api/reports", {
    body: JSON.stringify(requestBody),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    signal
  });
  const data = (await readApiJson(response)) as ReportResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load report.");
  }

  return data;
}

export async function exportServerReportCsv(requestBody: ReportExportOptions) {
  const response = await fetch("/api/reports/export", {
    body: JSON.stringify(requestBody),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to export report CSV."));
  }

  return response.blob();
}
