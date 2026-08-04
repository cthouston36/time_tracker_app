import { useEffect } from "react";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";

type RetiredViewRedirectOptions = {
  enabled: boolean;
  setViewMode: (viewMode: ViewMode) => void;
  viewMode: ViewMode;
};

export function useRetiredViewRedirect({ enabled, setViewMode, viewMode }: RetiredViewRedirectOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (viewMode === "calendar") {
      setViewMode("dashboard");
    }
  }, [enabled, setViewMode, viewMode]);
}
