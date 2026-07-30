import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/procore/types";

export type ProjectAccessOptions = {
  assignedProjectIdsByUser?: Record<string, string[]>;
};

export function canAccessReports(user: AuthUser) {
  return user.role === "admin" || user.role === "executive" || user.role === "project_manager";
}

export function getReportProjectsForUser(user: AuthUser, projects: Project[]) {
  return canAccessReports(user) ? projects : [];
}

export function getProjectAccessScopeForUser(user: AuthUser, projects: Project[], options: ProjectAccessOptions = {}) {
  if (user.role === "admin" || user.role === "executive") {
    return null;
  }

  if (user.role === "standard") {
    const assignedProjectIds = options.assignedProjectIdsByUser?.[user.id] ?? [];
    const projectIds = new Set(projects.map((project) => project.id));

    return assignedProjectIds.filter((projectId) => projectIds.has(projectId));
  }

  const netSuiteProjectManagerId = user.netSuiteProjectManagerId?.trim();

  if (!netSuiteProjectManagerId) {
    return [];
  }

  return projects
    .filter((project) => project.netSuiteProjectManagerId === netSuiteProjectManagerId)
    .map((project) => project.id);
}

export function getAccessibleProjectsForUser(user: AuthUser, projects: Project[], options: ProjectAccessOptions = {}) {
  const projectAccessScope = getProjectAccessScopeForUser(user, projects, options);

  if (projectAccessScope === null) {
    return projects;
  }

  const accessibleProjectIds = new Set(projectAccessScope);

  return projects.filter((project) => accessibleProjectIds.has(project.id));
}

export function userCanAccessProjectId(
  user: AuthUser,
  projectId: string,
  projects: Project[],
  options: ProjectAccessOptions = {}
) {
  if (!projectId) {
    return false;
  }

  if (!projects.some((project) => project.id === projectId)) {
    return false;
  }

  if (user.role === "admin" || user.role === "executive") {
    return true;
  }

  return getAccessibleProjectsForUser(user, projects, options).some((project) => project.id === projectId);
}
