import { useCallback } from "react";
import type { AllocationEntry } from "@/lib/domain/types";
import { normalizeSharedAppState } from "@/features/time-allocation/lib/app-state-storage";
import type {
  CrewMember,
  CrewMembersByProject,
  DailyReportUploadsByKey,
  DailyReportsByKey,
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById,
  SharedAppState,
  SyncLogEntry
} from "@/features/time-allocation/types";

type DailyReportData = {
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
};

type SharedAppStateApplicationOptions = {
  onCrewDataReplace: (crewDirectory: CrewMember[], crewMembersByProject: CrewMembersByProject) => void;
  onDailyReportDataReplace: (dailyReportData: DailyReportData) => void;
  onDayEntryNotesByKeyChange: (notes: DayEntryNotesByKey) => void;
  onDaySubmissionsChange: (submissions: DaySubmissionsByKey) => void;
  onEntriesChange: (entries: AllocationEntry[]) => void;
  onMyJobsByUserChange: (jobs: MyJobsByUser) => void;
  onProjectArchiveByIdChange: (archive: ProjectArchiveById) => void;
  onProjectBlacklistByIdChange: (blacklist: ProjectBlacklistById) => void;
  onSyncLogReplace: (entries: SyncLogEntry[]) => void;
};

export function useSharedAppStateApplication({
  onCrewDataReplace,
  onDailyReportDataReplace,
  onDayEntryNotesByKeyChange,
  onDaySubmissionsChange,
  onEntriesChange,
  onMyJobsByUserChange,
  onProjectArchiveByIdChange,
  onProjectBlacklistByIdChange,
  onSyncLogReplace
}: SharedAppStateApplicationOptions) {
  const applySharedAppState = useCallback(
    (state: Partial<SharedAppState> | null) => {
      const normalizedState = normalizeSharedAppState(state);

      onEntriesChange(normalizedState.entries);
      onDaySubmissionsChange(normalizedState.daySubmissions);
      onDayEntryNotesByKeyChange(normalizedState.dayEntryNotesByKey);
      onDailyReportDataReplace({
        dailyReportUploadsByKey: normalizedState.dailyReportUploadsByKey,
        dailyReportsByKey: normalizedState.dailyReportsByKey
      });
      onSyncLogReplace(normalizedState.syncLog);
      onCrewDataReplace(normalizedState.crewDirectory, normalizedState.crewMembersByProject);
      onMyJobsByUserChange(normalizedState.myJobsByUser);
      onProjectArchiveByIdChange(normalizedState.projectArchiveById);
      onProjectBlacklistByIdChange(normalizedState.projectBlacklistById);
    },
    [
      onCrewDataReplace,
      onDailyReportDataReplace,
      onDayEntryNotesByKeyChange,
      onDaySubmissionsChange,
      onEntriesChange,
      onMyJobsByUserChange,
      onProjectArchiveByIdChange,
      onProjectBlacklistByIdChange,
      onSyncLogReplace
    ]
  );

  return { applySharedAppState };
}
