import { useEffect } from "react";
import { populateEntryProjectSnapshots } from "@/features/time-allocation/lib/entry-snapshot-helpers";
import type { AllocationEntry, Project } from "@/lib/domain/types";

type EntryProjectSnapshotRepairOptions = {
  enabled: boolean;
  entries: AllocationEntry[];
  projects: Project[];
  setEntries: (entries: AllocationEntry[]) => void;
};

export function useEntryProjectSnapshotRepair({
  enabled,
  entries,
  projects,
  setEntries
}: EntryProjectSnapshotRepairOptions) {
  useEffect(() => {
    if (!enabled || projects.length === 0 || entries.length === 0) {
      return;
    }

    const result = populateEntryProjectSnapshots(entries, projects);

    if (result.changed) {
      setEntries(result.entries);
    }
  }, [enabled, entries, projects, setEntries]);
}
