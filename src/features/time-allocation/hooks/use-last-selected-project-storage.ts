import { useEffect } from "react";
import { getLastProjectStorageKey } from "@/features/time-allocation/lib/client-storage";

export function useLastSelectedProjectStorage(userId: string | undefined, selectedProjectId: string) {
  useEffect(() => {
    if (!userId || !selectedProjectId) {
      return;
    }

    window.localStorage.setItem(getLastProjectStorageKey(userId), selectedProjectId);
  }, [selectedProjectId, userId]);
}
