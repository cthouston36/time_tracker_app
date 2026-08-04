import { useEffect } from "react";
import type { AuthUser } from "@/lib/auth/types";
import {
  loadDatabaseCrewData,
  loadDatabaseDailyReportData,
  loadDatabaseDayRecords,
  loadDatabaseEntries,
  loadDatabaseProjectControls
} from "@/features/time-allocation/lib/api-client";
import {
  buildSharedAppState,
  readLocalSharedAppState,
  writeLocalSharedAppState
} from "@/features/time-allocation/lib/app-state-storage";
import type { SharedAppState } from "@/features/time-allocation/types";

type SharedAppStatePersistenceOptions = SharedAppState & {
  appStateHydrated: boolean;
  currentUser: AuthUser | null;
  onAppStateHydratedChange: (hydrated: boolean) => void;
  onApplySharedAppState: (state: Partial<SharedAppState> | null) => void;
};

export function useSharedAppStatePersistence({
  appStateHydrated,
  crewDirectory,
  crewMembersByProject,
  currentUser,
  dailyReportUploadsByKey,
  dailyReportsByKey,
  dayEntryNotesByKey,
  daySubmissions,
  entries,
  myJobsByUser,
  onAppStateHydratedChange,
  onApplySharedAppState,
  projectArchiveById,
  projectBlacklistById,
  syncLog
}: SharedAppStatePersistenceOptions) {
  useEffect(() => {
    if (!currentUser) {
      onAppStateHydratedChange(false);
      return;
    }

    let cancelled = false;

    async function loadAppState() {
      onAppStateHydratedChange(false);

      try {
        const [
          databaseEntries,
          databaseCrewData,
          databaseDailyReportData,
          databaseDayRecords,
          databaseProjectControls
        ] = await Promise.all([
          loadDatabaseEntries(),
          loadDatabaseCrewData(),
          loadDatabaseDailyReportData(),
          loadDatabaseDayRecords(),
          loadDatabaseProjectControls()
        ]);

        if (cancelled) {
          return;
        }

        const sharedState = readLocalSharedAppState();
        const nextState = {
          ...sharedState,
          ...(databaseEntries ? { entries: databaseEntries } : {}),
          ...(databaseCrewData ?? {}),
          ...(databaseDailyReportData ?? {}),
          ...(databaseDayRecords ?? {}),
          ...(databaseProjectControls ?? {})
        };

        onApplySharedAppState(nextState);
      } catch {
        if (!cancelled) {
          onApplySharedAppState(readLocalSharedAppState());
        }
      } finally {
        if (!cancelled) {
          onAppStateHydratedChange(true);
        }
      }
    }

    void loadAppState();

    return () => {
      cancelled = true;
    };
  }, [currentUser, onAppStateHydratedChange, onApplySharedAppState]);

  useEffect(() => {
    if (!currentUser || !appStateHydrated) {
      return;
    }

    writeLocalSharedAppState(
      buildSharedAppState({
        crewDirectory,
        crewMembersByProject,
        dailyReportUploadsByKey,
        dailyReportsByKey,
        dayEntryNotesByKey,
        daySubmissions,
        entries,
        myJobsByUser,
        projectArchiveById,
        projectBlacklistById,
        syncLog
      })
    );
  }, [
    appStateHydrated,
    currentUser,
    crewDirectory,
    crewMembersByProject,
    dailyReportUploadsByKey,
    dailyReportsByKey,
    dayEntryNotesByKey,
    daySubmissions,
    entries,
    myJobsByUser,
    projectArchiveById,
    projectBlacklistById,
    syncLog
  ]);
}
