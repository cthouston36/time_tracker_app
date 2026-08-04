import { useCallback } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { logoutCurrentUserSession } from "@/features/time-allocation/lib/api-client";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";
import type {
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById
} from "@/features/time-allocation/types";

type WorkspaceLogoutActionOptions = {
  confirmDiscardUnsavedChanges: (actionLabel: string) => Promise<boolean>;
  onAllProjectsChange: (projects: Project[]) => void;
  onCrewSetupExpandedChange: (expanded: boolean) => void;
  onCurrentUserChange: (user: AuthUser | null) => void;
  onDayEntryNotesByKeyChange: (notes: DayEntryNotesByKey) => void;
  onDaySubmissionsChange: (submissions: DaySubmissionsByKey) => void;
  onEntriesChange: (entries: AllocationEntry[]) => void;
  onMyJobsByUserChange: (jobs: MyJobsByUser) => void;
  onMyProjectsEditorOpenChange: (open: boolean) => void;
  onProjectArchiveByIdChange: (archive: ProjectArchiveById) => void;
  onProjectBlacklistByIdChange: (blacklist: ProjectBlacklistById) => void;
  onSelectedProjectIdChange: (projectId: string) => void;
  onShowOnlyMyProjectsChange: (showOnlyMyProjects: boolean) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  resetAuthForms: () => void;
  resetCrewManagementState: () => void;
  resetDailyReportState: () => void;
};

export function useWorkspaceLogoutAction({
  confirmDiscardUnsavedChanges,
  onAllProjectsChange,
  onCrewSetupExpandedChange,
  onCurrentUserChange,
  onDayEntryNotesByKeyChange,
  onDaySubmissionsChange,
  onEntriesChange,
  onMyJobsByUserChange,
  onMyProjectsEditorOpenChange,
  onProjectArchiveByIdChange,
  onProjectBlacklistByIdChange,
  onSelectedProjectIdChange,
  onShowOnlyMyProjectsChange,
  onViewModeChange,
  resetAuthForms,
  resetCrewManagementState,
  resetDailyReportState
}: WorkspaceLogoutActionOptions) {
  const logout = useCallback(async () => {
    if (!(await confirmDiscardUnsavedChanges("sign out"))) {
      return;
    }

    await logoutCurrentUserSession();

    onCurrentUserChange(null);
    onAllProjectsChange([]);
    onSelectedProjectIdChange("");
    onShowOnlyMyProjectsChange(false);
    onMyProjectsEditorOpenChange(false);
    onCrewSetupExpandedChange(false);
    resetAuthForms();
    onEntriesChange([]);
    onDaySubmissionsChange({});
    onDayEntryNotesByKeyChange({});
    resetDailyReportState();
    onMyJobsByUserChange({});
    onProjectArchiveByIdChange({});
    onProjectBlacklistByIdChange({});
    resetCrewManagementState();
    onViewModeChange("dashboard");
  }, [
    confirmDiscardUnsavedChanges,
    onAllProjectsChange,
    onCrewSetupExpandedChange,
    onCurrentUserChange,
    onDayEntryNotesByKeyChange,
    onDaySubmissionsChange,
    onEntriesChange,
    onMyJobsByUserChange,
    onMyProjectsEditorOpenChange,
    onProjectArchiveByIdChange,
    onProjectBlacklistByIdChange,
    onSelectedProjectIdChange,
    onShowOnlyMyProjectsChange,
    onViewModeChange,
    resetAuthForms,
    resetCrewManagementState,
    resetDailyReportState
  ]);

  return { logout };
}
