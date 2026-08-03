import type { Project } from "@/lib/domain/types";
import type {
  PendingProcoreReturn,
  ViewMode
} from "@/features/time-allocation/lib/client-storage";

type RestoredWorkspaceSelection = {
  mobileSelectedPayItemId?: string;
  selectedProjectId: string;
  viewMode?: ViewMode;
  workDate?: string;
};

type RestoreWorkspaceSelectionOptions = {
  lastSelectedProjectId: string | null;
  pendingProcoreReturn: PendingProcoreReturn | null;
  projects: Project[];
};

function projectExists(projects: Project[], projectId: string | null | undefined) {
  return Boolean(projectId && projects.some((project) => project.id === projectId));
}

export function restoreWorkspaceSelection({
  lastSelectedProjectId,
  pendingProcoreReturn,
  projects
}: RestoreWorkspaceSelectionOptions): RestoredWorkspaceSelection {
  const fallbackProjectId = projectExists(projects, lastSelectedProjectId)
    ? lastSelectedProjectId ?? ""
    : projects[0]?.id ?? "";
  const selectedProjectId = projectExists(projects, pendingProcoreReturn?.projectId)
    ? pendingProcoreReturn?.projectId ?? fallbackProjectId
    : fallbackProjectId;

  return {
    mobileSelectedPayItemId: pendingProcoreReturn?.mobilePayItemId,
    selectedProjectId,
    viewMode: pendingProcoreReturn?.viewMode,
    workDate: pendingProcoreReturn?.date
  };
}
