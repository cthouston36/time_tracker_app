import { Edit3, Send, Trash2 } from "lucide-react";
import { EmptyState, InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import { SubmittedDayReview } from "@/features/time-allocation/components/entry/submitted-day-review";
import { formatEntryCrew } from "@/features/time-allocation/lib/crew-entry-helpers";
import { formatDate } from "@/features/time-allocation/lib/date-helpers";
import type {
  CrewSummaryRow,
  DailyReport,
  DailyReportProcoreStatus,
  DaySubmission
} from "@/features/time-allocation/types";
import type { AllocationEntry } from "@/lib/procore/types";

type EditingEntry = {
  entryId: string;
  hours: string;
  quantity: string;
};

export function ReviewSubmitPanel({
  canManageSubmittedDay,
  crewSummaryRows,
  currentDaySubmission,
  currentDailyReport,
  dayIsSubmitted,
  deletingSubmittedDay,
  editingEntry,
  entries,
  procoreStatus,
  removingEntryId,
  reopeningDay,
  savingEditedEntry,
  savingEntries,
  showPayItemEntries,
  submittingDay,
  totalHours,
  onDeleteSubmittedDay,
  onRemoveEntry,
  onReopenSubmittedDay,
  onSaveEditedEntry,
  onStartEditingEntry,
  onSubmitDay,
  onUpdateEditingEntry
}: {
  canManageSubmittedDay: boolean;
  crewSummaryRows: CrewSummaryRow[];
  currentDaySubmission: DaySubmission;
  currentDailyReport: DailyReport | undefined;
  dayIsSubmitted: boolean;
  deletingSubmittedDay: boolean;
  editingEntry: EditingEntry | null;
  entries: AllocationEntry[];
  procoreStatus: DailyReportProcoreStatus;
  removingEntryId: string | null;
  reopeningDay: boolean;
  savingEditedEntry: boolean;
  savingEntries: boolean;
  showPayItemEntries: boolean;
  submittingDay: boolean;
  totalHours: number;
  onDeleteSubmittedDay: () => void;
  onRemoveEntry: (entryId: string) => void;
  onReopenSubmittedDay: () => void;
  onSaveEditedEntry: () => void;
  onStartEditingEntry: (entry: AllocationEntry) => void;
  onSubmitDay: () => void;
  onUpdateEditingEntry: (field: "hours" | "quantity", value: string) => void;
}) {
  return (
    <div className="panel workflow-panel">
      <div className="panel-heading">
        <h2 className="workflow-title">
          <span className="workflow-step">2</span>
          {dayIsSubmitted ? "Submitted Day Summary" : "Review & Submit"}
        </h2>
        {!dayIsSubmitted ? (
          <button
            className="primary-button prominent-action"
            disabled={entries.length === 0 || submittingDay || savingEntries}
            onClick={onSubmitDay}
            type="button"
          >
            {submittingDay ? <InlineSpinner /> : <Send aria-hidden="true" size={18} />}
            {submittingDay ? "Submitting..." : "Submit day"}
          </button>
        ) : null}
      </div>
      <div className="daily-actions">
        <span className="field-note">
          {dayIsSubmitted && currentDaySubmission.submittedByName && currentDaySubmission.submittedAt
            ? `Submitted by ${currentDaySubmission.submittedByName} on ${formatDate(currentDaySubmission.submittedAt)}`
            : "Draft day"}
        </span>
        {dayIsSubmitted && canManageSubmittedDay ? (
          <div className="admin-day-actions">
            <button
              className="secondary-button"
              disabled={reopeningDay || deletingSubmittedDay}
              onClick={onReopenSubmittedDay}
              type="button"
            >
              {reopeningDay ? <InlineSpinner /> : null}
              {reopeningDay ? "Reopening..." : "Reopen day"}
            </button>
            <button
              className="secondary-button"
              disabled={reopeningDay || deletingSubmittedDay}
              onClick={onDeleteSubmittedDay}
              type="button"
            >
              {deletingSubmittedDay ? <InlineSpinner /> : <Trash2 aria-hidden="true" size={18} />}
              {deletingSubmittedDay ? "Deleting..." : "Delete submitted day"}
            </button>
          </div>
        ) : null}
      </div>
      {dayIsSubmitted ? (
        <SubmittedDayReview
          crewSummaryRows={crewSummaryRows}
          dailyReport={currentDailyReport}
          entries={entries}
          procoreStatus={procoreStatus}
          showPayItemEntries={showPayItemEntries}
          totalHours={totalHours}
        />
      ) : (
        <DraftEntryReviewList
          dayIsSubmitted={dayIsSubmitted}
          editingEntry={editingEntry}
          entries={entries}
          removingEntryId={removingEntryId}
          savingEditedEntry={savingEditedEntry}
          onRemoveEntry={onRemoveEntry}
          onSaveEditedEntry={onSaveEditedEntry}
          onStartEditingEntry={onStartEditingEntry}
          onUpdateEditingEntry={onUpdateEditingEntry}
        />
      )}
    </div>
  );
}

function DraftEntryReviewList({
  dayIsSubmitted,
  editingEntry,
  entries,
  removingEntryId,
  savingEditedEntry,
  onRemoveEntry,
  onSaveEditedEntry,
  onStartEditingEntry,
  onUpdateEditingEntry
}: {
  dayIsSubmitted: boolean;
  editingEntry: EditingEntry | null;
  entries: AllocationEntry[];
  removingEntryId: string | null;
  savingEditedEntry: boolean;
  onRemoveEntry: (entryId: string) => void;
  onSaveEditedEntry: () => void;
  onStartEditingEntry: (entry: AllocationEntry) => void;
  onUpdateEditingEntry: (field: "hours" | "quantity", value: string) => void;
}) {
  return (
    <div className="entry-list">
      {entries.length === 0 ? (
        <EmptyState title="No saved pay item rows">
          Saved rows for this job and date will appear here before submission.
        </EmptyState>
      ) : (
        entries.map((entry) => (
          <div className="entry-row" key={entry.id}>
            <span>
              <strong>{entry.payItemCode}</strong> {entry.payItemName}
            </span>
            {editingEntry?.entryId === entry.id ? (
              <>
                <input
                  aria-label={`Edit hours for ${entry.payItemCode}`}
                  className="compact-input number-entry"
                  min="0"
                  placeholder="Hours"
                  step="0.25"
                  type="number"
                  value={editingEntry.hours}
                  onChange={(event) => onUpdateEditingEntry("hours", event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                />
                <input
                  aria-label={`Edit quantity for ${entry.payItemCode}`}
                  className="compact-input number-entry"
                  min="0"
                  placeholder="Quantity"
                  step="0.01"
                  type="number"
                  value={editingEntry.quantity}
                  onChange={(event) => onUpdateEditingEntry("quantity", event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                />
                <button className="secondary-button" disabled={savingEditedEntry} onClick={onSaveEditedEntry} type="button">
                  {savingEditedEntry ? <InlineSpinner /> : null}
                  {savingEditedEntry ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <span>{entry.hours.toFixed(2)} hrs</span>
                <span>{entry.quantityCompleted.toFixed(2)} qty</span>
                <span className="entry-crew">{formatEntryCrew(entry)}</span>
                <button
                  aria-label={`Edit ${entry.payItemCode}`}
                  className="icon-button"
                  disabled={dayIsSubmitted}
                  onClick={() => onStartEditingEntry(entry)}
                  type="button"
                >
                  <Edit3 aria-hidden="true" size={17} />
                </button>
              </>
            )}
            <button
              aria-label={`Remove ${entry.payItemCode}`}
              className="icon-button"
              disabled={dayIsSubmitted || removingEntryId === entry.id}
              onClick={() => onRemoveEntry(entry.id)}
              type="button"
            >
              {removingEntryId === entry.id ? <InlineSpinner /> : <Trash2 aria-hidden="true" size={17} />}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
