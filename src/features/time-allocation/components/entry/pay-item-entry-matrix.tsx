"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import {
  draftHasAnyInput,
  draftQuantityExceedsRemaining,
  formatCalculatedHours,
  formatCrewMemberMeta,
  formatPayItemQuantity,
  formatPayItemUnitOfMeasure,
  getCrewDisplayName,
  getDraftTotalHours,
  getSelectedCrewHours,
  getSelectedCrewMemberIds,
  getSelectedCrewMembers
} from "@/features/time-allocation/lib/pay-item-entry-helpers";
import type {
  CrewMember,
  DraftsByPayItem,
  PayItemDraft
} from "@/features/time-allocation/types";

export function PayItemMatrix({
  ariaLabel,
  crewMembers,
  dayIsSubmitted,
  draftsByPayItem,
  payItems,
  remainingQuantitiesByPayItem,
  savedEntries,
  variant,
  onCrewHoursChange,
  onCrewToggle,
  onDraftChange,
  onSplitEvenly
}: {
  ariaLabel: string;
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draftsByPayItem: DraftsByPayItem;
  payItems: Project["payItems"];
  remainingQuantitiesByPayItem: Record<string, number>;
  savedEntries: AllocationEntry[];
  variant?: "fullscreen";
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onDraftChange: (payItemId: string, field: "hours" | "quantity", value: string) => void;
  onSplitEvenly: (payItemId: string) => void;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={variant === "fullscreen" ? "pay-item-matrix pay-item-matrix-fullscreen" : "pay-item-matrix"}
      role="table"
    >
      <div className="matrix-header" role="row">
        <span>Code</span>
        <span>Pay Item</span>
        <span className="matrix-quantity-header">Remaining QTY</span>
        <span className="matrix-quantity-header">Saved Hrs</span>
        <span className="matrix-quantity-header">Saved Qty</span>
        <span>Crew</span>
        <span>Hours</span>
        <span>Quantity</span>
      </div>
      {payItems.map((item) => {
        const draft = draftsByPayItem[item.id];
        const savedEntry = savedEntries.find((entry) => entry.payItemId === item.id);
        const rowHasWork = Boolean(savedEntry) || draftHasAnyInput(draft);
        const remainingQuantity = remainingQuantitiesByPayItem[item.id] ?? item.budgetedQuantity;
        const rowHasQuantityOverrun = draftQuantityExceedsRemaining(draft, remainingQuantity);
        const calculatedHours = getDraftTotalHours(draft, savedEntry);

        return (
          <div
            className={`${rowHasWork ? "matrix-row worked-row" : "matrix-row"}${rowHasQuantityOverrun ? " quantity-overrun-row" : ""}`}
            key={item.id}
            role="row"
          >
            <span className="matrix-code" data-label="Code">
              {item.code}
            </span>
            <span className="matrix-name" data-label="Pay Item">
              {item.name}
            </span>
            <span className="matrix-budget" data-label="Remaining QTY" title="Remaining quantity before this date">
              {formatPayItemQuantity(remainingQuantity)} {formatPayItemUnitOfMeasure(item)}
            </span>
            <span className="matrix-saved" data-label="Saved Hrs">
              {savedEntry ? savedEntry.hours.toFixed(2) : "-"}
            </span>
            <span className="matrix-saved" data-label="Saved Qty">
              {savedEntry ? savedEntry.quantityCompleted.toFixed(2) : "-"}
            </span>
            <CrewAllocationEditor
              crewMembers={crewMembers}
              dayIsSubmitted={dayIsSubmitted}
              draft={draft}
              payItemId={item.id}
              savedEntry={savedEntry}
              onCrewHoursChange={onCrewHoursChange}
              onCrewToggle={onCrewToggle}
              onSplitEvenly={onSplitEvenly}
            />
            <span className="matrix-calculated-hours" data-label="Hours">
              {formatCalculatedHours(calculatedHours)}
            </span>
            <input
              aria-label={`Quantity for ${item.code}`}
              className="number-entry"
              data-label="Quantity"
              disabled={dayIsSubmitted}
              inputMode="decimal"
              min="0"
              placeholder="Quantity"
              step="0.01"
              type="number"
              value={draft?.quantity ?? ""}
              onChange={(event) => onDraftChange(item.id, "quantity", event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MobilePayItemEntry({
  crewMembers,
  dayIsSubmitted,
  draftsByPayItem,
  payItems,
  remainingQuantity,
  savedEntries,
  selectedPayItem,
  onCrewHoursChange,
  onCrewToggle,
  onDraftChange,
  onSplitEvenly,
  onSelectedPayItemChange,
  onCrewEditorClose
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draftsByPayItem: DraftsByPayItem;
  payItems: Project["payItems"];
  remainingQuantity: number;
  savedEntries: AllocationEntry[];
  selectedPayItem: Project["payItems"][number];
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onDraftChange: (payItemId: string, field: "hours" | "quantity", value: string) => void;
  onSplitEvenly: (payItemId: string) => void;
  onSelectedPayItemChange: (payItemId: string) => void;
  onCrewEditorClose: () => void;
}) {
  const draft = draftsByPayItem[selectedPayItem.id];
  const savedEntry = savedEntries.find((entry) => entry.payItemId === selectedPayItem.id);
  const rowHasWork = Boolean(savedEntry) || draftHasAnyInput(draft);
  const quantityOverrun = draftQuantityExceedsRemaining(draft, remainingQuantity);
  const calculatedHours = getDraftTotalHours(draft, savedEntry);

  return (
    <div className="pay-item-mobile-entry">
      <div className="field-group">
        <label htmlFor="mobile-pay-item">Pay Item</label>
        <MobileOptionPicker
          id="mobile-pay-item"
          label="Pay Item"
          options={payItems.map((payItem) => ({
            value: payItem.id,
            label: `${payItem.code} - ${payItem.name}`
          }))}
          searchable={false}
          value={selectedPayItem.id}
          onChange={onSelectedPayItemChange}
        />
      </div>

      <div className={rowHasWork ? "mobile-pay-item-card worked-card" : "mobile-pay-item-card"}>
        <div>
          <span>Code</span>
          <strong>{selectedPayItem.code}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>
            {formatPayItemQuantity(remainingQuantity)} {formatPayItemUnitOfMeasure(selectedPayItem)}
          </strong>
        </div>
        <div>
          <span>Saved Hrs</span>
          <strong>{savedEntry ? savedEntry.hours.toFixed(2) : "-"}</strong>
        </div>
        <div>
          <span>Saved Qty</span>
          <strong>{savedEntry ? savedEntry.quantityCompleted.toFixed(2) : "-"}</strong>
        </div>
        <div>
          <span>Hours</span>
          <strong>{formatCalculatedHours(calculatedHours)}</strong>
        </div>
      </div>

      <div className="mobile-crew-field">
        <label>Crew</label>
        <CrewAllocationEditor
          crewMembers={crewMembers}
          dayIsSubmitted={dayIsSubmitted}
          draft={draft}
          payItemId={selectedPayItem.id}
          savedEntry={savedEntry}
          onCrewHoursChange={onCrewHoursChange}
          onCrewToggle={onCrewToggle}
          onClose={onCrewEditorClose}
          onSplitEvenly={onSplitEvenly}
        />
      </div>

      <div className="mobile-pay-item-inputs">
        <div className="field-group">
          <label htmlFor="mobile-quantity">Quantity</label>
          <input
            id="mobile-quantity"
            aria-label={`Quantity for ${selectedPayItem.code}`}
            className="number-entry"
            disabled={dayIsSubmitted}
            inputMode="decimal"
            min="0"
            placeholder="Quantity"
            step="0.01"
            type="number"
            value={draft?.quantity ?? ""}
            onChange={(event) => onDraftChange(selectedPayItem.id, "quantity", event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
          {quantityOverrun ? (
            <span className="quantity-overrun-note">Over remaining quantity. Save will ask for confirmation.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CrewAllocationEditor({
  crewMembers,
  dayIsSubmitted,
  draft,
  payItemId,
  savedEntry,
  onCrewHoursChange,
  onCrewToggle,
  onClose,
  onSplitEvenly
}: {
  crewMembers: CrewMember[];
  dayIsSubmitted: boolean;
  draft: PayItemDraft | undefined;
  payItemId: string;
  savedEntry: AllocationEntry | undefined;
  onCrewHoursChange: (payItemId: string, crewMemberId: string, value: string) => void;
  onCrewToggle: (payItemId: string, crewMemberId: string, checked: boolean) => void;
  onClose?: () => void;
  onSplitEvenly: (payItemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCrewMemberIds = getSelectedCrewMemberIds(draft, savedEntry);
  const selectedCrewHours = getSelectedCrewHours(draft, savedEntry);
  const selectedCrewMembers = getSelectedCrewMembers(selectedCrewMemberIds, crewMembers, savedEntry);
  const allocationTotal = getDraftTotalHours(draft, savedEntry);
  const summaryText =
    selectedCrewMembers.length === 0
      ? "Select crew"
      : selectedCrewMembers.length === 1
        ? selectedCrewMembers[0].name
        : `${selectedCrewMembers.length} selected`;

  function closeCrewAllocator() {
    setOpen(false);

    if (onClose) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(onClose);
      });
    }
  }

  return (
    <details className="crew-allocator" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <Users aria-hidden="true" size={15} />
        <span>{summaryText}</span>
      </summary>
      <div className="crew-allocator-body">
        {crewMembers.length === 0 ? (
          <div className="field-note">Add crew members to this job before allocating hours.</div>
        ) : (
          <div className="crew-checkbox-list">
            {crewMembers.map((member) => (
              <label className="crew-checkbox" key={member.id}>
                <input
                  checked={selectedCrewMemberIds.includes(member.id)}
                  disabled={dayIsSubmitted}
                  type="checkbox"
                  onChange={(event) => onCrewToggle(payItemId, member.id, event.target.checked)}
                />
                <span>
                  <strong>{getCrewDisplayName(member)}</strong>
                  {formatCrewMemberMeta(member)}
                </span>
              </label>
            ))}
          </div>
        )}

        {selectedCrewMembers.length > 0 ? (
          <div className="crew-hour-editor">
            <div className="crew-hour-editor-heading">
              <span>Allocated Hours</span>
              <button
                className="text-button"
                disabled={dayIsSubmitted || !Number.isFinite(allocationTotal) || allocationTotal <= 0}
                onClick={() => onSplitEvenly(payItemId)}
                type="button"
              >
                Split evenly
              </button>
            </div>
            {selectedCrewMembers.map((member) => (
              <label className="crew-hour-row" key={member.id}>
                <span>{getCrewDisplayName(member)}</span>
                <input
                  aria-label={`Allocated hours for ${getCrewDisplayName(member)}`}
                  className="number-entry"
                  disabled={dayIsSubmitted}
                  inputMode="decimal"
                  min="0"
                  step="0.25"
                  type="number"
                  value={selectedCrewHours[member.id] ?? ""}
                  onChange={(event) => onCrewHoursChange(payItemId, member.id, event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                />
              </label>
            ))}
            <div className="crew-allocation-total">
              Total allocated: {Number.isFinite(allocationTotal) ? allocationTotal.toFixed(2) : "-"} hrs
            </div>
          </div>
        ) : null}
        <div className="crew-allocator-actions">
          <button className="secondary-button" onClick={closeCrewAllocator} type="button">
            OK
          </button>
        </div>
      </div>
    </details>
  );
}
