import { Save, X } from "lucide-react";
import type { AllocationEntry, Project } from "@/lib/procore/types";
import { InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import { PayItemMatrix } from "@/features/time-allocation/components/entry/pay-item-entry-matrix";
import { formatDate } from "@/features/time-allocation/lib/date-helpers";
import { getEntryNoticeClassName } from "@/features/time-allocation/lib/notice-helpers";
import type {
  CrewMember,
  DraftsByPayItem
} from "@/features/time-allocation/types";

export function MatrixFullscreenModal({
  crewMembers,
  dayIsSubmitted,
  draftEntryCount,
  draftsByPayItem,
  entryNotice,
  payItems,
  project,
  remainingQuantitiesByPayItem,
  savedEntries,
  savingEntries,
  workDate,
  onClearDraftInputs,
  onClose,
  onCrewHoursChange,
  onCrewToggle,
  onDraftChange,
  onSaveEntries,
  onSplitEvenly
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draftEntryCount: number;
  draftsByPayItem: DraftsByPayItem;
  entryNotice: string;
  payItems: Project["payItems"];
  project: Project;
  remainingQuantitiesByPayItem: Record<string, number>;
  savedEntries: AllocationEntry[];
  savingEntries: boolean;
  workDate: string;
  onClearDraftInputs: () => void;
  onClose: () => void;
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onDraftChange: (payItemId: string, field: "hours" | "quantity", value: string) => void;
  onSaveEntries: () => void;
  onSplitEvenly: (payItemId: string) => void;
}) {
  return (
    <div className="modal-backdrop matrix-fullscreen-backdrop" role="presentation">
      <div aria-modal="true" className="modal-panel matrix-fullscreen-panel" role="dialog">
        <div className="modal-heading matrix-fullscreen-heading">
          <div>
            <h2>Pay Item Entry</h2>
            <span>
              {project.name} - {formatDate(workDate)}
            </span>
          </div>
          <button
            aria-label="Close expanded pay item matrix"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="matrix-fullscreen-toolbar">
          <span className="field-note">
            {draftEntryCount} row{draftEntryCount === 1 ? "" : "s"} ready to save
          </span>
        </div>
        <div className="matrix-fullscreen-body">
          {payItems.length > 0 ? (
            <PayItemMatrix
              ariaLabel="Expanded pay item entry matrix"
              crewMembers={crewMembers}
              dayIsSubmitted={dayIsSubmitted}
              draftsByPayItem={draftsByPayItem}
              payItems={payItems}
              remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
              savedEntries={savedEntries}
              variant="fullscreen"
              onCrewHoursChange={onCrewHoursChange}
              onCrewToggle={onCrewToggle}
              onDraftChange={onDraftChange}
              onSplitEvenly={onSplitEvenly}
            />
          ) : null}
        </div>
        <div className="matrix-fullscreen-actions">
          <button
            className="secondary-button"
            disabled={Object.keys(draftsByPayItem).length === 0 || dayIsSubmitted || savingEntries}
            onClick={onClearDraftInputs}
            type="button"
          >
            Clear draft inputs
          </button>
          <button
            className="primary-button prominent-action"
            disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
            onClick={onSaveEntries}
            type="button"
          >
            {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
            {savingEntries ? "Saving..." : "Save entries"}
          </button>
        </div>
        {entryNotice ? <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div> : null}
      </div>
    </div>
  );
}
