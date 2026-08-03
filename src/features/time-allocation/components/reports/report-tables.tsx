"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronRight, Users } from "lucide-react";
import type {
  CrewPerformanceRow,
  DailyWorkReportRow,
  DetailGrouping,
  DetailSort,
  EmployeeHoursGrouping,
  EmployeeHoursReportRow,
  PayItemDetailAnalysisRow,
  PayItemReportRow,
  ReportPayItemOption
} from "@/lib/report-builders";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import {
  formatCrewLaborTypeWithCompany,
  formatCrewPerformanceStatus,
  formatDailyWorkDateRange,
  formatDailyWorkQuantity,
  formatReportDate,
  formatReportEntryCount,
  formatVariance
} from "@/features/time-allocation/lib/report-formatters";

export function PayItemReportTable({ rows }: { rows: PayItemReportRow[] }) {
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

export function DetailedPayItemReport({
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

export function CrewPerformanceInfo() {
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

export function CrewPerformanceReport({ rows }: { rows: CrewPerformanceRow[] }) {
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

export function EmployeeHoursReport({
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

export function DailyWorkReport({ rows }: { rows: DailyWorkReportRow[] }) {
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

export function ReportPaginationControls({
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
