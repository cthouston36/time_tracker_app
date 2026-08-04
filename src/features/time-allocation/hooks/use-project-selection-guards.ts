import { useEffect } from "react";
import type { Project } from "@/lib/domain/types";

type ProjectSelectionGuardOptions = {
  enabled: boolean;
  jobPickerProjects: Project[];
  onSelectionInvalid: () => void;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
};

export function useProjectSelectionGuards({
  enabled,
  jobPickerProjects,
  onSelectionInvalid,
  projects,
  selectedProjectId,
  setSelectedProjectId
}: ProjectSelectionGuardOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (projects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId("");
        onSelectionInvalid();
      }
      return;
    }

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      onSelectionInvalid();
    }
  }, [enabled, onSelectionInvalid, projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!enabled || jobPickerProjects.length === 0) {
      return;
    }

    if (!jobPickerProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(jobPickerProjects[0].id);
      onSelectionInvalid();
    }
  }, [enabled, jobPickerProjects, onSelectionInvalid, selectedProjectId, setSelectedProjectId]);
}
