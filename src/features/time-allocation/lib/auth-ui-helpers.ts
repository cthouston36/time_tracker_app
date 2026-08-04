import type { AuthUser } from "@/lib/auth/types";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";

export { formatUserName } from "@/lib/auth/display";

export type AdminUserFormState = {
  active: boolean;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId: string;
  netSuiteProjectManagerName: string;
  password: string;
  role: AuthUser["role"];
  userId: string;
};

export type ChangePasswordFormState = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
};

export type PasswordResetFormState = {
  confirmPassword: string;
  newPassword: string;
  token: string;
  userId: string;
};

export type PasswordResetResponse = {
  error?: string;
  expiresAt?: string;
  ok?: boolean;
  token?: string;
  userId?: string;
};

export function createEmptyAdminUserForm(): AdminUserFormState {
  return {
    active: true,
    firstName: "",
    lastName: "",
    netSuiteProjectManagerId: "",
    netSuiteProjectManagerName: "",
    password: "",
    role: "standard",
    userId: ""
  };
}

export function createEmptyChangePasswordForm(): ChangePasswordFormState {
  return {
    confirmPassword: "",
    currentPassword: "",
    newPassword: ""
  };
}

export function createEmptyPasswordResetForm(): PasswordResetFormState {
  return {
    confirmPassword: "",
    newPassword: "",
    token: "",
    userId: ""
  };
}

export function formatRole(role: AuthUser["role"]) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "project_manager") {
    return "Project Manager";
  }

  if (role === "executive") {
    return "Executive";
  }

  return "Field";
}

export function getDefaultViewModeForUser(): ViewMode {
  return "dashboard";
}
