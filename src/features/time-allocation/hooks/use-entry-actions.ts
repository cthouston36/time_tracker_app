import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import {
  deleteDatabaseDayEntries,
  deleteDatabaseDaySubmission,
  deleteDatabaseEntry,
  loadDatabaseDayRecords,
  loadDatabaseEntries,
  saveDatabaseDaySubmission,
  saveDatabaseEntries
} from "@/features/time-allocation/lib/api-client";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import {
  buildDaySubmissionConflictSignature,
  buildEntryConflictSignature
} from "@/features/time-allocation/lib/conflict-helpers";
import {
  buildCrewAllocations,
  confirmQuantityOverrun,
  draftIsIncomplete,
  draftIsSaveable,
  getCrewAllocationError,
  getDraftQuantityOverrunWarnings,
  getDraftTotalHours,
  scaleCrewAllocations
} from "@/features/time-allocation/lib/crew-entry-helpers";
import { formatDate, getDayKey } from "@/features/time-allocation/lib/date-helpers";
import {
  formatPayItemQuantity,
  formatPayItemUnitOfMeasure
} from "@/features/time-allocation/lib/pay-item-helpers";
import type {
  CrewMember,
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  DraftsByPayItem
} from "@/features/time-allocation/types";

type EditingEntry = {
  entryId: string;
  hours: string;
  quantity: string;
};

export function useEntryActions({
  currentUser,
  dayIsSubmitted,
  daySubmissions,
  draftsByPayItem,
  entries,
  remainingQuantitiesByPayItem,
  selectedProject,
  selectedProjectCrewMembers,
  setDayEntryNotesByKey,
  setDaySubmissions,
  setDraftsByPayItem,
  setEntries,
  setEntryNotice,
  userIsOffline,
  visibleEntries,
  workDate
}: {
  currentUser: AuthUser | null;
  dayIsSubmitted: boolean;
  daySubmissions: DaySubmissionsByKey;
  draftsByPayItem: DraftsByPayItem;
  entries: AllocationEntry[];
  remainingQuantitiesByPayItem: Record<string, number>;
  selectedProject: Project | undefined;
  selectedProjectCrewMembers: CrewMember[];
  setDayEntryNotesByKey: Dispatch<SetStateAction<DayEntryNotesByKey>>;
  setDaySubmissions: Dispatch<SetStateAction<DaySubmissionsByKey>>;
  setDraftsByPayItem: Dispatch<SetStateAction<DraftsByPayItem>>;
  setEntries: Dispatch<SetStateAction<AllocationEntry[]>>;
  setEntryNotice: (message: string) => void;
  userIsOffline: boolean;
  visibleEntries: AllocationEntry[];
  workDate: string;
}) {
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [savingEntries, setSavingEntries] = useState(false);
  const [savingEditedEntry, setSavingEditedEntry] = useState(false);
  const [submittingDay, setSubmittingDay] = useState(false);
  const [reopeningDay, setReopeningDay] = useState(false);
  const [deletingSubmittedDay, setDeletingSubmittedDay] = useState(false);
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);

  const cancelEditingEntry = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const updateEditingEntry = useCallback((field: "hours" | "quantity", value: string) => {
    setEditingEntry((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const replaceEntriesForDay = useCallback(
    (projectId: string, date: string, dayEntries: AllocationEntry[]) => {
      setEntries((current) => [
        ...current.filter((entry) => !(entry.projectId === projectId && entry.date === date)),
        ...dayEntries
      ]);
    },
    [setEntries]
  );

  const ensureEntriesAreCurrent = useCallback(
    async (projectId: string, date: string) => {
      const databaseEntries = await loadDatabaseEntries();

      if (!databaseEntries) {
        return true;
      }

      const databaseDayEntries = databaseEntries.filter((entry) => entry.projectId === projectId && entry.date === date);
      const currentDayEntries = entries.filter((entry) => entry.projectId === projectId && entry.date === date);

      if (buildEntryConflictSignature(databaseDayEntries) === buildEntryConflictSignature(currentDayEntries)) {
        return true;
      }

      replaceEntriesForDay(projectId, date, databaseDayEntries);
      setEditingEntry(null);
      setEntryNotice("This job/day was changed by another user. Review the latest entries before saving again.");
      return false;
    },
    [entries, replaceEntriesForDay, setEntryNotice]
  );

  const ensureDaySubmissionIsCurrent = useCallback(
    async (projectId: string, date: string) => {
      const databaseDayRecords = await loadDatabaseDayRecords();

      if (!databaseDayRecords) {
        return true;
      }

      const dayKey = getDayKey(projectId, date);
      const databaseSubmission = databaseDayRecords.daySubmissions[dayKey] ?? { status: "draft" };
      const currentSubmission = daySubmissions[dayKey] ?? { status: "draft" };

      if (buildDaySubmissionConflictSignature(databaseSubmission) === buildDaySubmissionConflictSignature(currentSubmission)) {
        return true;
      }

      setDaySubmissions(databaseDayRecords.daySubmissions);
      setDayEntryNotesByKey(databaseDayRecords.dayEntryNotesByKey);
      setDraftsByPayItem({});
      setEditingEntry(null);
      setEntryNotice("This day status was changed by another user. Review the latest status before trying again.");
      return false;
    },
    [daySubmissions, setDayEntryNotesByKey, setDaySubmissions, setDraftsByPayItem, setEntryNotice]
  );

  const clearDraftInputs = useCallback(() => {
    setDraftsByPayItem({});
    setEntryNotice("Draft inputs cleared.");
  }, [setDraftsByPayItem, setEntryNotice]);

  const saveAllocationEntries = useCallback(async () => {
    if (!selectedProject || !currentUser || dayIsSubmitted || savingEntries) {
      return;
    }

    if (userIsOffline) {
      setEntryNotice("You appear to be offline. Reconnect before saving, syncing, or uploading.");
      return;
    }

    const incompleteCount = selectedProject.payItems.filter((payItem) =>
      draftIsIncomplete(draftsByPayItem[payItem.id])
    ).length;

    if (incompleteCount > 0) {
      setEntryNotice("Allocate crew hours and enter quantity before saving a row.");
      return;
    }

    const crewAllocationError = selectedProject.payItems
      .map((payItem) => getCrewAllocationError(draftsByPayItem[payItem.id], selectedProjectCrewMembers))
      .find(Boolean);

    if (crewAllocationError) {
      setEntryNotice(crewAllocationError);
      return;
    }

    const overrunWarnings = getDraftQuantityOverrunWarnings(
      selectedProject.payItems,
      draftsByPayItem,
      visibleEntries,
      remainingQuantitiesByPayItem
    );

    if (overrunWarnings.length > 0 && !confirmQuantityOverrun(overrunWarnings)) {
      setEntryNotice("Save cancelled. Adjust quantities or save again to confirm the overrun.");
      return;
    }

    setSavingEntries(true);
    setEntryNotice("Saving entries...");

    try {
      if (!(await ensureEntriesAreCurrent(selectedProject.id, workDate))) {
        return;
      }

      const nextEntries = selectedProject.payItems.flatMap((payItem) => {
        const draft = draftsByPayItem[payItem.id];
        const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItem.id);

        if (!draftIsSaveable(draft)) {
          return [];
        }

        const hours = getDraftTotalHours(draft, existingEntry);
        const quantity = draft?.quantity ? Number(draft.quantity) : existingEntry?.quantityCompleted ?? 0;

        return [
          {
            id: existingEntry?.id ?? crypto.randomUUID(),
            projectId: selectedProject.id,
            projectName: existingEntry?.projectName ?? selectedProject.name,
            date: workDate,
            payItemId: payItem.id,
            payItemCode: existingEntry?.payItemCode ?? payItem.code,
            payItemName: existingEntry?.payItemName ?? payItem.name,
            payItemBudgetedQuantity: existingEntry?.payItemBudgetedQuantity ?? payItem.budgetedQuantity,
            payItemUnitOfMeasure: existingEntry?.payItemUnitOfMeasure ?? formatPayItemUnitOfMeasure(payItem),
            hours,
            quantityCompleted: quantity,
            crewAllocations: buildCrewAllocations(draft, selectedProjectCrewMembers, hours),
            savedByUserId: currentUser.id,
            savedByName: formatUserName(currentUser),
            savedAt: new Date().toISOString()
          }
        ];
      });

      if (nextEntries.length === 0) {
        return;
      }

      setEntries((current) => {
        const upsertIds = new Set(nextEntries.map((entry) => entry.id));
        return [...current.filter((entry) => !upsertIds.has(entry.id)), ...nextEntries];
      });
      try {
        await saveDatabaseEntries(nextEntries);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Rows saved locally, but did not sync to the database.");
        return;
      }

      setDraftsByPayItem({});
      setEntryNotice(`${nextEntries.length} row${nextEntries.length === 1 ? "" : "s"} saved for ${formatDate(workDate)}.`);
    } finally {
      setSavingEntries(false);
    }
  }, [
    currentUser,
    dayIsSubmitted,
    draftsByPayItem,
    ensureEntriesAreCurrent,
    remainingQuantitiesByPayItem,
    savingEntries,
    selectedProject,
    selectedProjectCrewMembers,
    setDraftsByPayItem,
    setEntries,
    setEntryNotice,
    userIsOffline,
    visibleEntries,
    workDate
  ]);

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (dayIsSubmitted || removingEntryId) {
        return;
      }

      const entryToRemove = entries.find((entry) => entry.id === entryId);

      setRemovingEntryId(entryId);
      setEntryNotice("Removing entry...");

      try {
        if (!entryToRemove || !(await ensureEntriesAreCurrent(entryToRemove.projectId, entryToRemove.date))) {
          return;
        }

        setEntries((current) => current.filter((entry) => entry.id !== entryId));
        try {
          await deleteDatabaseEntry(entryId);
          setEntryNotice("Entry removed.");
        } catch (error) {
          setEntryNotice(error instanceof Error ? error.message : "Entry deleted locally, but did not sync to the database.");
        }
      } finally {
        setRemovingEntryId(null);
      }
    },
    [dayIsSubmitted, entries, ensureEntriesAreCurrent, removingEntryId, setEntries, setEntryNotice]
  );

  const deleteSubmittedDay = useCallback(async () => {
    if (currentUser?.role !== "admin" || !selectedProject || deletingSubmittedDay) {
      return;
    }

    setDeletingSubmittedDay(true);
    setEntryNotice("Deleting submitted day...");

    try {
      if (
        !(await ensureEntriesAreCurrent(selectedProject.id, workDate)) ||
        !(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))
      ) {
        return;
      }

      const dayKey = getDayKey(selectedProject.id, workDate);

      setEntries((current) =>
        current.filter((entry) => !(entry.projectId === selectedProject.id && entry.date === workDate))
      );
      try {
        await deleteDatabaseDayEntries(selectedProject.id, workDate);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but entries did not sync.");
        return;
      }
      setDaySubmissions((current) => {
        const next = { ...current };
        delete next[dayKey];
        return next;
      });
      try {
        await deleteDatabaseDaySubmission(selectedProject.id, workDate);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day deleted locally, but day status did not sync.");
        return;
      }
      setEditingEntry(null);
      setDraftsByPayItem({});
      setEntryNotice("Submitted day deleted.");
    } finally {
      setDeletingSubmittedDay(false);
    }
  }, [
    currentUser?.role,
    deletingSubmittedDay,
    ensureDaySubmissionIsCurrent,
    ensureEntriesAreCurrent,
    selectedProject,
    setDaySubmissions,
    setDraftsByPayItem,
    setEntries,
    setEntryNotice,
    workDate
  ]);

  const startEditingEntry = useCallback((entry: AllocationEntry) => {
    setEditingEntry({
      entryId: entry.id,
      hours: String(entry.hours),
      quantity: String(entry.quantityCompleted)
    });
  }, []);

  const saveEditedEntry = useCallback(async () => {
    if (!editingEntry || dayIsSubmitted || !currentUser || savingEditedEntry) {
      return;
    }

    const entryToEdit = entries.find((entry) => entry.id === editingEntry.entryId);

    setSavingEditedEntry(true);
    setEntryNotice("Saving edited row...");

    try {
      if (!entryToEdit || !(await ensureEntriesAreCurrent(entryToEdit.projectId, entryToEdit.date))) {
        return;
      }

      const hours = Number(editingEntry.hours);
      const quantity = Number(editingEntry.quantity);

      if (hours < 0 || quantity < 0 || !Number.isFinite(hours) || !Number.isFinite(quantity)) {
        return;
      }

      const remainingQuantity = selectedProject?.id === entryToEdit.projectId
        ? remainingQuantitiesByPayItem[entryToEdit.payItemId]
        : undefined;

      if (
        remainingQuantity !== undefined &&
        quantity > remainingQuantity + 0.0001 &&
        !confirmQuantityOverrun([
          `${entryToEdit.payItemCode}: ${formatPayItemQuantity(quantity)} entered, ${formatPayItemQuantity(remainingQuantity)} remaining.`
        ])
      ) {
        setEntryNotice("Update cancelled. Adjust the quantity or save again to confirm the overrun.");
        return;
      }

      let updatedEntry: AllocationEntry | null = null;
      const nextEntries = entries.map((entry) => {
        if (entry.id !== editingEntry.entryId) {
          return entry;
        }

        updatedEntry = {
          ...entry,
          hours,
          quantityCompleted: quantity,
          crewAllocations: scaleCrewAllocations(entry.crewAllocations ?? [], hours),
          savedByUserId: currentUser.id,
          savedByName: formatUserName(currentUser),
          savedAt: new Date().toISOString()
        };

        return updatedEntry;
      });

      setEntries(nextEntries);
      if (updatedEntry) {
        try {
          await saveDatabaseEntries([updatedEntry]);
        } catch (error) {
          setEntryNotice(error instanceof Error ? error.message : "Daily allocation updated locally, but did not sync.");
          return;
        }
      }
      setEditingEntry(null);
      setEntryNotice("Daily allocation row updated.");
    } finally {
      setSavingEditedEntry(false);
    }
  }, [
    currentUser,
    dayIsSubmitted,
    editingEntry,
    entries,
    ensureEntriesAreCurrent,
    remainingQuantitiesByPayItem,
    savingEditedEntry,
    selectedProject?.id,
    setEntries,
    setEntryNotice
  ]);

  const submitDay = useCallback(async () => {
    if (!selectedProject || !currentUser || visibleEntries.length === 0 || submittingDay) {
      return;
    }

    setSubmittingDay(true);

    try {
      if (
        !(await ensureEntriesAreCurrent(selectedProject.id, workDate)) ||
        !(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))
      ) {
        return;
      }

      if (!window.confirm(`Submit ${selectedProject.name} for ${formatDate(workDate)}? This will lock the day for field edits.`)) {
        return;
      }

      setEntryNotice("Submitting day...");

      const daySubmission: DaySubmission = {
        status: "submitted",
        submittedByUserId: currentUser.id,
        submittedByName: formatUserName(currentUser),
        submittedAt: new Date().toISOString()
      };

      setDaySubmissions((current) => ({
        ...current,
        [getDayKey(selectedProject.id, workDate)]: daySubmission
      }));
      try {
        await saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Day submitted locally, but did not sync.");
        return;
      }
      setEditingEntry(null);
      setDraftsByPayItem({});
      setEntryNotice("Day submitted.");
    } finally {
      setSubmittingDay(false);
    }
  }, [
    currentUser,
    ensureDaySubmissionIsCurrent,
    ensureEntriesAreCurrent,
    selectedProject,
    setDaySubmissions,
    setDraftsByPayItem,
    setEntryNotice,
    submittingDay,
    visibleEntries.length,
    workDate
  ]);

  const reopenSubmittedDay = useCallback(async () => {
    if (currentUser?.role !== "admin" || !selectedProject || !dayIsSubmitted || reopeningDay) {
      return;
    }

    setReopeningDay(true);
    setEntryNotice("Reopening submitted day...");

    try {
      if (!(await ensureDaySubmissionIsCurrent(selectedProject.id, workDate))) {
        return;
      }

      const dayKey = getDayKey(selectedProject.id, workDate);

      const daySubmission: DaySubmission = {
        status: "draft"
      };

      setDaySubmissions((current) => ({
        ...current,
        [dayKey]: daySubmission
      }));
      try {
        await saveDatabaseDaySubmission(selectedProject.id, workDate, daySubmission);
      } catch (error) {
        setEntryNotice(error instanceof Error ? error.message : "Submitted day reopened locally, but did not sync.");
        return;
      }
      setEntryNotice("Submitted day reopened.");
    } finally {
      setReopeningDay(false);
    }
  }, [
    currentUser?.role,
    dayIsSubmitted,
    ensureDaySubmissionIsCurrent,
    reopeningDay,
    selectedProject,
    setDaySubmissions,
    setEntryNotice,
    workDate
  ]);

  return {
    cancelEditingEntry,
    clearDraftInputs,
    deleteSubmittedDay,
    deletingSubmittedDay,
    editingEntry,
    removeEntry,
    removingEntryId,
    reopenSubmittedDay,
    reopeningDay,
    saveAllocationEntries,
    saveEditedEntry,
    savingEditedEntry,
    savingEntries,
    startEditingEntry,
    submitDay,
    submittingDay,
    updateEditingEntry
  };
}
