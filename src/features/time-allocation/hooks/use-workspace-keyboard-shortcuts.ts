import { useEffect } from "react";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";

type SaveActionRef = {
  current: (() => Promise<void>) | null;
};

type WorkspaceKeyboardShortcutOptions = {
  dailyReportModalOpen: boolean;
  dayIsSubmitted: boolean;
  draftEntryCount: number;
  enabled: boolean;
  matrixFullscreenOpen: boolean;
  saveAllocationEntriesRef: SaveActionRef;
  saveDailyReportRef: SaveActionRef;
  savingEntries: boolean;
  selectedProjectUsesPayItems: boolean;
  setMatrixFullscreenOpen: (open: boolean) => void;
  viewMode: ViewMode;
};

export function useWorkspaceKeyboardShortcuts({
  dailyReportModalOpen,
  dayIsSubmitted,
  draftEntryCount,
  enabled,
  matrixFullscreenOpen,
  saveAllocationEntriesRef,
  saveDailyReportRef,
  savingEntries,
  selectedProjectUsesPayItems,
  setMatrixFullscreenOpen,
  viewMode
}: WorkspaceKeyboardShortcutOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();

        if (dailyReportModalOpen) {
          void saveDailyReportRef.current?.();
          return;
        }

        if (
          viewMode === "entry" &&
          selectedProjectUsesPayItems &&
          draftEntryCount > 0 &&
          !dayIsSubmitted &&
          !savingEntries
        ) {
          void saveAllocationEntriesRef.current?.();
        }
      }

      if (event.key === "Escape" && matrixFullscreenOpen) {
        event.preventDefault();
        setMatrixFullscreenOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [
    dailyReportModalOpen,
    dayIsSubmitted,
    draftEntryCount,
    enabled,
    matrixFullscreenOpen,
    saveAllocationEntriesRef,
    saveDailyReportRef,
    savingEntries,
    selectedProjectUsesPayItems,
    setMatrixFullscreenOpen,
    viewMode
  ]);
}
