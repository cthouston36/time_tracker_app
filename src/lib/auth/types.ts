export const USER_ROLES = ["standard", "project_manager", "executive", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId?: string;
  netSuiteProjectManagerName?: string;
  role: UserRole;
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
