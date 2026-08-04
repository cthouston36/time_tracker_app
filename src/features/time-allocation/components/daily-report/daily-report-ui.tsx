"use client";

import { ExternalLink, Save, X } from "lucide-react";
import type { Project } from "@/lib/domain/types";
import { formatDate } from "@/lib/date";
import { DailyReportEmployeeTimeSection } from "@/features/time-allocation/components/daily-report/daily-report-employee-time-section";
import { DailyReportStandardFields } from "@/features/time-allocation/components/daily-report/daily-report-standard-fields";
import { DailyReportTwoSeriesFields } from "@/features/time-allocation/components/daily-report/daily-report-two-series-fields";
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
            <DailyReportTwoSeriesFields draft={draft} onChange={onChange} />
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
