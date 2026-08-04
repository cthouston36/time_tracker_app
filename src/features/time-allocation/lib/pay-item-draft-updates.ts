import type { AllocationEntry } from "@/lib/domain/types";
import type { DraftsByPayItem } from "@/features/time-allocation/types";
import {
  getExistingDraft,
  normalizeDraftCrewHours,
  splitCrewHoursEvenly
} from "@/features/time-allocation/lib/crew-entry-helpers";

export function updatePayItemDraftValue(
  draftsByPayItem: DraftsByPayItem,
  payItemId: string,
  visibleEntries: AllocationEntry[],
  field: "hours" | "quantity",
  value: string
) {
  const draft = getExistingDraft(draftsByPayItem[payItemId], payItemId, visibleEntries);

  return {
    ...draftsByPayItem,
    [payItemId]: normalizeDraftCrewHours({
      ...draft,
      [field]: value
    })
  };
}

export function setPayItemDraftCrewMember(
  draftsByPayItem: DraftsByPayItem,
  payItemId: string,
  visibleEntries: AllocationEntry[],
  crewMemberId: string,
  checked: boolean
) {
  const draft = getExistingDraft(draftsByPayItem[payItemId], payItemId, visibleEntries);
  const crewMemberIds = checked
    ? Array.from(new Set([...draft.crewMemberIds, crewMemberId]))
    : draft.crewMemberIds.filter((id) => id !== crewMemberId);
  const crewHours = { ...draft.crewHours };

  if (!checked) {
    delete crewHours[crewMemberId];
  }

  return {
    ...draftsByPayItem,
    [payItemId]: normalizeDraftCrewHours({
      ...draft,
      crewMemberIds,
      crewHours
    })
  };
}

export function updatePayItemDraftCrewHours(
  draftsByPayItem: DraftsByPayItem,
  payItemId: string,
  visibleEntries: AllocationEntry[],
  crewMemberId: string,
  value: string
) {
  const draft = getExistingDraft(draftsByPayItem[payItemId], payItemId, visibleEntries);

  return {
    ...draftsByPayItem,
    [payItemId]: normalizeDraftCrewHours({
      ...draft,
      crewHours: {
        ...draft.crewHours,
        [crewMemberId]: value
      }
    })
  };
}

export function splitPayItemDraftCrewHoursEvenly(
  draftsByPayItem: DraftsByPayItem,
  payItemId: string,
  visibleEntries: AllocationEntry[]
) {
  const draft = getExistingDraft(draftsByPayItem[payItemId], payItemId, visibleEntries);

  return {
    ...draftsByPayItem,
    [payItemId]: splitCrewHoursEvenly(draft)
  };
}
