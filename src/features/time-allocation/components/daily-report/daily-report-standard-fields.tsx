"use client";

import { Copy } from "lucide-react";
import type { PayItem, Project } from "@/lib/domain/types";
import {
  DAILY_REPORT_ITSFM_ITEMS,
  createEmptyDailyReportItsfmRow,
  normalizeDailyReportItsfmRows
} from "@/features/time-allocation/lib/daily-report-helpers";
import type {
  DailyReportAnswers,
  DailyReportItsfmRow,
  DailyReportPayItemRow
} from "@/features/time-allocation/types";

export function DailyReportStandardFields({
  canUseSavedEntries,
  draft,
  payItems,
  onChange,
  onCopySavedEntriesToWorkRows,
  onItsfmChange,
  onPayItemChange
}: {
  canUseSavedEntries: boolean;
  draft: DailyReportAnswers;
  payItems: Project["payItems"];
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
  onCopySavedEntriesToWorkRows: () => void;
  onItsfmChange: (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => void;
  onPayItemChange: (rowIndex: number, field: keyof DailyReportPayItemRow, value: string) => void;
}) {
  const inspectorQuantitiesTurnedIn = draft.quantitiesTurnedIn === "yes";
  const incidentOccurred = draft.incidentOccurred === "yes";

  return (
    <>
      <section>
        <h3>Inspector / Quantities</h3>
        <div className="daily-report-grid two">
          <div className="field-group">
            <label htmlFor="daily-quantities-turned-in">Did you turn quantities into the inspector today?</label>
            <select
              id="daily-quantities-turned-in"
              value={draft.quantitiesTurnedIn}
              onChange={(event) => onChange("quantitiesTurnedIn", event.target.value)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {inspectorQuantitiesTurnedIn ? (
            <div className="field-group">
              <label htmlFor="daily-inspector-name">Inspector Name</label>
              <input
                id="daily-inspector-name"
                value={draft.inspectorName}
                onChange={(event) => onChange("inspectorName", event.target.value)}
              />
            </div>
          ) : null}
        </div>
        {inspectorQuantitiesTurnedIn ? (
          <div className="field-group">
            <label htmlFor="daily-inspector-quantity-details">Quantities and items turned into the inspector</label>
            <textarea
              id="daily-inspector-quantity-details"
              value={draft.inspectorQuantityDetails}
              onChange={(event) => onChange("inspectorQuantityDetails", event.target.value)}
            />
          </div>
        ) : null}
      </section>

      <section>
        <div className="daily-section-heading">
          <h3>Work Performed</h3>
          <div className="daily-section-actions">
            <button
              className="secondary-button compact-button"
              disabled={!canUseSavedEntries}
              onClick={onCopySavedEntriesToWorkRows}
              type="button"
            >
              <Copy aria-hidden="true" size={16} />
              Use Saved Entries
            </button>
          </div>
        </div>
        <div className="daily-pay-item-table" role="table" aria-label="Daily report pay item quantities">
          <div className="daily-pay-item-row daily-pay-item-header" role="row">
            <span>#</span>
            <span>Pay Item # / Description</span>
            <span>Quantity</span>
            <span>Notes</span>
          </div>
          {draft.payItemRows.map((row, index) => {
            const selectedPayItem = payItems.find((payItem) => payItem.id === row.payItemId);

            return (
              <div className="daily-pay-item-row" key={index} role="row">
                <span className="daily-labor-index">{index + 1}</span>
                <select
                  aria-label={`Pay item row ${index + 1}`}
                  value={row.payItemId}
                  onChange={(event) => onPayItemChange(index, "payItemId", event.target.value)}
                >
                  <option value="">Select pay item</option>
                  {payItems.map((payItem) => (
                    <option key={payItem.id} value={payItem.id}>
                      {payItem.code} - {payItem.name}
                    </option>
                  ))}
                </select>
                <div className="daily-pay-item-quantity">
                  <input
                    aria-label={`Quantity row ${index + 1}`}
                    inputMode="decimal"
                    min="0"
                    type="number"
                    value={row.quantity}
                    onChange={(event) => onPayItemChange(index, "quantity", event.target.value)}
                    onWheel={(event) => event.currentTarget.blur()}
                  />
                  <span>{formatPayItemUnitOfMeasure(selectedPayItem)}</span>
                </div>
                <textarea
                  aria-label={`Notes row ${index + 1}`}
                  placeholder="Notes"
                  rows={getDailyReportPayItemNotesRows(row.notes)}
                  value={row.notes}
                  onChange={(event) => onPayItemChange(index, "notes", event.target.value)}
                />
              </div>
            );
          })}
        </div>
        <div className="daily-report-grid two">
          <div className="field-group">
            <label htmlFor="daily-work-description">Description of Work Provided</label>
            <textarea
              id="daily-work-description"
              value={draft.workDescription}
              onChange={(event) => onChange("workDescription", event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="daily-plan-sheets">Plan Sheet Numbers</label>
            <textarea
              id="daily-plan-sheets"
              value={draft.planSheetNumbers}
              onChange={(event) => onChange("planSheetNumbers", event.target.value)}
            />
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="daily-work-details">
            Details of work performed today, including station number, corner, area, and partial items
          </label>
          <textarea
            id="daily-work-details"
            value={draft.workDetails}
            onChange={(event) => onChange("workDetails", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Incidents / Accidents</h3>
        <div className="daily-report-grid two">
          <div className="field-group">
            <label htmlFor="daily-incident-occurred">Were there any incidents or accidents today?</label>
            <select
              id="daily-incident-occurred"
              value={draft.incidentOccurred}
              onChange={(event) => onChange("incidentOccurred", event.target.value)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {incidentOccurred ? (
            <div className="field-group">
              <label htmlFor="daily-accident-report-filed">Accident report filed?</label>
              <select
                id="daily-accident-report-filed"
                value={draft.accidentReportFiled}
                onChange={(event) => onChange("accidentReportFiled", event.target.value)}
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          ) : null}
        </div>
        {incidentOccurred ? (
          <div className="field-group">
            <label htmlFor="daily-incident-details">Incident / Accident Details</label>
            <textarea
              id="daily-incident-details"
              value={draft.incidentDetails}
              onChange={(event) => onChange("incidentDetails", event.target.value)}
            />
          </div>
        ) : null}
      </section>

      <section>
        <h3>MOT Quantities</h3>
        <div className="daily-report-grid four">
          <DailyReportNumberField field="motSigns" label="Total MOT Signs" onChange={onChange} value={draft.motSigns} />
          <DailyReportNumberField field="conesBarrels" label="Cones / Barrels" onChange={onChange} value={draft.conesBarrels} />
          <DailyReportNumberField
            field="typeIISidewalkBarricades"
            label="Type II Sidewalk Closed Barricades / Signs"
            onChange={onChange}
            value={draft.typeIISidewalkBarricades}
          />
          <DailyReportNumberField
            field="typeIIIBarricades"
            label="Type III Barricades"
            onChange={onChange}
            value={draft.typeIIIBarricades}
          />
          <DailyReportNumberField field="lcdCount" label="LCD Count" onChange={onChange} value={draft.lcdCount} />
          <DailyReportNumberField field="lcdFootage" label="LCD Total Footage" onChange={onChange} value={draft.lcdFootage} />
          <DailyReportNumberField field="arrowBoards" label="Arrow Boards" onChange={onChange} value={draft.arrowBoards} />
          <DailyReportNumberField field="vmsBoards" label="VMS Boards" onChange={onChange} value={draft.vmsBoards} />
        </div>
        <div className="field-group">
          <label htmlFor="daily-fdot-index">FDOT Index Used</label>
          <input
            id="daily-fdot-index"
            value={draft.fdotIndex}
            onChange={(event) => onChange("fdotIndex", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>ITSFM Itemized List</h3>
        <DailyReportItsfmMatrix rows={draft.itsfmRows} onChange={onItsfmChange} />
      </section>
    </>
  );
}

function DailyReportNumberField({
  field,
  label,
  onChange,
  value
}: {
  field: keyof DailyReportAnswers;
  label: string;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
  value: string;
}) {
  return (
    <div className="field-group">
      <label htmlFor={`daily-${field}`}>{label}</label>
      <input
        id={`daily-${field}`}
        inputMode="decimal"
        min="0"
        type="number"
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        onWheel={(event) => event.currentTarget.blur()}
      />
    </div>
  );
}

function DailyReportItsfmMatrix({
  rows,
  onChange
}: {
  rows: DailyReportItsfmRow[];
  onChange: (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => void;
}) {
  const rowsByKey = new Map(normalizeDailyReportItsfmRows(rows).map((row) => [row.itemKey, row]));
  const groups = Array.from(new Set(DAILY_REPORT_ITSFM_ITEMS.map((item) => item.group)));

  return (
    <div className="daily-itsfm-table" role="table" aria-label="ITSFM itemized list">
      <div className="daily-itsfm-row daily-itsfm-header" role="row">
        <span>Item</span>
        <span>Model #</span>
        <span>S/N</span>
        <span>Location</span>
      </div>
      {groups.map((group) => (
        <div className="daily-itsfm-section" key={group}>
          <div className="daily-itsfm-section-heading">{group}</div>
          {DAILY_REPORT_ITSFM_ITEMS.filter((item) => item.group === group).map((item) => {
            const row = rowsByKey.get(item.key) ?? createEmptyDailyReportItsfmRow(item.key);

            return (
              <div className="daily-itsfm-row" key={item.key} role="row">
                <span className="daily-itsfm-item-label">{item.label}</span>
                <input
                  aria-label={`${item.label} model number`}
                  value={row.modelNumber}
                  onChange={(event) => onChange(item.key, "modelNumber", event.target.value)}
                />
                <input
                  aria-label={`${item.label} serial number`}
                  value={row.serialNumber}
                  onChange={(event) => onChange(item.key, "serialNumber", event.target.value)}
                />
                <input
                  aria-label={`${item.label} location`}
                  value={row.location}
                  onChange={(event) => onChange(item.key, "location", event.target.value)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatPayItemUnitOfMeasure(payItem: Pick<PayItem, "unitOfMeasure"> | null | undefined) {
  return typeof payItem?.unitOfMeasure === "string" ? payItem.unitOfMeasure.toUpperCase() : "";
}

function getDailyReportPayItemNotesRows(value: string | undefined) {
  const text = value ?? "";
  const explicitLines = text.split(/\r\n|\r|\n/).length;
  const wrappedLines = Math.ceil(text.length / 42);

  return Math.min(6, Math.max(1, explicitLines, wrappedLines));
}
