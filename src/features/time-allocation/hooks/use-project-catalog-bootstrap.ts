import { useEffect } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import {
  loadProcoreUploadStatus,
  loadProjectCatalog
} from "@/features/time-allocation/lib/api-client";
import {
  clearPendingProcoreReturn,
  getLastProjectStorageKey,
  readPendingProcoreReturn,
  type ViewMode
} from "@/features/time-allocation/lib/client-storage";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import { restoreWorkspaceSelection } from "@/features/time-allocation/lib/workspace-selection-helpers";

type DailyReportUploadNotice = { message: string; status: "success" | "error" } | null;

type ProjectCatalogBootstrapOptions = {
  currentUser: AuthUser | null;
  onConnectionStatus: (status: string) => void;
  onDailyReportUploadNotice: (notice: DailyReportUploadNotice) => void;
  onLoadingProjectsChange: (loading: boolean) => void;
  onMobileSelectedPayItemIdChange: (payItemId: string) => void;
  onProjectLoadError: (message: string) => void;
  onProjectsChange: (projects: Project[]) => void;
  onSelectedProjectChange: (projectId: string) => void;
  onSyncedAtChange: (syncedAt: string | null) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onWorkDateChange: (workDate: string) => void;
};

export function useProjectCatalogBootstrap({
  currentUser,
  onConnectionStatus,
  onDailyReportUploadNotice,
  onLoadingProjectsChange,
  onMobileSelectedPayItemIdChange,
  onProjectLoadError,
  onProjectsChange,
  onSelectedProjectChange,
  onSyncedAtChange,
  onViewModeChange,
  onWorkDateChange
}: ProjectCatalogBootstrapOptions) {
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const procoreStatus = new URLSearchParams(window.location.search).get("procore");
    if (procoreStatus === "connected") {
      onConnectionStatus("Procore connected");
    } else if (procoreStatus) {
      onConnectionStatus("Procore connection needs attention");
    }

    const currentUserId = currentUser.id;

    async function loadProcoreConnectionStatus() {
      try {
        const data = await loadProcoreUploadStatus();

        if (data.connected && data.connectedBy) {
          onConnectionStatus(`Procore configured by ${data.connectedBy}`);
        }
      } catch {
        // Project catalog data can still load even if the Procore upload status check fails.
      }
    }

    async function loadProjects() {
      onLoadingProjectsChange(true);
      onProjectLoadError("");

      try {
        const data = await loadProjectCatalog();
        const sortedProjects = sortProjectsByName(data.projects);
        const lastSelectedProjectId = window.localStorage.getItem(getLastProjectStorageKey(currentUserId));
        const pendingProcoreReturn = readPendingProcoreReturn();
        const restoredSelection = restoreWorkspaceSelection({
          lastSelectedProjectId,
          pendingProcoreReturn,
          projects: sortedProjects
        });

        onProjectsChange(sortedProjects);
        onSelectedProjectChange(restoredSelection.selectedProjectId);
        if (restoredSelection.workDate) {
          onWorkDateChange(restoredSelection.workDate);
        }
        if (restoredSelection.viewMode) {
          onViewModeChange(restoredSelection.viewMode);
        }
        if (restoredSelection.mobileSelectedPayItemId) {
          onMobileSelectedPayItemIdChange(restoredSelection.mobileSelectedPayItemId);
        }
        if (pendingProcoreReturn) {
          clearPendingProcoreReturn();
        }
        if (procoreStatus === "connected" && pendingProcoreReturn?.intent === "upload_daily") {
          onDailyReportUploadNotice({
            message: "Procore connected. Click Upload Daily to Procore to finish sending this daily.",
            status: "success"
          });
        }
        onSyncedAtChange(data.syncedAt ?? null);
        onConnectionStatus(data.syncedAt ? "Project catalog loaded" : "No project catalog data");
      } catch (error) {
        onProjectLoadError(error instanceof Error ? error.message : "Unable to load projects.");
      } finally {
        onLoadingProjectsChange(false);
      }
    }

    void loadProcoreConnectionStatus();
    void loadProjects();
  }, [
    currentUser,
    onConnectionStatus,
    onDailyReportUploadNotice,
    onLoadingProjectsChange,
    onMobileSelectedPayItemIdChange,
    onProjectLoadError,
    onProjectsChange,
    onSelectedProjectChange,
    onSyncedAtChange,
    onViewModeChange,
    onWorkDateChange
  ]);
}
