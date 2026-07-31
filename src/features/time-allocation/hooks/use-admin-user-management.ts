import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import { readApiJson } from "@/features/time-allocation/lib/api-client";
import {
  createEmptyAdminUserForm,
  formatUserName,
  type AdminUserFormState,
  type PasswordResetResponse
} from "@/features/time-allocation/lib/auth-ui-helpers";
import { resolveNetSuiteProjectManagerOption } from "@/features/time-allocation/lib/selectors";
import type {
  ManagedAppUser,
  NetSuiteProjectManagerOption
} from "@/features/time-allocation/types";
import type { AdminUsersResponse } from "@/features/time-allocation/lib/workspace-api-types";

export function useAdminUserManagement({
  currentUser,
  netSuiteProjectManagerOptions
}: {
  currentUser: AuthUser | null;
  netSuiteProjectManagerOptions: NetSuiteProjectManagerOption[];
}) {
  const [adminUsers, setAdminUsers] = useState<ManagedAppUser[]>([]);
  const [adminUsersNotice, setAdminUsersNotice] = useState("");
  const [adminPasswordResetToken, setAdminPasswordResetToken] = useState<PasswordResetResponse | null>(null);
  const [adminUserForm, setAdminUserForm] = useState<AdminUserFormState>(() => createEmptyAdminUserForm());
  const [editingAdminUserId, setEditingAdminUserId] = useState("");
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [savingAdminUser, setSavingAdminUser] = useState(false);

  const resetAdminUserForm = useCallback(() => {
    setEditingAdminUserId("");
    setAdminUsersNotice("");
    setAdminUserForm(createEmptyAdminUserForm());
  }, []);

  const resetAdminUsers = useCallback(() => {
    setAdminUsers([]);
    setAdminUsersNotice("");
    setAdminPasswordResetToken(null);
    setAdminUserForm(createEmptyAdminUserForm());
    setEditingAdminUserId("");
    setLoadingAdminUsers(false);
    setSavingAdminUser(false);
  }, []);

  const loadAdminUsers = useCallback(async () => {
    if (currentUser?.role !== "admin") {
      resetAdminUsers();
      return;
    }

    setLoadingAdminUsers(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse;

      if (!response.ok || data.databaseConfigured === false) {
        throw new Error(data.error ?? "User management requires the database.");
      }

      setAdminUsers(data.users ?? []);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoadingAdminUsers(false);
    }
  }, [currentUser?.role, resetAdminUsers]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void loadAdminUsers();
      return;
    }

    resetAdminUsers();
  }, [currentUser?.role, loadAdminUsers, resetAdminUsers]);

  function updateAdminUserForm(field: keyof AdminUserFormState, value: string | boolean) {
    setAdminUsersNotice("");
    setAdminUserForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function startEditingAdminUser(user: ManagedAppUser) {
    setEditingAdminUserId(user.id);
    setAdminUsersNotice("");
    setAdminUserForm({
      active: user.active,
      firstName: user.firstName,
      lastName: user.lastName,
      netSuiteProjectManagerId: user.netSuiteProjectManagerId ?? "",
      netSuiteProjectManagerName: user.netSuiteProjectManagerName ?? "",
      password: "",
      role: user.role,
      userId: user.id
    });
  }

  async function saveAdminUser() {
    if (currentUser?.role !== "admin") {
      return;
    }

    const userId = adminUserForm.userId.trim().toLowerCase();
    const firstName = adminUserForm.firstName.trim();
    const lastName = adminUserForm.lastName.trim();
    const netSuiteProjectManager = resolveNetSuiteProjectManagerOption(
      adminUserForm.netSuiteProjectManagerId,
      netSuiteProjectManagerOptions
    );
    const password = adminUserForm.password.trim();

    if (!userId || !firstName || !lastName) {
      setAdminUsersNotice("Enter user ID, first name, and last name.");
      return;
    }

    if (!editingAdminUserId && !password) {
      setAdminUsersNotice("Enter a temporary password for new users.");
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          active: adminUserForm.active,
          firstName,
          lastName,
          netSuiteProjectManagerId: adminUserForm.role === "project_manager" ? netSuiteProjectManager?.id : undefined,
          netSuiteProjectManagerName: adminUserForm.role === "project_manager" ? netSuiteProjectManager?.name : undefined,
          password: password || undefined,
          role: adminUserForm.role,
          userId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse & { ok?: boolean };

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to save user.");
      }

      setAdminUsers(data.users ?? []);
      resetAdminUserForm();
      setAdminUsersNotice(`${firstName} ${lastName} saved.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  async function setAdminUserActive(user: ManagedAppUser, active: boolean) {
    if (currentUser?.role !== "admin") {
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          active,
          firstName: user.firstName,
          lastName: user.lastName,
          netSuiteProjectManagerId: user.netSuiteProjectManagerId,
          netSuiteProjectManagerName: user.netSuiteProjectManagerName,
          role: user.role,
          userId: user.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as AdminUsersResponse & { ok?: boolean };

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to update user.");
      }

      setAdminUsers(data.users ?? []);
      setAdminUsersNotice(`${formatUserName(user)} ${active ? "reactivated" : "deactivated"}.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  async function createAdminPasswordResetToken(user: ManagedAppUser) {
    if (currentUser?.role !== "admin") {
      return;
    }

    setSavingAdminUser(true);
    setAdminUsersNotice("");
    setAdminPasswordResetToken(null);

    try {
      const response = await fetch("/api/admin/users/reset-token", {
        body: JSON.stringify({
          userId: user.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as PasswordResetResponse;

      if (!response.ok || data.ok === false || !data.token) {
        throw new Error(data.error ?? "Unable to create reset code.");
      }

      setAdminPasswordResetToken(data);
      setAdminUsersNotice(`Reset code created for ${formatUserName(user)}. It expires in 24 hours.`);
    } catch (error) {
      setAdminUsersNotice(error instanceof Error ? error.message : "Unable to create reset code.");
    } finally {
      setSavingAdminUser(false);
    }
  }

  return {
    adminPasswordResetToken,
    adminUserForm,
    adminUsers,
    adminUsersNotice,
    createAdminPasswordResetToken,
    editingAdminUserId,
    loadAdminUsers,
    loadingAdminUsers,
    resetAdminUserForm,
    saveAdminUser,
    savingAdminUser,
    setAdminUserActive,
    startEditingAdminUser,
    updateAdminUserForm
  };
}
