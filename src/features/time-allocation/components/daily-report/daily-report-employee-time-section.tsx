"use client";

import { Copy } from "lucide-react";
import {
  TWO_SERIES_PRODUCTION_CODES,
  formatTwoSeriesProductionCodeLabel
} from "@/lib/daily-report-templates";
import type {
  DailyReportEmployeeRow,
  DailyReportTimeField
} from "@/features/time-allocation/types";

export function DailyReportEmployeeTimeSection({
  canCopyPreviousCrewTime,
  isTwoSeriesTemplate,
  previousCrewTimeLabel,
  rows,
  onCopyPreviousCrewTime,
  onEmployeeChange,
  onEmployeeTimeBlur
}: {
  canCopyPreviousCrewTime: boolean;
  isTwoSeriesTemplate: boolean;
  previousCrewTimeLabel: string;
  rows: DailyReportEmployeeRow[];
  onCopyPreviousCrewTime: () => void;
  onEmployeeChange: (rowIndex: number, field: keyof DailyReportEmployeeRow, value: string | boolean) => void;
  onEmployeeTimeBlur: (rowIndex: number, field: DailyReportTimeField) => void;
}) {
  return (
    <section>
      <div className="daily-section-heading">
        <h3>Employee Time on Site</h3>
        <button
          className="secondary-button compact-button"
          disabled={!canCopyPreviousCrewTime}
          onClick={onCopyPreviousCrewTime}
          type="button"
        >
          <Copy aria-hidden="true" size={16} />
          {previousCrewTimeLabel}
        </button>
      </div>
      <div
        className={isTwoSeriesTemplate ? "daily-labor-table two-series" : "daily-labor-table"}
        role="table"
        aria-label="Employee time on site"
      >
        <div className="daily-labor-row daily-labor-header" role="row">
          <span>#</span>
          <span>Employee Name</span>
          <span>Truck #</span>
          <span>Time In</span>
          <span>Lunch Out</span>
          <span>Lunch In</span>
          <span>Time Out</span>
          {isTwoSeriesTemplate ? (
            <>
              <span>Code</span>
              <span>Hrs</span>
              <span>Code</span>
              <span>Hrs</span>
              <span>Total Hours</span>
            </>
          ) : (
            <>
              <span>Total Hours</span>
              <span>Driver</span>
              <span>Passenger</span>
            </>
          )}
        </div>
        {rows.map((row, index) => (
          <DailyReportEmployeeTimeRow
            index={index}
            isTwoSeriesTemplate={isTwoSeriesTemplate}
            key={index}
            row={row}
            onEmployeeChange={onEmployeeChange}
            onEmployeeTimeBlur={onEmployeeTimeBlur}
          />
        ))}
      </div>
      {isTwoSeriesTemplate ? <TwoSeriesProductionTotals rows={rows} /> : null}
    </section>
  );
}

function DailyReportEmployeeTimeRow({
  index,
  isTwoSeriesTemplate,
  row,
  onEmployeeChange,
  onEmployeeTimeBlur
}: {
  index: number;
  isTwoSeriesTemplate: boolean;
  row: DailyReportEmployeeRow;
  onEmployeeChange: (rowIndex: number, field: keyof DailyReportEmployeeRow, value: string | boolean) => void;
  onEmployeeTimeBlur: (rowIndex: number, field: DailyReportTimeField) => void;
}) {
  const rowNumber = index + 1;

  return (
    <div className="daily-labor-row" role="row">
      <span className="daily-labor-index">{rowNumber}</span>
      <input
        aria-label={`Employee name and classification row ${rowNumber}`}
        value={row.employeeClassification}
        onChange={(event) => onEmployeeChange(index, "employeeClassification", event.target.value)}
      />
      <input
        aria-label={`Truck number row ${rowNumber}`}
        value={row.truckNumber}
        onChange={(event) => onEmployeeChange(index, "truckNumber", event.target.value)}
      />
      <input
        aria-label={`Time in row ${rowNumber}`}
        inputMode="numeric"
        maxLength={5}
        placeholder="7:00"
        value={row.timeIn}
        onChange={(event) => onEmployeeChange(index, "timeIn", event.target.value)}
        onBlur={() => onEmployeeTimeBlur(index, "timeIn")}
      />
      <input
        aria-label={`Lunch out row ${rowNumber}`}
        inputMode="numeric"
        maxLength={5}
        placeholder="12:00"
        value={row.lunchOut}
        onChange={(event) => onEmployeeChange(index, "lunchOut", event.target.value)}
        onBlur={() => onEmployeeTimeBlur(index, "lunchOut")}
      />
      <input
        aria-label={`Lunch in row ${rowNumber}`}
        inputMode="numeric"
        maxLength={5}
        placeholder="12:30"
        value={row.lunchIn}
        onChange={(event) => onEmployeeChange(index, "lunchIn", event.target.value)}
        onBlur={() => onEmployeeTimeBlur(index, "lunchIn")}
      />
      <input
        aria-label={`Time out row ${rowNumber}`}
        inputMode="numeric"
        maxLength={5}
        placeholder="5:00"
        value={row.timeOut}
        onChange={(event) => onEmployeeChange(index, "timeOut", event.target.value)}
        onBlur={() => onEmployeeTimeBlur(index, "timeOut")}
      />
      {isTwoSeriesTemplate ? (
        <>
          <ProductionCodeSelect
            label={`Production code 1 row ${rowNumber}`}
            value={row.productionCode1}
            onChange={(value) => onEmployeeChange(index, "productionCode1", value)}
          />
          <ProductionHoursInput
            label={`Production hours 1 row ${rowNumber}`}
            value={row.productionHours1}
            onChange={(value) => onEmployeeChange(index, "productionHours1", value)}
          />
          <ProductionCodeSelect
            label={`Production code 2 row ${rowNumber}`}
            value={row.productionCode2}
            onChange={(value) => onEmployeeChange(index, "productionCode2", value)}
          />
          <ProductionHoursInput
            label={`Production hours 2 row ${rowNumber}`}
            value={row.productionHours2}
            onChange={(value) => onEmployeeChange(index, "productionHours2", value)}
          />
        </>
      ) : null}
      <input aria-label={`Total hours row ${rowNumber}`} readOnly tabIndex={-1} value={row.totalHours} />
      {!isTwoSeriesTemplate ? (
        <>
          <label className="daily-labor-check">
            <input
              checked={row.driver}
              type="checkbox"
              onChange={(event) => onEmployeeChange(index, "driver", event.target.checked)}
            />
            <span className="sr-only">Driver row {rowNumber}</span>
          </label>
          <label className="daily-labor-check">
            <input
              checked={row.passenger}
              type="checkbox"
              onChange={(event) => onEmployeeChange(index, "passenger", event.target.checked)}
            />
            <span className="sr-only">Passenger row {rowNumber}</span>
          </label>
        </>
      ) : null}
    </div>
  );
}

function ProductionCodeSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Code</option>
      {TWO_SERIES_PRODUCTION_CODES.map((productionCode) => (
        <option key={productionCode.code} value={productionCode.code}>
          {formatTwoSeriesProductionCodeLabel(productionCode)}
        </option>
      ))}
    </select>
  );
}

function ProductionHoursInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      min="0"
      placeholder="Hours"
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onWheel={(event) => event.currentTarget.blur()}
    />
  );
}

function TwoSeriesProductionTotals({ rows }: { rows: DailyReportEmployeeRow[] }) {
  const productionTotals = getTwoSeriesProductionTotals(rows);

  return (
    <div className="production-code-totals" aria-label="Production code hour totals">
      <div className="production-code-totals-heading">
        <strong>Production Code Totals</strong>
        <span>{formatHours(productionTotals.reduce((total, row) => total + row.hours, 0))} hrs</span>
      </div>
      {productionTotals.length === 0 ? (
        <span className="field-note">No production hours entered yet.</span>
      ) : (
        <div className="production-code-total-list">
          {productionTotals.map((total) => (
            <div className="production-code-total-row" key={total.code}>
              <span>
                <strong>{total.code}</strong>
                {total.description}
              </span>
              <strong>{formatHours(total.hours)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTwoSeriesProductionTotals(rows: DailyReportEmployeeRow[]) {
  const codeDescriptions = new Map(
    TWO_SERIES_PRODUCTION_CODES.map((productionCode) => [productionCode.code, productionCode.description])
  );
  const totalsByCode = new Map<string, number>();

  for (const row of rows) {
    const pairs = [
      [row.productionCode1, row.productionHours1],
      [row.productionCode2, row.productionHours2]
    ];

    for (const [codeValue, hoursValue] of pairs) {
      const code = codeValue.trim();
      const hours = parseDailyReportPositiveNumber(hoursValue);

      if (!code || hours === null || hours <= 0) {
        continue;
      }

      totalsByCode.set(code, (totalsByCode.get(code) ?? 0) + hours);
    }
  }

  return TWO_SERIES_PRODUCTION_CODES
    .filter((productionCode) => totalsByCode.has(productionCode.code))
    .map((productionCode) => ({
      code: productionCode.code,
      description: codeDescriptions.get(productionCode.code) ?? productionCode.description,
      hours: totalsByCode.get(productionCode.code) ?? 0
    }));
}

function parseDailyReportPositiveNumber(value: string) {
  const number = Number(value.replaceAll(",", "").trim());

  return Number.isFinite(number) ? number : null;
}

function formatHours(value: number) {
  return value.toFixed(2);
}
