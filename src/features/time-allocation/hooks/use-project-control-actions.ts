import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import {
  saveDatabaseMyJobs,
  saveDatabaseProjectArchive,
  saveDatabaseProjectBlacklist
} from "@/features/time-allocation/lib/api-client";
import { getDefaultMyJobIdsForUser } from "@/features/time-allocation/lib/selectors";
import type {
  DraftsByPayItem,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById
} from "@/features/time-allocation/types";

type ProjectControlActionsOptions = {
  cancelEditingEntry: () => void;
  currentUser: AuthUser | null;
  projects: Project[];
  selectedProjectId: string;
  setDraftsByPayItem: Dispatch<SetStateAction<DraftsByPayItem>>;
  setEntryNotice: (message: string) => void;
  setMobileSelectedPayItemId: (payItemId: string) => void;
  setMyJobsByUser: Dispatch<SetStateAction<MyJobsByUser>>;
  setProjectArchiveById: Dispatch<SetStateAction<ProjectArchiveById>>;
  setProjectBlacklistById: Dispatch<SetStateAction<ProjectBlacklistById>>;
  setProjectLoadError: (message: string) => void;
  setSelectedProjectId: (projectId: string) => void;
};

export function useProjectControlActions({
  cancelEditingEntry,
  currentUser,
  projects,
  selectedProjectId,
  setDraftsByPayItem,
  setEntryNotice,
  setMobileSelectedPayItemId,
  setMyJobsByUser,
  setProjectArchiveById,
  setProjectBlacklistById,
  setProjectLoadError,
  setSelectedProjectId
}: ProjectControlActionsOptions) {
  const setCurrentUserMyJobIds = useCallback(
    (jobIds: string[]) => {
      if (!currentUser) {
        return;
      }

      const availableProjectIds = new Set(projects.map((project) => project.id));
      const automaticallyManagedJobIds = new Set(getDefaultMyJobIdsForUser(currentUser, projects));
      const uniqueJobIds = Array.from(new Set(jobIds)).filter(
        (jobId) => availableProjectIds.has(jobId) && !automaticallyManagedJobIds.has(jobId)
      );

      setMyJobsByUser((current) => ({
        ...current,
        [currentUser.id]: uniqueJobIds
      }));
      void saveDatabaseMyJobs(currentUser.id, uniqueJobIds).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "My Projects saved locally, but did not sync.");
      });
    },
    [currentUser, projects, setEntryNotice, setMyJobsByUser]
  );

  const toggleProjectBlacklist = useCallback(
    (projectId: string, blacklisted: boolean) => {
      setProjectBlacklistById((current) => {
        if (blacklisted) {
          return {
            ...current,
            [projectId]: true
          };
        }

        const nextBlacklist = { ...current };
        delete nextBlacklist[projectId];
        return nextBlacklist;
      });
      void saveDatabaseProjectBlacklist(projectId, blacklisted).catch((error) => {
        setProjectLoadError(error instanceof Error ? error.message : "Project blacklist saved locally, but did not sync.");
      });
    },
    [setProjectBlacklistById, setProjectLoadError]
  );

  const toggleProjectArchive = useCallback(
    (projectId: string, archived: boolean) => {
      setProjectArchiveById((current) => {
        if (archived) {
          return {
            ...current,
            [projectId]: true
          };
        }

        const nextArchive = { ...current };
        delete nextArchive[projectId];
        return nextArchive;
      });

      if (archived && selectedProjectId === projectId) {
        const nextProject = projects.find((project) => project.id !== projectId);

        setSelectedProjectId(nextProject?.id ?? "");
        setMobileSelectedPayItemId("");
        cancelEditingEntry();
        setDraftsByPayItem({});
      }

      void saveDatabaseProjectArchive(projectId, archived).catch((error) => {
        setProjectLoadError(error instanceof Error ? error.message : "Project archive saved locally, but did not sync.");
      });
    },
    [
      cancelEditingEntry,
      projects,
      selectedProjectId,
      setDraftsByPayItem,
      setMobileSelectedPayItemId,
      setProjectArchiveById,
      setProjectLoadError,
      setSelectedProjectId
    ]
  );

  return {
    setCurrentUserMyJobIds,
    toggleProjectArchive,
    toggleProjectBlacklist
  };
}
