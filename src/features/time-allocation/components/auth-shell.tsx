"use client";

import type { PasswordResetFormState } from "@/features/time-allocation/lib/auth-ui-helpers";

type AuthNotice = { message: string; status: "success" | "error" } | null;

export function AuthShell({
  closePasswordReset,
  login,
  loginError,
  loginPassword,
  loginUserId,
  openPasswordReset,
  passwordResetForm,
  passwordResetNotice,
  passwordResetOpen,
  resettingPassword,
  setLoginPassword,
  setLoginUserId,
  submitPasswordReset,
  updatePasswordResetForm
}: {
  closePasswordReset: () => void;
  login: () => Promise<void>;
  loginError: string;
  loginPassword: string;
  loginUserId: string;
  openPasswordReset: () => void;
  passwordResetForm: PasswordResetFormState;
  passwordResetNotice: AuthNotice;
  passwordResetOpen: boolean;
  resettingPassword: boolean;
  setLoginPassword: (value: string) => void;
  setLoginUserId: (value: string) => void;
  submitPasswordReset: () => Promise<void>;
  updatePasswordResetForm: (field: keyof PasswordResetFormState, value: string) => void;
}) {
  return (
    <main className="app-shell centered-shell">
      {passwordResetOpen ? (
        <form
          className="panel auth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPasswordReset();
          }}
        >
          <h1>Reset Password</h1>
          <p className="field-note">Enter the reset code provided by an admin.</p>
          <div className="field-group">
            <label htmlFor="reset-user-id">User ID</label>
            <input
              id="reset-user-id"
              value={passwordResetForm.userId}
              onChange={(event) => updatePasswordResetForm("userId", event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="reset-token">Reset Code</label>
            <input
              id="reset-token"
              value={passwordResetForm.token}
              onChange={(event) => updatePasswordResetForm("token", event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="reset-new-password">New Password</label>
            <input
              autoComplete="new-password"
              id="reset-new-password"
              type="password"
              value={passwordResetForm.newPassword}
              onChange={(event) => updatePasswordResetForm("newPassword", event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="reset-confirm-password">Confirm New Password</label>
            <input
              autoComplete="new-password"
              id="reset-confirm-password"
              type="password"
              value={passwordResetForm.confirmPassword}
              onChange={(event) => updatePasswordResetForm("confirmPassword", event.target.value)}
            />
          </div>
          {passwordResetNotice ? (
            <div className={passwordResetNotice.status === "error" ? "inline-alert" : "success-alert"}>
              {passwordResetNotice.message}
            </div>
          ) : null}
          <button className="primary-button" disabled={resettingPassword} type="submit">
            {resettingPassword ? "Resetting..." : "Reset password"}
          </button>
          <button className="secondary-button" disabled={resettingPassword} onClick={closePasswordReset} type="button">
            Back to sign in
          </button>
        </form>
      ) : (
        <form
          className="panel auth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <h1>Crew Time Allocation</h1>
          <p className="field-note">Sign in to enter daily pay item production.</p>
          <div className="field-group">
            <label htmlFor="user-id">User ID</label>
            <input id="user-id" value={loginUserId} onChange={(event) => setLoginUserId(event.target.value)} />
          </div>
          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
          </div>
          {loginError ? <div className="inline-alert">{loginError}</div> : null}
          <button className="primary-button" type="submit">
            Sign in
          </button>
          <button className="text-button auth-text-button" onClick={openPasswordReset} type="button">
            Forgot password?
          </button>
        </form>
      )}
    </main>
  );
}
