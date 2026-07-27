export type UserRole = "standard" | "project_manager" | "admin";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId?: string;
  netSuiteProjectManagerName?: string;
  role: UserRole;
};
