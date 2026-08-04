import { useEffect } from "react";
import type { SyncLogEntry } from "@/features/time-allocation/types";

export function useSyncLogStorage(enabled: boolean, syncLog: SyncLogEntry[]) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.localStorage.setItem("procore-sync-log", JSON.stringify(syncLog));
  }, [enabled, syncLog]);
}
