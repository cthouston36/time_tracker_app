"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, Download, Info, ListChecks } from "lucide-react";
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
  type DetailGrouping,
  type DetailSort,
  type EmployeeHoursGrouping,
  type EmployeeHoursReportRow,
  type PayItemDetailAnalysisRow,
  type PayItemReportRow,
  type ReportMetric,
  type ReportMode
} from "@/lib/report-builders";
import {
  PageHeader,
  ReportControlsLoadingSkeleton,
  ReportLoadingSkeleton
} from "@/features/time-allocation/components/workspace-primitives";
import {
  CrewPerformanceInfo,
  CrewPerformanceReport,
  DailyWorkReport,
  DetailedPayItemReport,
  EmployeeHoursReport,
  PayItemReportTable,
  ReportPaginationControls
} from "@/features/time-allocation/components/reports/report-tables";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import { MyJobsManager } from "@/features/time-allocation/components/my-jobs-manager";
import { getDefaultMyJobIdsForUser } from "@/features/time-allocation/lib/selectors";
import { downloadBlob, openDatePicker } from "@/features/time-allocation/lib/browser-actions";
import { formatReportDate } from "@/features/time-allocation/lib/report-formatters";
import {
  buildReportProjectOptions,
  exportDailyWorkReportToCsv,
  exportPayItemSummaryToCsv,
  getFilteredDailyWorkReportSourceRows,
  getFilteredEmployeeHoursReportSourceRows,
  getReportPageSize,
  getReportSkeletonRowCount,
  getReportTitle,
  payItemMatchesQuery,
  type DailyReportsByKey,
  type ReportResponse
} from "@/features/time-allocation/lib/report-view-helpers";
import { exportServerReportCsv, loadServerReport } from "@/features/time-allocation/lib/reports-api";
import { isAbortError } from "@/features/time-allocation/lib/api-utils";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/domain/types";

const CREW_LABOR_TYPE_OPTIONS: Array<{ value: CrewLaborType; label: string }> = [
  { value: "chinchor_employee", label: "Chinchor Employee" },
  { value: "temp_employee", label: "Temp Employee" },
  { value: "subcontractor", label: "Subcontractor" }
];
const ALL_CREW_LABOR_TYPES = CREW_LABOR_TYPE_OPTIONS.map((option) => option.value);

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

    loadServerReport({
      allowedProjectIds: allowedReportProjectIds,
      crewLaborTypes: reportCrewLaborTypes,
      detailGrouping,
      detailPayItemQuery,
      detailSort,
      employeeHoursGrouping,
      endDate: reportEndDate,
      excludeOutliers: excludeReportOutliers,
      mode: reportMode,
      myJobIds: reportMyJobIds,
      page: reportPage,
      pageSize: reportPageSize,
      projectId: reportProjectId,
      reportMetric,
      signal: controller.signal,
      startDate: reportStartDate
    })
      .then((data) => {
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
      const blob = await exportServerReportCsv({
        allowedProjectIds: allowedReportProjectIds,
        crewLaborTypes: reportCrewLaborTypes,
        endDate: reportEndDate,
        excludeOutliers: excludeReportOutliers,
        mode: reportMode === "daily_work" ? "daily_work" : "summary",
        myJobIds: reportMyJobIds,
        projectId: reportProjectId,
        reportMetric,
        startDate: reportStartDate
      });
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

