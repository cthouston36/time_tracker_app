import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Project } from "@/lib/domain/types";
import type { ConfirmationOptions } from "@/features/time-allocation/hooks/use-confirmation-dialog";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";
import type { DraftsByPayItem } from "@/features/time-allocation/types";

type WorkspaceNavigationActionsOptions = {
  cancelEditingEntry: () => void;
  clearCrewForms: () => void;
  clearDailyReportDraftForCurrentContext: () => void;
  clearJobImageQueue: () => void;
  confirmAction: (options: ConfirmationOptions) => Promise<boolean>;
  hasUnsavedChanges: boolean;
  projects: Project[];
  selectedProject: Project | undefined;
  selectedProjectId: string;
  setDraftsByPayItem: Dispatch<SetStateAction<DraftsByPayItem>>;
  setMobileSelectedPayItemId: (payItemId: string) => void;
  setSelectedProjectId: (projectId: string) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setWorkDate: (workDate: string) => void;
  viewMode: ViewMode;
  workDate: string;
};

export function useWorkspaceNavigationActions({
  cancelEditingEntry,
  clearCrewForms,
  clearDailyReportDraftForCurrentContext,
  clearJobImageQueue,
  confirmAction,
  hasUnsavedChanges,
  projects,
  selectedProject,
  selectedProjectId,
  setDraftsByPayItem,
  setMobileSelectedPayItemId,
  setSelectedProjectId,
  setViewMode,
  setWorkDate,
  viewMode,
  workDate
}: WorkspaceNavigationActionsOptions) {
  const confirmDiscardUnsavedChanges = useCallback(
    (actionDescription: string) => {
      if (!hasUnsavedChanges) {
        return Promise.resolve(true);
      }

      return confirmAction({
        cancelLabel: "Stay here",
        confirmLabel: "Discard changes",
        description: `You have unsaved changes. Continue to ${actionDescription}?`,
        details: ["Unsaved pay item inputs, queued images, or daily report edits will be discarded."],
        title: "Discard unsaved changes",
        tone: "warning"
      });
    },
    [confirmAction, hasUnsavedChanges]
  );

  const clearTransientEntryState = useCallback(() => {
    setMobileSelectedPayItemId("");
    cancelEditingEntry();
    clearCrewForms();
    setDraftsByPayItem({});
    clearJobImageQueue();
    clearDailyReportDraftForCurrentContext();
  }, [
    cancelEditingEntry,
    clearCrewForms,
    clearDailyReportDraftForCurrentContext,
    clearJobImageQueue,
    setDraftsByPayItem,
    setMobileSelectedPayItemId
  ]);

  const changeSelectedProject = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === selectedProjectId) {
        return;
      }

      if (!(await confirmDiscardUnsavedChanges("change jobs"))) {
        return;
      }

      clearTransientEntryState();
      setSelectedProjectId(nextProjectId);
    },
    [
      clearTransientEntryState,
      confirmDiscardUnsavedChanges,
      selectedProjectId,
      setSelectedProjectId
    ]
  );

  const changeWorkDate = useCallback(
    async (nextWorkDate: string) => {
      if (nextWorkDate === workDate) {
        return;
      }

      if (!(await confirmDiscardUnsavedChanges("change dates"))) {
        return;
      }

      clearTransientEntryState();
      setWorkDate(nextWorkDate);
    },
    [clearTransientEntryState, confirmDiscardUnsavedChanges, setWorkDate, workDate]
  );

  const changeViewMode = useCallback(
    async (nextViewMode: ViewMode) => {
      if (nextViewMode === viewMode) {
        return;
      }

      if (nextViewMode !== "entry" && !(await confirmDiscardUnsavedChanges("leave the entry view"))) {
        return;
      }

      if (nextViewMode !== "entry") {
        clearTransientEntryState();
      }

      setViewMode(nextViewMode);
    },
    [clearTransientEntryState, confirmDiscardUnsavedChanges, setViewMode, viewMode]
  );

  const openDailyEntry = useCallback(
    async (projectId: string, date: string) => {
      if (!projects.some((project) => project.id === projectId)) {
        return;
      }

      if (
        (projectId !== selectedProject?.id || date !== workDate || viewMode !== "entry") &&
        !(await confirmDiscardUnsavedChanges("open that day"))
      ) {
        return;
      }

      setSelectedProjectId(projectId);
      setWorkDate(date);
      setViewMode("entry");
      setMobileSelectedPayItemId("");
      cancelEditingEntry();
      clearCrewForms();
      setDraftsByPayItem({});
    },
    [
      cancelEditingEntry,
      clearCrewForms,
      confirmDiscardUnsavedChanges,
      projects,
      selectedProject?.id,
      setDraftsByPayItem,
      setMobileSelectedPayItemId,
      setSelectedProjectId,
      setViewMode,
      setWorkDate,
      viewMode,
      workDate
    ]
  );

  return {
    changeSelectedProject,
    changeViewMode,
    changeWorkDate,
    clearTransientEntryState,
    confirmDiscardUnsavedChanges,
    openDailyEntry
  };
}
