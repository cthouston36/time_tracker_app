import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AllocationEntry } from "@/lib/domain/types";
import {
  setPayItemDraftCrewMember,
  splitPayItemDraftCrewHoursEvenly,
  updatePayItemDraftCrewHours,
  updatePayItemDraftValue
} from "@/features/time-allocation/lib/pay-item-draft-updates";
import type { DraftsByPayItem } from "@/features/time-allocation/types";

type PayItemDraftActionsOptions = {
  setDraftsByPayItem: Dispatch<SetStateAction<DraftsByPayItem>>;
  setEntryNotice: (message: string) => void;
  visibleEntries: AllocationEntry[];
};

export function usePayItemDraftActions({
  setDraftsByPayItem,
  setEntryNotice,
  visibleEntries
}: PayItemDraftActionsOptions) {
  const updateDraft = useCallback(
    (payItemId: string, field: "hours" | "quantity", value: string) => {
      setEntryNotice("");
      setDraftsByPayItem((current) => updatePayItemDraftValue(current, payItemId, visibleEntries, field, value));
    },
    [setDraftsByPayItem, setEntryNotice, visibleEntries]
  );

  const toggleDraftCrewMember = useCallback(
    (payItemId: string, crewMemberId: string, checked: boolean) => {
      setEntryNotice("");
      setDraftsByPayItem((current) => setPayItemDraftCrewMember(current, payItemId, visibleEntries, crewMemberId, checked));
    },
    [setDraftsByPayItem, setEntryNotice, visibleEntries]
  );

  const updateDraftCrewHours = useCallback(
    (payItemId: string, crewMemberId: string, value: string) => {
      setEntryNotice("");
      setDraftsByPayItem((current) => updatePayItemDraftCrewHours(current, payItemId, visibleEntries, crewMemberId, value));
    },
    [setDraftsByPayItem, setEntryNotice, visibleEntries]
  );

  const splitDraftCrewHoursEvenly = useCallback(
    (payItemId: string) => {
      setDraftsByPayItem((current) => splitPayItemDraftCrewHoursEvenly(current, payItemId, visibleEntries));
    },
    [setDraftsByPayItem, visibleEntries]
  );

  return {
    splitDraftCrewHoursEvenly,
    toggleDraftCrewMember,
    updateDraft,
    updateDraftCrewHours
  };
}
