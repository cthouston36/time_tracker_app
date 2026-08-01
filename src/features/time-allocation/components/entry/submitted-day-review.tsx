import { DailyReportProcoreStatusValue } from "@/features/time-allocation/components/daily-report/daily-report-ui";
import {
  formatCrewMemberMeta,
  getCrewDisplayName
} from "@/features/time-allocation/lib/crew-entry-helpers";
import type {
  CrewSummaryRow,
  DailyReport,
  DailyReportProcoreStatus
} from "@/features/time-allocation/types";
import type { AllocationEntry } from "@/lib/domain/types";

export function SubmittedDayReview({
  crewSummaryRows,
  dailyReport,
  entries,
  procoreStatus,
  showPayItemEntries,
  totalHours
}: {
  crewSummaryRows: CrewSummaryRow[];
  dailyReport: DailyReport | undefined;
  entries: AllocationEntry[];
  procoreStatus: DailyReportProcoreStatus;
  showPayItemEntries: boolean;
  totalHours: number;
}) {
  return (
    <div className="submitted-day-review">
      <div className="submitted-day-summary">
        <div>
          <span>{showPayItemEntries ? "Pay Item Rows" : "Entry Status"}</span>
          <strong>{showPayItemEntries ? entries.length : "N/A"}</strong>
        </div>
        <div>
          <span>Total Hours</span>
          <strong>{totalHours.toFixed(2)}</strong>
        </div>
        <div>
          <span>Daily Report</span>
          <strong>{dailyReport ? "Saved" : "Not created"}</strong>
        </div>
        <div>
          <span>Procore Upload</span>
          <DailyReportProcoreStatusValue status={procoreStatus} />
        </div>
      </div>

      <div className="submitted-review-grid">
        <section className="submitted-review-section">
          <h3>Crew Hours</h3>
          {crewSummaryRows.length === 0 ? (
            <div className="field-note">No crew hours are tied to saved pay item entries for this day.</div>
          ) : (
            <div className="submitted-crew-list">
              {crewSummaryRows.map((row) => (
                <div className="submitted-crew-row" key={row.crewMemberId}>
                  <span>
                    <strong>{getCrewDisplayName(row)}</strong>
                    {formatCrewMemberMeta(row)}
                  </span>
                  <strong>{row.hours.toFixed(2)} hrs</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showPayItemEntries ? (
        entries.length > 0 ? (
          <SubmittedDayEntryTable entries={entries} />
        ) : (
          <div className="empty-state">No pay item entries for this job and date.</div>
        )
      ) : (
        <div className="field-note">This job uses daily reports and photos only, so pay item entry status is not applicable.</div>
      )}
    </div>
  );
}

function SubmittedDayEntryTable({ entries }: { entries: AllocationEntry[] }) {
  return (
    <div className="submitted-entry-table" role="table" aria-label="Submitted pay item entries">
      <div className="submitted-entry-row submitted-entry-header" role="row">
        <span>Code</span>
        <span>Pay Item</span>
        <span>Hours</span>
        <span>Quantity</span>
        <span>Crew</span>
      </div>
      {entries.map((entry) => (
        <div className="submitted-entry-row" key={entry.id} role="row">
          <span data-label="Code">
            <strong>{entry.payItemCode}</strong>
          </span>
          <span data-label="Pay Item">{entry.payItemName}</span>
          <span data-label="Hours">{entry.hours.toFixed(2)}</span>
          <span data-label="Quantity">{entry.quantityCompleted.toFixed(2)}</span>
          <SubmittedEntryCrewCell entry={entry} />
        </div>
      ))}
    </div>
  );
}

function SubmittedEntryCrewCell({ entry }: { entry: AllocationEntry }) {
  if (!entry.crewAllocations?.length) {
    return (
      <div className="submitted-entry-crew" data-label="Crew">
        <span>Unassigned</span>
      </div>
    );
  }

  return (
    <div className="submitted-entry-crew" data-label="Crew">
      {entry.crewAllocations.map((allocation, index) => (
        <span key={`${allocation.crewMemberId}-${index}`}>
          {getCrewDisplayName(allocation)} {allocation.hours.toFixed(2)}h
        </span>
      ))}
    </div>
  );
}
