import { useCallback } from "react";
import type { Project } from "@/lib/domain/types";
import {
  writePendingProcoreReturn,
  type PendingProcoreReturn,
  type ViewMode
} from "@/features/time-allocation/lib/client-storage";

type ProcoreConnectActionOptions = {
  confirmDiscardUnsavedChanges: (actionDescription: string) => Promise<boolean>;
  mobileSelectedPayItemId: string;
  selectedProject: Project | undefined;
  selectedProjectId: string;
  setProjectLoadError: (message: string) => void;
  userIsOffline: boolean;
  viewMode: ViewMode;
  workDate: string;
};

export function useProcoreConnectAction({
  confirmDiscardUnsavedChanges,
  mobileSelectedPayItemId,
  selectedProject,
  selectedProjectId,
  setProjectLoadError,
  userIsOffline,
  viewMode,
  workDate
}: ProcoreConnectActionOptions) {
  return useCallback(
    async (intent: PendingProcoreReturn["intent"] = "connect") => {
      if (userIsOffline) {
        setProjectLoadError("You appear to be offline. Reconnect before saving, syncing, or uploading.");
        return;
      }

      if (!(await confirmDiscardUnsavedChanges("connect to Procore"))) {
        return;
      }

      writePendingProcoreReturn({
        date: workDate,
        intent,
        mobilePayItemId: mobileSelectedPayItemId,
        projectId: selectedProject?.id ?? selectedProjectId,
        viewMode
      });
      window.location.assign("/api/procore/oauth/login");
    },
    [
      confirmDiscardUnsavedChanges,
      mobileSelectedPayItemId,
      selectedProject?.id,
      selectedProjectId,
      setProjectLoadError,
      userIsOffline,
      viewMode,
      workDate
    ]
  );
}
