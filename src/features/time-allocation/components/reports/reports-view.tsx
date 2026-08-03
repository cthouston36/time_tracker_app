"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Download, Info, ListChecks, Users } from "lucide-react";
import { todayInputValue } from "@/lib/date";
import type { AuthUser } from "@/lib/auth/types";
import {
  buildCrewPerformanceRows,
  buildDailyWorkReportRows,
  buildEmployeeHoursReportRows,
  buildPayItemDetailAnalysisRows,
  buildPayItemReport,
  buildReportPayItemOptions,
  filterEntriesByCrewLaborTypes,
  type CrewPerformanceRow,
  type DailyWorkReportRow,
  type DailyWorkReportSourceRow,
  type DetailGrouping,
  type DetailSort,
  type EmployeeHoursGrouping,
  type EmployeeHoursReportRow,
  type EmployeeHoursReportSourceRow,
  type PayItemDetailAnalysisRow,
  type PayItemReportRow,
  type ReportMetric,
  type ReportMode,
  type ReportPayItemOption
} from "@/lib/report-builders";
import {
  EmptyState,
  PageHeader,
  ReportControlsLoadingSkeleton,
  ReportLoadingSkeleton
} from "@/features/time-allocation/components/workspace-primitives";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import { MyJobsManager } from "@/features/time-allocation/components/my-jobs-manager";
import { getDefaultMyJobIdsForUser } from "@/features/time-allocation/lib/selectors";
import { downloadBlob, openDatePicker } from "@/features/time-allocation/lib/browser-actions";
import { formatCsvIdentifier, formatCsvNumber, rowsToCsv } from "@/features/time-allocation/lib/csv-utils";
import {
  formatCrewLaborTypeWithCompany,
  formatCrewPerformanceStatus,
  formatDailyWorkDateRange,
  formatDailyWorkQuantity,
  formatReportDate,
  formatReportEntryCount,
  formatVariance
} from "@/features/time-allocation/lib/report-formatters";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/domain/types";

const CREW_LABOR_TYPE_OPTIONS: Array<{ value: CrewLaborType; label: string }> = [
  { value: "chinchor_employee", label: "Chinchor Employee" },
  { value: "temp_employee", label: "Temp Employee" },
  { value: "subcontractor", label: "Subcontractor" }
];
const ALL_CREW_LABOR_TYPES = CREW_LABOR_TYPE_OPTIONS.map((option) => option.value);

type ReportsDailyReport = {
  date: string;
  employeeRows?: EmployeeHoursReportSourceRow["report"]["employeeRows"];
  payItemRows?: DailyWorkReportSourceRow["report"]["payItemRows"];
  projectId: string;
};

type DailyReportsByKey = Record<string, ReportsDailyReport>;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const data = (await readApiJson(response)) as { error?: string };

    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function readApiJson(response: Response) {
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

type ReportResponse = {
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

export function ReportsView({
  currentUser,
  dailyReportsByKey,
  entries,
  myJobIds,
  projects,
  reportProjectId,
  reportStartDate,
  reportEndDate,
  setMyJobIds,
  setReportProjectId,
  setReportStartDate,
  setReportEndDate
}: {
  currentUser: AuthUser;
  dailyReportsByKey: DailyReportsByKey;
  entries: AllocationEntry[];
  myJobIds: string[];
  projects: Project[];
  reportProjectId: string;
  reportStartDate: string;
  reportEndDate: string;
  setMyJobIds: (jobIds: string[]) => void;
  setReportProjectId: (projectId: string) => void;
  setReportStartDate: (date: string) => void;
  setReportEndDate: (date: string) => void;
}) {
  const [reportMode, setReportMode] = useState<ReportMode>("summary");
  const [detailPayItemQuery, setDetailPayItemQuery] = useState("");
  const [detailGrouping, setDetailGrouping] = useState<DetailGrouping>("crew_day");
  const [detailSort, setDetailSort] = useState<DetailSort>("worst_average");
  const [employeeHoursGrouping, setEmployeeHoursGrouping] = useState<EmployeeHoursGrouping>("employee");
  const [reportMetric, setReportMetric] = useState<ReportMetric>("median");
  const [excludeReportOutliers, setExcludeReportOutliers] = useState(false);
  const [reportCrewLaborTypes, setReportCrewLaborTypes] = useState<CrewLaborType[]>(ALL_CREW_LABOR_TYPES);
  const [crewPerformanceInfoOpen, setCrewPerformanceInfoOpen] = useState(false);
  const [myJobsEditorOpen, setMyJobsEditorOpen] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportsUseServerData, setReportsUseServerData] = useState(true);
  const reportStartInputRef = useRef<HTMLInputElement>(null);
  const reportEndInputRef = useRef<HTMLInputElement>(null);
  const reportPageSize = getReportPageSize(reportMode);
  const reportOptions = useMemo(
    () => ({
      excludeOutliers: excludeReportOutliers,
      metric: reportMetric
    }),
    [excludeReportOutliers, reportMetric]
  );
  const reportProjectOptions = useMemo(
    () => buildReportProjectOptions(projects, entries, dailyReportsByKey),
    [dailyReportsByKey, entries, projects]
  );
  const allowedReportProjectIds = useMemo(() => reportProjectOptions.map((project) => project.id), [reportProjectOptions]);
  const reportUsesDailyReports = reportMode === "employee_hours" || reportMode === "daily_work";
  const canManageMyJobs = currentUser.role === "admin";
  const automaticMyJobIds = useMemo(() => getDefaultMyJobIdsForUser(currentUser, projects), [currentUser, projects]);
  const reportMyJobIds = currentUser.role === "project_manager" ? automaticMyJobIds : myJobIds;
  const canUseMyJobsReportFilter =
    (currentUser.role === "project_manager" || currentUser.role === "admin") && reportMyJobIds.length > 0;
  const allJobsReportLabel = currentUser.role === "project_manager"
    ? "All Company Jobs"
    : reportUsesDailyReports
      ? "All Jobs With Daily Reports"
      : "All Jobs";
  const reportJobPickerOptions = [
    {
      value: "all",
      label: allJobsReportLabel
    },
    ...(canUseMyJobsReportFilter
      ? [
          {
            value: "my-jobs",
            label: `My Projects (${reportMyJobIds.length})`
          }
        ]
      : []),
    ...reportProjectOptions.map((project) => ({
      value: project.id,
      label: project.name
    }))
  ];
  const selectedReportJobLabel =
    reportJobPickerOptions.find((option) => option.value === reportProjectId)?.label ??
    allJobsReportLabel;
  const reportDateRangeLabel =
    reportStartDate || reportEndDate
      ? `${reportStartDate ? formatReportDate(reportStartDate) : "Any start"} - ${reportEndDate ? formatReportDate(reportEndDate) : "Any end"}`
      : "All dates";
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesProject =
          reportProjectId === "all" ||
          (reportProjectId === "my-jobs" ? reportMyJobIds.includes(entry.projectId) : entry.projectId === reportProjectId);
        const matchesStart = !reportStartDate || entry.date >= reportStartDate;
        const matchesEnd = !reportEndDate || entry.date <= reportEndDate;

        return matchesProject && matchesStart && matchesEnd;
      }),
    [entries, reportEndDate, reportMyJobIds, reportProjectId, reportStartDate]
  );
  const laborFilteredEntries = useMemo(
    () => filterEntriesByCrewLaborTypes(filteredEntries, reportCrewLaborTypes),
    [filteredEntries, reportCrewLaborTypes]
  );
  const normalizedDetailQuery = detailPayItemQuery.trim().toLowerCase();
  const localPayItemRows = useMemo(
    () => buildPayItemReport(laborFilteredEntries, projects, reportOptions),
    [laborFilteredEntries, projects, reportOptions]
  );
  const localDetailPayItemOptions = useMemo(() => buildReportPayItemOptions(laborFilteredEntries), [laborFilteredEntries]);
  const localDetailRows = useMemo(
    () =>
      normalizedDetailQuery
        ? buildPayItemDetailAnalysisRows(
            laborFilteredEntries.filter((entry) => payItemMatchesQuery(entry, normalizedDetailQuery)),
            projects,
            detailGrouping,
            detailSort,
            reportOptions
          )
        : [],
    [detailGrouping, detailSort, laborFilteredEntries, normalizedDetailQuery, projects, reportOptions]
  );
  const localCrewRows = useMemo(
    () => buildCrewPerformanceRows(laborFilteredEntries, projects, reportOptions),
    [laborFilteredEntries, projects, reportOptions]
  );
  const localEmployeeHoursRows = useMemo(
    () => {
      const sourceRows = getFilteredEmployeeHoursReportSourceRows({
        dailyReportsByKey,
        endDate: reportEndDate,
        myJobIds: reportMyJobIds,
        projectId: reportProjectId,
        startDate: reportStartDate
      });

      return buildEmployeeHoursReportRows(sourceRows, projects, employeeHoursGrouping);
    },
    [dailyReportsByKey, employeeHoursGrouping, projects, reportEndDate, reportMyJobIds, reportProjectId, reportStartDate]
  );
  const localDailyWorkRows = useMemo(
    () =>
      buildDailyWorkReportRows(
        getFilteredDailyWorkReportSourceRows({
          dailyReportsByKey,
          endDate: reportEndDate,
          myJobIds: reportMyJobIds,
          projectId: reportProjectId,
          startDate: reportStartDate
        }),
        projects
      ),
    [dailyReportsByKey, projects, reportEndDate, reportMyJobIds, reportProjectId, reportStartDate]
  );
  const serverReportAvailable = Boolean(reportsUseServerData && reportData?.databaseConfigured && reportData.mode === reportMode);
  const payItemRows =
    serverReportAvailable && reportMode === "summary" ? (reportData?.rows ?? []) as PayItemReportRow[] : localPayItemRows;
  const detailRows =
    serverReportAvailable && reportMode === "detail" ? (reportData?.rows ?? []) as PayItemDetailAnalysisRow[] : localDetailRows;
  const detailPayItemOptions =
    serverReportAvailable && reportMode === "detail" ? reportData?.payItemOptions ?? [] : localDetailPayItemOptions;
  const crewRows = serverReportAvailable && reportMode === "crew" ? (reportData?.rows ?? []) as CrewPerformanceRow[] : localCrewRows;
  const employeeHoursRows =
    serverReportAvailable && reportMode === "employee_hours"
      ? (reportData?.rows ?? []) as EmployeeHoursReportRow[]
      : localEmployeeHoursRows;
  const dailyWorkRows =
    serverReportAvailable && reportMode === "daily_work" ? (reportData?.rows ?? []) as DailyWorkReportRow[] : localDailyWorkRows;
  const reportPagination = serverReportAvailable
    ? {
        page: reportData?.page ?? reportPage,
        pageSize: reportData?.pageSize ?? reportPageSize,
        totalRows: reportData?.totalRows ?? 0
      }
    : null;

  useEffect(() => {
    setReportPage(1);
  }, [
    detailGrouping,
    detailPayItemQuery,
    detailSort,
    employeeHoursGrouping,
    excludeReportOutliers,
    reportCrewLaborTypes,
    reportEndDate,
    reportMetric,
    reportMode,
    reportMyJobIds,
    reportProjectId,
    reportStartDate
  ]);

  useEffect(() => {
    const controller = new AbortController();

    setReportLoading(true);
    setReportError("");

    fetch("/api/reports", {
      body: JSON.stringify({
        allowedProjectIds: allowedReportProjectIds,
        detailGrouping,
        detailPayItemQuery,
        detailSort,
        employeeHoursGrouping,
        endDate: reportEndDate,
        excludeOutliers: excludeReportOutliers,
        crewLaborTypes: reportCrewLaborTypes,
        mode: reportMode,
        myJobIds: reportMyJobIds,
        page: reportPage,
        pageSize: reportPageSize,
        projectId: reportProjectId,
        reportMetric,
        startDate: reportStartDate
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await readApiJson(response)) as ReportResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load report.");
        }

        setReportData(data);
        setReportsUseServerData(Boolean(data.databaseConfigured));
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setReportError(error instanceof Error ? error.message : "Unable to load report.");
        setReportsUseServerData(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setReportLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    allowedReportProjectIds,
    detailGrouping,
    detailPayItemQuery,
    detailSort,
    employeeHoursGrouping,
    excludeReportOutliers,
    reportCrewLaborTypes,
    reportMyJobIds,
    reportEndDate,
    reportMetric,
    reportMode,
    reportPage,
    reportPageSize,
    reportProjectId,
    reportStartDate
  ]);

  async function exportCurrentReportCsv() {
    if (reportMode === "summary" && !reportsUseServerData) {
      exportPayItemSummaryToCsv(localPayItemRows);
      return;
    }

    if (reportMode === "daily_work" && !reportsUseServerData) {
      exportDailyWorkReportToCsv(localDailyWorkRows);
      return;
    }

    setReportExporting(true);
    setReportError("");

    try {
      const response = await fetch("/api/reports/export", {
        body: JSON.stringify({
          allowedProjectIds: allowedReportProjectIds,
          crewLaborTypes: reportCrewLaborTypes,
          endDate: reportEndDate,
          excludeOutliers: excludeReportOutliers,
          mode: reportMode === "daily_work" ? "daily_work" : "summary",
          myJobIds: reportMyJobIds,
          projectId: reportProjectId,
          reportMetric,
          startDate: reportStartDate
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export report CSV."));
      }

      const blob = await response.blob();
      downloadBlob(
        blob,
        `time-allocation-${reportMode === "daily_work" ? "daily-work" : "summary"}-${todayInputValue()}.csv`
      );
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Unable to export report CSV.");
    } finally {
      setReportExporting(false);
    }
  }

  function toggleReportCrewLaborType(laborType: CrewLaborType, checked: boolean) {
    setReportCrewLaborTypes((current) => {
      const currentSet = new Set(current);

      if (checked) {
        currentSet.add(laborType);
      } else {
        currentSet.delete(laborType);
      }

      return currentSet.size === 0 ? current : ALL_CREW_LABOR_TYPES.filter((value) => currentSet.has(value));
    });
  }

  return (
    <section className="allocation-grid reports-page">
      <PageHeader
        icon={BarChart3}
        kicker="Reports"
        meta={[getReportTitle(reportMode), selectedReportJobLabel, reportDateRangeLabel]}
        title="Performance Reports"
      />
      <div className="panel">
        <div className="panel-heading">
          <h2>{getReportTitle(reportMode)}</h2>
          {reportMode === "summary" || reportMode === "daily_work" ? (
            <button className="secondary-button" disabled={reportExporting} onClick={exportCurrentReportCsv} type="button">
              <Download aria-hidden="true" size={18} />
              {reportExporting ? "Exporting..." : "Export CSV"}
            </button>
          ) : reportMode === "crew" ? (
            <button
              aria-expanded={crewPerformanceInfoOpen}
              className="icon-button"
              onClick={() => setCrewPerformanceInfoOpen((current) => !current)}
              title="Crew performance report logic"
              type="button"
            >
              <Info aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
        <div className="report-mode-tabs" aria-label="Report type">
          <button
            className={reportMode === "summary" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("summary")}
            type="button"
          >
            Summary
          </button>
          <button
            className={reportMode === "detail" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("detail")}
            type="button"
          >
            Detailed Analysis
          </button>
          <button
            className={reportMode === "crew" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("crew")}
            type="button"
          >
            Crew Performance
          </button>
          <button
            className={reportMode === "employee_hours" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("employee_hours")}
            type="button"
          >
            Employee Hours
          </button>
          <button
            className={reportMode === "daily_work" ? "tab-button active" : "tab-button"}
            onClick={() => setReportMode("daily_work")}
            type="button"
          >
            Daily Work
          </button>
        </div>
        {canManageMyJobs ? (
          <div className="report-admin-toolbar">
            <button
              aria-expanded={myJobsEditorOpen}
              className="secondary-button"
              onClick={() => setMyJobsEditorOpen((current) => !current)}
              type="button"
            >
              <ListChecks aria-hidden="true" size={18} />
              Create/Update My Projects ({myJobIds.length})
            </button>
          </div>
        ) : null}
        {myJobsEditorOpen ? (
          <MyJobsManager
            automaticJobIds={automaticMyJobIds}
            myJobIds={myJobIds}
            projects={projects}
            setMyJobIds={setMyJobIds}
          />
        ) : null}
        {reportMode === "crew" && crewPerformanceInfoOpen ? <CrewPerformanceInfo /> : null}
        {reportLoading && !reportData ? (
          <ReportControlsLoadingSkeleton />
        ) : (
        <div className="report-controls">
          <div className="field-group">
            <label htmlFor="report-project">Job</label>
            <select
              className="desktop-select"
              id="report-project"
              value={reportProjectId}
              onChange={(event) => setReportProjectId(event.target.value)}
            >
              {reportJobPickerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <MobileOptionPicker
              label="Report Job"
              options={reportJobPickerOptions}
              value={reportProjectId}
              onChange={setReportProjectId}
            />
          </div>
          <div className="field-group">
            <label htmlFor="report-start-date">From</label>
            <div className="date-input-wrap">
              <input
                id="report-start-date"
                ref={reportStartInputRef}
                type="date"
                value={reportStartDate}
                onChange={(event) => setReportStartDate(event.target.value)}
              />
              <button
                aria-label="Open report start date picker"
                className="date-input-button"
                onClick={() => openDatePicker(reportStartInputRef.current)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="report-end-date">To</label>
            <div className="date-input-wrap">
              <input
                id="report-end-date"
                ref={reportEndInputRef}
                type="date"
                value={reportEndDate}
                onChange={(event) => setReportEndDate(event.target.value)}
              />
              <button
                aria-label="Open report end date picker"
                className="date-input-button"
                onClick={() => openDatePicker(reportEndInputRef.current)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          {reportMode === "employee_hours" ? (
            <div className="field-group">
              <label htmlFor="employee-hours-grouping">Group By</label>
              <select
                id="employee-hours-grouping"
                value={employeeHoursGrouping}
                onChange={(event) => setEmployeeHoursGrouping(event.target.value as EmployeeHoursGrouping)}
              >
                <option value="employee">Employee</option>
                <option value="job">Job</option>
              </select>
            </div>
          ) : reportMode === "daily_work" ? null : (
            <>
              <div className="field-group">
                <label htmlFor="report-metric">Hrs / Unit Metric</label>
                <select
                  id="report-metric"
                  value={reportMetric}
                  onChange={(event) => setReportMetric(event.target.value as ReportMetric)}
                >
                  <option value="median">Median</option>
                  <option value="mean">Mean</option>
                </select>
              </div>
              <fieldset className="report-labor-filter">
                <legend>Crew Type</legend>
                {CREW_LABOR_TYPE_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={reportCrewLaborTypes.includes(option.value)}
                      type="checkbox"
                      onChange={(event) => toggleReportCrewLaborType(option.value, event.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <label className="report-toggle-row">
                <input
                  checked={excludeReportOutliers}
                  onChange={(event) => setExcludeReportOutliers(event.target.checked)}
                  type="checkbox"
                />
                <span>Exclude outliers</span>
              </label>
            </>
          )}
          <button
            className="secondary-button report-clear-button"
            disabled={
              reportProjectId === "all" &&
              !reportStartDate &&
              !reportEndDate &&
              (reportUsesDailyReports || reportCrewLaborTypes.length === ALL_CREW_LABOR_TYPES.length)
            }
            onClick={() => {
              setReportProjectId("all");
              setReportStartDate("");
              setReportEndDate("");
              setReportCrewLaborTypes(ALL_CREW_LABOR_TYPES);
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
        )}
        {reportMode === "employee_hours" ? (
          <div className="report-methodology-note">
            Employee Hours uses saved Daily Report employee time rows. Empty employee rows and zero-hour rows are excluded.
          </div>
        ) : reportMode === "daily_work" ? (
          <div className="report-methodology-note">
            Daily Work uses saved Daily Report Work Performed rows. Rows without a selected pay item or positive quantity are excluded.
          </div>
        ) : (
          <div className="report-methodology-note">
            {reportMetric === "median"
              ? "Median uses the middle row-level hours/unit value for each pay item group."
              : "Mean uses total hours divided by total quantity for each pay item group."}
            {excludeReportOutliers
              ? " Outliers are excluded with the 1.5x IQR rule within each pay item when at least 5 comparable rows exist."
              : " Outlier filtering is off."}
          </div>
        )}
        {reportError ? <div className="inline-alert">{reportError}</div> : null}
        {reportLoading ? (
          <ReportLoadingSkeleton rows={getReportSkeletonRowCount(reportMode)} />
        ) : reportMode === "summary" ? (
          <>
            <PayItemReportTable rows={payItemRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : reportMode === "detail" ? (
          <>
            <DetailedPayItemReport
              detailGrouping={detailGrouping}
              detailPayItemOptions={detailPayItemOptions}
              detailPayItemQuery={detailPayItemQuery}
              detailRows={detailRows}
              detailSort={detailSort}
              setDetailGrouping={setDetailGrouping}
              setDetailPayItemQuery={setDetailPayItemQuery}
              setDetailSort={setDetailSort}
            />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : reportMode === "crew" ? (
          <>
            <CrewPerformanceReport rows={crewRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : reportMode === "daily_work" ? (
          <>
            <DailyWorkReport rows={dailyWorkRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        ) : (
          <>
            <EmployeeHoursReport grouping={employeeHoursGrouping} rows={employeeHoursRows} />
            {reportPagination ? (
              <ReportPaginationControls
                loading={reportLoading}
                page={reportPagination.page}
                pageSize={reportPagination.pageSize}
                totalRows={reportPagination.totalRows}
                onPageChange={setReportPage}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function PayItemReportTable({ rows }: { rows: PayItemReportRow[] }) {
  const [expandedPayItemKey, setExpandedPayItemKey] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={BarChart3} title="No pay item report data">Saved entries that match the filters will appear here.</EmptyState>;
  }

  return (
    <div className="report-table">
      <div className="report-row report-header">
        <span>Pay Item</span>
        <span>Entries</span>
        <span>Hours</span>
        <span>Quantity</span>
        <span>Hrs / Unit</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedPayItemKey === row.key;
        const jobRollupRows = expanded ? row.jobRollupRows ?? [] : [];

        return (
          <div className="report-row-group" key={row.key}>
            <div className="report-row">
              <button
                className="report-drilldown-button"
                onClick={() => setExpandedPayItemKey(expanded ? null : row.key)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>
                  {row.code} - {row.name}
                </span>
              </button>
              <span data-label="Entries">{formatReportEntryCount(row)}</span>
              <span data-label="Hours">{row.totalHours.toFixed(2)}</span>
              <span data-label="Quantity">{row.totalQuantity.toFixed(2)}</span>
              <span data-label="Hrs / Unit">{row.hoursPerUnit.toFixed(3)}</span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header summary-detail-row">
                  <span>Job</span>
                  <span>Entries</span>
                  <span>Hours</span>
                  <span>Quantity</span>
                  <span>Hrs / Unit</span>
                </div>
                {jobRollupRows.map((jobRow) => (
                  <div className="report-detail-row summary-detail-row" key={jobRow.id}>
                    <span data-label="Job">{jobRow.projectName}</span>
                    <span data-label="Entries">{formatReportEntryCount(jobRow)}</span>
                    <span data-label="Hours">{jobRow.hours.toFixed(2)}</span>
                    <span data-label="Quantity">{jobRow.quantityCompleted.toFixed(2)}</span>
                    <span data-label="Hrs / Unit">{jobRow.hoursPerUnit.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DetailedPayItemReport({
  detailGrouping,
  detailPayItemOptions,
  detailPayItemQuery,
  detailRows,
  detailSort,
  setDetailGrouping,
  setDetailPayItemQuery,
  setDetailSort
}: {
  detailGrouping: DetailGrouping;
  detailPayItemOptions: ReportPayItemOption[];
  detailPayItemQuery: string;
  detailRows: PayItemDetailAnalysisRow[];
  detailSort: DetailSort;
  setDetailGrouping: (grouping: DetailGrouping) => void;
  setDetailPayItemQuery: (query: string) => void;
  setDetailSort: (sort: DetailSort) => void;
}) {
  const normalizedQuery = detailPayItemQuery.trim().toLowerCase();

  return (
    <div className="report-detail-analysis">
      <div className="report-detail-controls">
        <div className="field-group">
          <label htmlFor="detail-pay-item-select">Pay Item</label>
          <select
            id="detail-pay-item-select"
            disabled={detailPayItemOptions.length === 0}
            value={detailPayItemOptions.some((option) => option.query === detailPayItemQuery) ? detailPayItemQuery : ""}
            onChange={(event) => setDetailPayItemQuery(event.target.value)}
          >
            <option value="">
              {detailPayItemOptions.length === 0 ? "No pay items with entries" : "Select pay item"}
            </option>
            {detailPayItemOptions.map((option) => (
              <option key={option.key} value={option.query}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="detail-pay-item-search">Pay Item Search</label>
          <input
            id="detail-pay-item-search"
            placeholder="Search code or description"
            value={detailPayItemQuery}
            onChange={(event) => setDetailPayItemQuery(event.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="detail-grouping">Group By</label>
          <select
            id="detail-grouping"
            value={detailGrouping}
            onChange={(event) => setDetailGrouping(event.target.value as DetailGrouping)}
          >
            <option value="crew_day">Crew member by day</option>
            <option value="crew_project">Crew member by project</option>
            <option value="job_day">Job by day</option>
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="detail-sort">Sort By</label>
          <select
            id="detail-sort"
            value={detailSort}
            onChange={(event) => setDetailSort(event.target.value as DetailSort)}
          >
            <option value="worst_average">Highest hrs/unit</option>
            <option value="best_average">Lowest hrs/unit</option>
            <option value="most_hours">Most hours</option>
            <option value="most_quantity">Most quantity</option>
          </select>
        </div>
        <button
          className="secondary-button report-clear-button"
          disabled={!detailPayItemQuery}
          onClick={() => setDetailPayItemQuery("")}
          type="button"
        >
          Clear search
        </button>
      </div>

      {!normalizedQuery ? (
        <EmptyState icon={BarChart3} title="Select a pay item">Choose a pay item or search by code/description to load detail rows.</EmptyState>
      ) : detailRows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No matching detail rows">Adjust the pay item search or report filters.</EmptyState>
      ) : (
        <div className="report-table detail-analysis-table">
          <div className="report-row report-header detail-analysis-row">
            <span>Pay Item</span>
            <span>Date</span>
            <span>Job</span>
            <span>Crew Member</span>
            <span>Entries</span>
            <span>Hours</span>
            <span>Quantity</span>
            <span>Hrs / Unit</span>
          </div>
          {detailRows.map((row) => (
            <div className="report-row detail-analysis-row" key={row.id}>
              <span data-label="Pay Item">{row.payItemLabel}</span>
              <span data-label="Date">{row.date ? formatReportDate(row.date) : "All dates"}</span>
              <span data-label="Job">{row.projectName}</span>
              <span data-label="Crew Member">
                {row.crewMemberName ? (
                  <>
                    <strong>{row.crewMemberName}</strong>
                    {row.jobTitle && row.jobTitle !== "-" ? ` - ${row.jobTitle}` : ""}
                    {row.laborType ? ` (${formatCrewLaborTypeWithCompany(row)})` : ""}
                  </>
                ) : (
                  "All crew"
                )}
              </span>
              <span data-label="Entries">{formatReportEntryCount(row)}</span>
              <span data-label="Hours">{row.hours.toFixed(2)}</span>
              <span data-label="Quantity">{row.quantityCompleted.toFixed(2)}</span>
              <span data-label="Hrs / Unit">{row.hoursPerUnit.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrewPerformanceInfo() {
  return (
    <div className="report-info-panel">
      This report compares each crew member against the company average for the same pay items and labor group they
      worked in. Subcontractors are compared with subcontractors. Chinchor employees and temp employees are compared
      together. Each pay-item variance is weighted by that crew member&apos;s hours, so larger work samples matter more
      than small one-off entries. Lower hours per unit is treated as better performance. Rows marked limited data have
      less than 20 hours or fewer than 3 entries. If outlier filtering is enabled, the app uses the 1.5x IQR rule
      within each comparable pay-item group and only applies it when at least 5 comparable rows exist.
    </div>
  );
}

function CrewPerformanceReport({ rows }: { rows: CrewPerformanceRow[] }) {
  const [expandedCrewMemberId, setExpandedCrewMemberId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No crew performance data">Crew allocation rows that match the filters will appear here.</EmptyState>;
  }

  return (
    <div className="report-table crew-performance-table">
      <div className="report-row report-header crew-performance-row">
        <span>Crew Member</span>
        <span>Hours</span>
        <span>Entries</span>
        <span>Pay Items</span>
        <span>Jobs</span>
        <span>Avg vs Company</span>
        <span>Status</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedCrewMemberId === row.id;

        return (
          <div className="report-row-group" key={row.id}>
            <div className="report-row crew-performance-row">
              <button
                className="report-drilldown-button"
                onClick={() => setExpandedCrewMemberId(expanded ? null : row.id)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>
                  <strong>{row.crewMemberName}</strong>
                  {row.jobTitle !== "-" ? ` - ${row.jobTitle}` : ""}
                  {row.laborType ? ` (${formatCrewLaborTypeWithCompany(row)})` : ""}
                </span>
              </button>
              <span data-label="Hours">{row.totalHours.toFixed(2)}</span>
              <span data-label="Entries">{formatReportEntryCount(row)}</span>
              <span data-label="Pay Items">{row.payItemCount}</span>
              <span data-label="Jobs">{row.jobCount}</span>
              <span data-label="Avg vs Company">{formatVariance(row.weightedVariance)}</span>
              <span data-label="Status">
                <span className={`performance-pill ${row.status}`}>{formatCrewPerformanceStatus(row.status)}</span>
              </span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header crew-performance-detail-row">
                  <span>Pay Item</span>
                  <span>Hours</span>
                  <span>Quantity</span>
                  <span>Crew Hrs / Unit</span>
                  <span>Company Hrs / Unit</span>
                  <span>Difference</span>
                  <span>Entries</span>
                  <span>Jobs</span>
                </div>
                {row.payItems.map((payItem) => (
                  <div className="report-detail-row crew-performance-detail-row" key={payItem.id}>
                    <span data-label="Pay Item">{payItem.payItemLabel}</span>
                    <span data-label="Hours">{payItem.hours.toFixed(2)}</span>
                    <span data-label="Quantity">{payItem.quantityCompleted.toFixed(2)}</span>
                    <span data-label="Crew Hrs / Unit">{payItem.hoursPerUnit.toFixed(3)}</span>
                    <span data-label="Company Hrs / Unit">{payItem.companyHoursPerUnit.toFixed(3)}</span>
                    <span data-label="Difference">{formatVariance(payItem.variance)}</span>
                    <span data-label="Entries">{formatReportEntryCount(payItem)}</span>
                    <span data-label="Jobs">{payItem.jobCount}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EmployeeHoursReport({
  grouping,
  rows
}: {
  grouping: EmployeeHoursGrouping;
  rows: EmployeeHoursReportRow[];
}) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState icon={Users} title="No employee hours found">
        Saved daily report employee time rows that match the filters will appear here.
      </EmptyState>
    );
  }

  const primaryLabel = grouping === "job" ? "Job" : "Employee";
  const countLabel = grouping === "job" ? "Employees" : "Jobs";
  const detailPrimaryLabel = grouping === "job" ? "Employee" : "Date";
  const detailSecondaryLabel = grouping === "job" ? "Date" : "Job";

  return (
    <div className="report-table employee-hours-table">
      <div className="report-row report-header employee-hours-row">
        <span>{primaryLabel}</span>
        <span>{countLabel}</span>
        <span>Days Worked</span>
        <span>Total Hours</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedRowId === row.id;
        const primaryValue = grouping === "job" ? row.jobName : row.employeeName;

        return (
          <div className="report-row-group" key={row.id}>
            <div className="report-row employee-hours-row">
              <button
                aria-expanded={expanded}
                className="report-drilldown-button"
                onClick={() => setExpandedRowId(expanded ? null : row.id)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>{primaryValue}</span>
              </button>
              <span data-label={countLabel}>{grouping === "job" ? row.employeeCount : row.jobCount}</span>
              <span data-label="Days Worked">{row.daysWorked}</span>
              <span data-label="Total Hours">{row.totalHours.toFixed(2)}</span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header employee-hours-detail-row">
                  <span>{detailPrimaryLabel}</span>
                  <span>{detailSecondaryLabel}</span>
                  <span>Hours</span>
                  <span>Truck</span>
                </div>
                {row.detailRows.map((detailRow) => (
                  <div className="report-detail-row employee-hours-detail-row" key={detailRow.id}>
                    <span data-label={detailPrimaryLabel}>
                      {grouping === "job" ? detailRow.employeeName : formatReportDate(detailRow.date)}
                    </span>
                    <span data-label={detailSecondaryLabel}>
                      {grouping === "job" ? formatReportDate(detailRow.date) : detailRow.jobName}
                    </span>
                    <span data-label="Hours">{detailRow.hours.toFixed(2)}</span>
                    <span data-label="Truck">{detailRow.truckNumber || "-"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DailyWorkReport({ rows }: { rows: DailyWorkReportRow[] }) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState icon={BarChart3} title="No daily work found">
        Saved Daily Report Work Performed rows that match the filters will appear here.
      </EmptyState>
    );
  }

  return (
    <div className="report-table daily-work-table">
      <div className="report-row report-header daily-work-row">
        <span>Job</span>
        <span>Pay Item</span>
        <span>Quantity</span>
        <span>Dailies</span>
        <span>Date Range</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedRowId === row.id;

        return (
          <div className="report-row-group" key={row.id}>
            <div className="report-row daily-work-row">
              <button
                aria-expanded={expanded}
                className="report-drilldown-button"
                onClick={() => setExpandedRowId(expanded ? null : row.id)}
                type="button"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={17} />
                ) : (
                  <ChevronRight aria-hidden="true" size={17} />
                )}
                <span>{row.projectName}</span>
              </button>
              <span data-label="Pay Item">
                <strong>{row.payItemCode}</strong> - {row.payItemName}
              </span>
              <span data-label="Quantity">{formatDailyWorkQuantity(row.totalQuantity, row.unitOfMeasure)}</span>
              <span data-label="Dailies">{row.dailyReportCount}</span>
              <span data-label="Date Range">{formatDailyWorkDateRange(row.firstDate, row.lastDate)}</span>
            </div>
            {expanded ? (
              <div className="report-detail-panel">
                <div className="report-detail-row report-detail-header daily-work-detail-row">
                  <span>Date</span>
                  <span>Quantity</span>
                  <span>Notes</span>
                </div>
                {row.detailRows.map((detailRow) => (
                  <div className="report-detail-row daily-work-detail-row" key={detailRow.id}>
                    <span data-label="Date">{formatReportDate(detailRow.date)}</span>
                    <span data-label="Quantity">{formatDailyWorkQuantity(detailRow.quantity, row.unitOfMeasure)}</span>
                    <span data-label="Notes">{detailRow.notes || "-"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ReportPaginationControls({
  loading,
  onPageChange,
  page,
  pageSize,
  totalRows
}: {
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalRows: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (totalRows <= pageSize) {
    return null;
  }

  return (
    <div className="report-pagination">
      <button
        className="secondary-button"
        disabled={loading || page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages} ({totalRows} rows)
      </span>
      <button
        className="secondary-button"
        disabled={loading || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function getFilteredEmployeeHoursReportSourceRows({
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

function getFilteredDailyWorkReportSourceRows({
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

function payItemMatchesQuery(entry: AllocationEntry, normalizedQuery: string) {
  return `${entry.payItemCode} ${entry.payItemName}`.toLowerCase().includes(normalizedQuery);
}

function getReportTitle(reportMode: ReportMode) {
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

function getReportPageSize(reportMode: ReportMode) {
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

function getReportSkeletonRowCount(reportMode: ReportMode) {
  if (reportMode === "detail") {
    return 7;
  }

  if (reportMode === "employee_hours" || reportMode === "daily_work") {
    return 5;
  }

  return 6;
}

function buildReportProjectOptions(projects: Project[], entries: AllocationEntry[], dailyReportsByKey: DailyReportsByKey = {}) {
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

function exportPayItemSummaryToCsv(payItemRows: PayItemReportRow[]) {
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

function exportDailyWorkReportToCsv(rows: DailyWorkReportRow[]) {
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

