import { KeyRound, X } from "lucide-react";
import type { ChangePasswordFormState } from "@/features/time-allocation/lib/auth-ui-helpers";

export function ChangePasswordModal({
  form,
  notice,
  onClose,
  onSubmit,
  onUpdateForm,
  saving
}: {
  form: ChangePasswordFormState;
  notice: { message: string; status: "success" | "error" } | null;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateForm: (field: keyof ChangePasswordFormState, value: string) => void;
  saving: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <form
        className="modal-panel password-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="modal-heading">
          <div>
            <h2>Change Password</h2>
            <span>Update the password for your signed-in account.</span>
          </div>
          <button aria-label="Close change password" className="icon-button" disabled={saving} onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="change-password-form">
          <div className="field-group">
            <label htmlFor="current-password">Current Password</label>
            <input
              autoComplete="current-password"
              disabled={saving}
              id="current-password"
              onChange={(event) => onUpdateForm("currentPassword", event.target.value)}
              type="password"
              value={form.currentPassword}
            />
          </div>
          <div className="field-group">
            <label htmlFor="new-password">New Password</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="new-password"
              minLength={8}
              onChange={(event) => onUpdateForm("newPassword", event.target.value)}
              type="password"
              value={form.newPassword}
            />
          </div>
          <div className="field-group">
            <label htmlFor="confirm-new-password">Confirm New Password</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="confirm-new-password"
              minLength={8}
              onChange={(event) => onUpdateForm("confirmPassword", event.target.value)}
              type="password"
              value={form.confirmPassword}
            />
          </div>
          {notice ? <div className={notice.status === "success" ? "success-alert" : "inline-alert"}>{notice.message}</div> : null}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" disabled={saving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            <KeyRound aria-hidden="true" size={18} />
            {saving ? "Saving..." : "Save Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
