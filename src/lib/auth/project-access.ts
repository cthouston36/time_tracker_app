import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/procore/types";

export function canAccessReports(user: AuthUser) {
  return user.role === "admin" || user.role === "executive" || user.role === "project_manager";
}

export function getReportProjectsForUser(user: AuthUser, projects: Project[]) {
  return canAccessReports(user) ? projects : [];
}

export function getProjectAccessScopeForUser(user: AuthUser, projects: Project[]) {
  if (user.role !== "project_manager") {
    return null;
  }

  const netSuiteProjectManagerId = user.netSuiteProjectManagerId?.trim();

  if (!netSuiteProjectManagerId) {
    return [];
  }

  return projects
    .filter((project) => project.netSuiteProjectManagerId === netSuiteProjectManagerId)
    .map((project) => project.id);
}

export function getAccessibleProjectsForUser(user: AuthUser, projects: Project[]) {
  const projectAccessScope = getProjectAccessScopeForUser(user, projects);

  if (projectAccessScope === null) {
    return projects;
  }

  const accessibleProjectIds = new Set(projectAccessScope);

  return projects.filter((project) => accessibleProjectIds.has(project.id));
}

export function userCanAccessProjectId(user: AuthUser, projectId: string, projects: Project[]) {
  if (!projectId) {
    return false;
  }

  if (!projects.some((project) => project.id === projectId)) {
    return false;
  }

  if (user.role !== "project_manager") {
    return true;
  }

  return getAccessibleProjectsForUser(user, projects).some((project) => project.id === projectId);
}
