"use client";

import { ExternalLink, Save, X } from "lucide-react";
import { TWO_SERIES_PRODUCTION_CODES } from "@/lib/daily-report-templates";
import type { Project } from "@/lib/domain/types";
import { DailyReportEmployeeTimeSection } from "@/features/time-allocation/components/daily-report/daily-report-employee-time-section";
import { DailyReportStandardFields } from "@/features/time-allocation/components/daily-report/daily-report-standard-fields";
import type {
  DailyReportAnswers,
  DailyReportEmployeeRow,
  DailyReportItsfmRow,
  DailyReportPayItemRow,
  DailyReportTimeField
} from "@/features/time-allocation/types";

const DAILY_REPORT_VALIDATION_NOTICE_PREFIX = "Daily report needs attention";

export function DailyReportProcoreStatusValue({
  status
}: {
  status: {
    className: string;
    href?: string;
    label: string;
  };
}) {
  const className = `daily-report-procore-status ${status.className}`;

  if (status.href && status.className === "uploaded") {
    return (
      <a className={className} href={status.href} rel="noreferrer" target="_blank">
        {status.label}
        <ExternalLink aria-hidden="true" size={13} />
      </a>
    );
  }

  return <strong className={className}>{status.label}</strong>;
}

export function DailyReportModal({
  canCopyPreviousCrewTime,
  canUseSavedEntries,
  date,
  draft,
  draftNotice,
  isTwoSeriesTemplate,
  payItems,
  previousCrewTimeLabel,
  projectName,
  onChange,
  onCopyPreviousCrewTime,
  onCopySavedEntriesToWorkRows,
  onEmployeeChange,
  onEmployeeTimeBlur,
  onItsfmChange,
  onPayItemChange,
  onClose,
  onSave
}: {
  canCopyPreviousCrewTime: boolean;
  canUseSavedEntries: boolean;
  date: string;
  draft: DailyReportAnswers;
  draftNotice: string;
  isTwoSeriesTemplate: boolean;
  payItems: Project["payItems"];
  previousCrewTimeLabel: string;
  projectName: string;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
  onCopyPreviousCrewTime: () => void;
  onCopySavedEntriesToWorkRows: () => void;
  onEmployeeChange: (rowIndex: number, field: keyof DailyReportEmployeeRow, value: string | boolean) => void;
  onEmployeeTimeBlur: (rowIndex: number, field: DailyReportTimeField) => void;
  onItsfmChange: (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => void;
  onPayItemChange: (rowIndex: number, field: keyof DailyReportPayItemRow, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const draftNoticeIsValidation = draftNotice.startsWith(DAILY_REPORT_VALIDATION_NOTICE_PREFIX);

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-panel daily-report-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <h2>Create Daily Report</h2>
            <span>
              {projectName} - {formatDate(date)}
            </span>
          </div>
          <button aria-label="Close daily report" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {draftNotice ? (
          <div className={draftNoticeIsValidation ? "inline-alert daily-draft-notice" : "field-note daily-draft-notice"}>
            {draftNotice}
          </div>
        ) : null}

        <div className="daily-report-form">
          <DailyReportEmployeeTimeSection
            canCopyPreviousCrewTime={canCopyPreviousCrewTime}
            isTwoSeriesTemplate={isTwoSeriesTemplate}
            previousCrewTimeLabel={previousCrewTimeLabel}
            rows={draft.employeeRows}
            onCopyPreviousCrewTime={onCopyPreviousCrewTime}
            onEmployeeChange={onEmployeeChange}
            onEmployeeTimeBlur={onEmployeeTimeBlur}
          />

          {isTwoSeriesTemplate ? (
            <TwoSeriesDailyReportFields draft={draft} onChange={onChange} />
          ) : (
            <DailyReportStandardFields
              canUseSavedEntries={canUseSavedEntries}
              draft={draft}
              payItems={payItems}
              onChange={onChange}
              onCopySavedEntriesToWorkRows={onCopySavedEntriesToWorkRows}
              onItsfmChange={onItsfmChange}
              onPayItemChange={onPayItemChange}
            />
          )}
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" onClick={onSave} type="button">
            <Save aria-hidden="true" size={18} />
            Save Daily Report
          </button>
        </div>
      </div>
    </div>
  );
}

function TwoSeriesDailyReportFields({
  draft,
  onChange
}: {
  draft: DailyReportAnswers;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
}) {
  return (
    <>
      <section>
        <h3>Production Code Key</h3>
        <div className="production-code-key">
          {TWO_SERIES_PRODUCTION_CODES.map((productionCode) => (
            <div className="production-code-key-item" key={productionCode.code}>
              <strong>{productionCode.code}</strong>
              <span>{productionCode.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Work Completed</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-work-description">Detailed Description of Work Completed</label>
          <textarea
            id="daily-two-series-work-description"
            value={draft.workDescription}
            onChange={(event) => onChange("workDescription", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Equipment / Tools on Project</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-equipment-tools">Equipment / Tools on Project</label>
          <textarea
            id="daily-two-series-equipment-tools"
            value={draft.twoSeriesEquipmentTools}
            onChange={(event) => onChange("twoSeriesEquipmentTools", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Safety Issues & Concerns</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-safety">Safety Issues & Concerns</label>
          <textarea
            id="daily-two-series-safety"
            value={draft.twoSeriesSafetyIssues}
            onChange={(event) => onChange("twoSeriesSafetyIssues", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Problems / Delays</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-delays">Problems or Reasons for Delay</label>
          <textarea
            id="daily-two-series-delays"
            value={draft.twoSeriesDelayReasons}
            onChange={(event) => onChange("twoSeriesDelayReasons", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Deliveries</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-deliveries">Deliveries</label>
          <textarea
            id="daily-two-series-deliveries"
            value={draft.twoSeriesDeliveries}
            onChange={(event) => onChange("twoSeriesDeliveries", event.target.value)}
          />
        </div>
      </section>
    </>
  );
}

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}
