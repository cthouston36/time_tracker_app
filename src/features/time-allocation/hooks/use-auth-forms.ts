import { useCallback, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import { readApiJson } from "@/features/time-allocation/lib/api-client";
import {
  createEmptyChangePasswordForm,
  createEmptyPasswordResetForm,
  type ChangePasswordFormState,
  type PasswordResetFormState,
  type PasswordResetResponse
} from "@/features/time-allocation/lib/auth-ui-helpers";
import type {
  AuthResponse,
  ChangePasswordResponse
} from "@/features/time-allocation/lib/workspace-api-types";

type FormNotice = { message: string; status: "success" | "error" } | null;

type UseAuthFormsOptions = {
  onLoginSuccess: (user: AuthUser) => void;
};

export function useAuthForms({ onLoginSuccess }: UseAuthFormsOptions) {
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetForm, setPasswordResetForm] = useState<PasswordResetFormState>(() => createEmptyPasswordResetForm());
  const [passwordResetNotice, setPasswordResetNotice] = useState<FormNotice>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState<ChangePasswordFormState>(() => createEmptyChangePasswordForm());
  const [changePasswordNotice, setChangePasswordNotice] = useState<FormNotice>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const login = useCallback(async () => {
    setLoginError("");

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({
        password: loginPassword,
        userId: loginUserId
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const data = (await readApiJson(response)) as AuthResponse;

    if (!response.ok || !data.user) {
      setLoginError(data.error ?? "Unable to sign in.");
      return;
    }

    onLoginSuccess(data.user);
    setLoginPassword("");
  }, [loginPassword, loginUserId, onLoginSuccess]);

  const updatePasswordResetForm = useCallback((field: keyof PasswordResetFormState, value: string) => {
    setPasswordResetNotice(null);
    setPasswordResetForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const openPasswordReset = useCallback(() => {
    setPasswordResetOpen(true);
    setPasswordResetNotice(null);
    setPasswordResetForm((current) => ({
      ...current,
      userId: current.userId || loginUserId
    }));
  }, [loginUserId]);

  const closePasswordReset = useCallback(() => {
    if (resettingPassword) {
      return;
    }

    setPasswordResetOpen(false);
    setPasswordResetForm(createEmptyPasswordResetForm());
    setPasswordResetNotice(null);
  }, [resettingPassword]);

  const submitPasswordReset = useCallback(async () => {
    const { confirmPassword, newPassword, token, userId } = passwordResetForm;

    if (!userId.trim() || !token.trim() || !newPassword || !confirmPassword) {
      setPasswordResetNotice({ message: "Enter user ID, reset code, new password, and confirmation.", status: "error" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordResetNotice({ message: "New password must be at least 8 characters.", status: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordResetNotice({ message: "New password and confirmation do not match.", status: "error" });
      return;
    }

    setResettingPassword(true);
    setPasswordResetNotice(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({
          newPassword,
          token,
          userId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as PasswordResetResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to reset password.");
      }

      setLoginUserId(userId.trim().toLowerCase());
      setPasswordResetForm(createEmptyPasswordResetForm());
      setPasswordResetNotice({ message: "Password reset. Sign in with the new password.", status: "success" });
    } catch (error) {
      setPasswordResetNotice({
        message: error instanceof Error ? error.message : "Unable to reset password.",
        status: "error"
      });
    } finally {
      setResettingPassword(false);
    }
  }, [passwordResetForm]);

  const openChangePasswordModal = useCallback(() => {
    setChangePasswordOpen(true);
  }, []);

  const updateChangePasswordForm = useCallback((field: keyof ChangePasswordFormState, value: string) => {
    setChangePasswordNotice(null);
    setChangePasswordForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const closeChangePasswordModal = useCallback(() => {
    if (changingPassword) {
      return;
    }

    setChangePasswordOpen(false);
    setChangePasswordForm(createEmptyChangePasswordForm());
    setChangePasswordNotice(null);
  }, [changingPassword]);

  const submitChangePassword = useCallback(async () => {
    const { confirmPassword, currentPassword, newPassword } = changePasswordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordNotice({ message: "Enter your current password, new password, and confirmation.", status: "error" });
      return;
    }

    if (newPassword.length < 8) {
      setChangePasswordNotice({ message: "New password must be at least 8 characters.", status: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordNotice({ message: "New password and confirmation do not match.", status: "error" });
      return;
    }

    setChangingPassword(true);
    setChangePasswordNotice(null);

    try {
      const response = await fetch("/api/auth/change-password", {
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await readApiJson(response)) as ChangePasswordResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "Unable to change password.");
      }

      setChangePasswordForm(createEmptyChangePasswordForm());
      setChangePasswordNotice({ message: "Password changed.", status: "success" });
    } catch (error) {
      setChangePasswordNotice(
        error instanceof Error
          ? { message: error.message, status: "error" }
          : { message: "Unable to change password.", status: "error" }
      );
    } finally {
      setChangingPassword(false);
    }
  }, [changePasswordForm]);

  const resetAuthForms = useCallback(() => {
    setLoginPassword("");
    setLoginError("");
    setPasswordResetOpen(false);
    setPasswordResetForm(createEmptyPasswordResetForm());
    setPasswordResetNotice(null);
    setResettingPassword(false);
    setChangePasswordOpen(false);
    setChangePasswordForm(createEmptyChangePasswordForm());
    setChangePasswordNotice(null);
    setChangingPassword(false);
  }, []);

  return {
    changePasswordForm,
    changePasswordNotice,
    changePasswordOpen,
    changingPassword,
    closeChangePasswordModal,
    closePasswordReset,
    login,
    loginError,
    loginPassword,
    loginUserId,
    openChangePasswordModal,
    openPasswordReset,
    passwordResetForm,
    passwordResetNotice,
    passwordResetOpen,
    resettingPassword,
    resetAuthForms,
    setLoginPassword,
    setLoginUserId,
    submitChangePassword,
    submitPasswordReset,
    updateChangePasswordForm,
    updatePasswordResetForm
  };
}
