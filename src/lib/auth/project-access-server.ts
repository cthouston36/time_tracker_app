import {
  getAccessibleProjectsForUser,
  getProjectAccessScopeForUser,
  userCanAccessProjectId,
  type ProjectAccessOptions
} from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import { readProjectControls } from "@/lib/project-controls-store";
import type { Project } from "@/lib/procore/types";

export async function getStoredProjectAccessOptions(): Promise<ProjectAccessOptions> {
  const projectControls = await readProjectControls();

  return {
    assignedProjectIdsByUser: projectControls?.myJobsByUser ?? {}
  };
}

export async function getAccessibleProjectsForRequestUser(user: AuthUser, projects: Project[]) {
  return getAccessibleProjectsForUser(user, projects, await getStoredProjectAccessOptions());
}

export async function getProjectAccessScopeForRequestUser(user: AuthUser, projects: Project[]) {
  return getProjectAccessScopeForUser(user, projects, await getStoredProjectAccessOptions());
}

export async function requestUserCanAccessProjectId(user: AuthUser, projectId: string, projects: Project[]) {
  return userCanAccessProjectId(user, projectId, projects, await getStoredProjectAccessOptions());
}
