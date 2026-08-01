import type { Ref } from "react";
import { Maximize2, Save } from "lucide-react";
import { EmptyState, InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import {
  MobilePayItemEntry,
  PayItemMatrix
} from "@/features/time-allocation/components/entry/pay-item-entry-matrix";
import { getEntryNoticeClassName } from "@/features/time-allocation/lib/notice-helpers";
import type { CrewMember, DraftsByPayItem } from "@/features/time-allocation/types";
import type { AllocationEntry, Project } from "@/lib/procore/types";

type PayItem = Project["payItems"][number];

export function PayItemEntryPanel({
  crewMembers,
  dayIsSubmitted,
  displayedPayItems,
  draftEntryCount,
  draftsByPayItem,
  entryNotice,
  mobileSelectedPayItem,
  panelRef,
  remainingQuantitiesByPayItem,
  savedEntries,
  savingEntries,
  selectedProject,
  onClearDraftInputs,
  onCrewEditorClose,
  onCrewHoursChange,
  onCrewToggle,
  onDraftChange,
  onExpandMatrix,
  onSaveEntries,
  onSelectedPayItemChange,
  onSplitEvenly
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  displayedPayItems: PayItem[];
  draftEntryCount: number;
  draftsByPayItem: DraftsByPayItem;
  entryNotice: string;
  mobileSelectedPayItem: PayItem | undefined;
  panelRef: Ref<HTMLDivElement>;
  remainingQuantitiesByPayItem: Record<string, number>;
  savedEntries: AllocationEntry[];
  savingEntries: boolean;
  selectedProject: Project | undefined;
  onClearDraftInputs: () => void;
  onCrewEditorClose: () => void;
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onDraftChange: (payItemId: string, field: "hours" | "quantity", value: string) => void;
  onExpandMatrix: () => void;
  onSaveEntries: () => void;
  onSelectedPayItemChange: (payItemId: string) => void;
  onSplitEvenly: (payItemId: string) => void;
}) {
  const payItemCount = selectedProject?.payItems.length ?? 0;
  const hasDisplayedPayItems = displayedPayItems.length > 0;

  return (
    <div className="panel workflow-panel" ref={panelRef}>
      <div className="panel-heading">
        <h2 className="workflow-title">
          <span className="workflow-step">1</span>
          Pay Item Entry
        </h2>
        <div className="panel-heading-actions">
          <button
            className="secondary-button matrix-expand-button"
            disabled={payItemCount === 0 || !hasDisplayedPayItems}
            onClick={onExpandMatrix}
            type="button"
          >
            <Maximize2 aria-hidden="true" size={18} />
            Expand Matrix
          </button>
        </div>
      </div>
      {payItemCount === 0 ? (
        <EmptyState title="No pay items returned">This job can still use daily reports and image uploads.</EmptyState>
      ) : null}
      {payItemCount > 0 && hasDisplayedPayItems ? (
        <PayItemMatrix
          ariaLabel="Pay item entry matrix"
          crewMembers={crewMembers}
          dayIsSubmitted={dayIsSubmitted}
          draftsByPayItem={draftsByPayItem}
          payItems={displayedPayItems}
          remainingQuantitiesByPayItem={remainingQuantitiesByPayItem}
          savedEntries={savedEntries}
          onCrewHoursChange={onCrewHoursChange}
          onCrewToggle={onCrewToggle}
          onDraftChange={onDraftChange}
          onSplitEvenly={onSplitEvenly}
        />
      ) : null}
      {hasDisplayedPayItems && mobileSelectedPayItem ? (
        <MobilePayItemEntry
          crewMembers={crewMembers}
          dayIsSubmitted={dayIsSubmitted}
          draftsByPayItem={draftsByPayItem}
          payItems={displayedPayItems}
          remainingQuantity={remainingQuantitiesByPayItem[mobileSelectedPayItem.id] ?? mobileSelectedPayItem.budgetedQuantity}
          savedEntries={savedEntries}
          selectedPayItem={mobileSelectedPayItem}
          onCrewEditorClose={onCrewEditorClose}
          onCrewHoursChange={onCrewHoursChange}
          onCrewToggle={onCrewToggle}
          onDraftChange={onDraftChange}
          onSelectedPayItemChange={onSelectedPayItemChange}
          onSplitEvenly={onSplitEvenly}
        />
      ) : null}
      {payItemCount > 0 ? (
        <div className="matrix-footer">
          <span className="field-note">
            {draftEntryCount} row{draftEntryCount === 1 ? "" : "s"} ready to save
          </span>
          <button
            className="secondary-button"
            disabled={Object.keys(draftsByPayItem).length === 0 || dayIsSubmitted || savingEntries}
            onClick={onClearDraftInputs}
            type="button"
          >
            Clear draft inputs
          </button>
          <button
            className="primary-button save-button prominent-action"
            disabled={draftEntryCount === 0 || dayIsSubmitted || savingEntries}
            onClick={onSaveEntries}
            type="button"
          >
            {savingEntries ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
            {savingEntries ? "Saving..." : "Save entries"}
          </button>
        </div>
      ) : null}
      {entryNotice ? <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div> : null}
    </div>
  );
}
