import { useCallback } from "react";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { exportEntriesToCsv } from "@/features/time-allocation/lib/entry-csv-export";
import type {
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  ProjectBlacklistById
} from "@/features/time-allocation/types";

type EntryExportActionsOptions = {
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
};

export function useEntryExportActions({
  dayEntryNotesByKey,
  daySubmissions,
  entries,
  projectBlacklistById,
  projects
}: EntryExportActionsOptions) {
  const exportAllEntryDetails = useCallback(() => {
    exportEntriesToCsv({
      dayEntryNotesByKey,
      daySubmissions,
      entries,
      projectBlacklistById,
      projects
    });
  }, [dayEntryNotesByKey, daySubmissions, entries, projectBlacklistById, projects]);

  return { exportAllEntryDetails };
}
