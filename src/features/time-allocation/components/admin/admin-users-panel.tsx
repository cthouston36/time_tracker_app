"use client";

import { Edit3, KeyRound, RefreshCw, Save, UserPlus, Users, X } from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import {
  formatRole,
  formatUserName,
  type AdminUserFormState,
  type PasswordResetResponse
} from "@/features/time-allocation/lib/auth-ui-helpers";
import type { ManagedAppUser, NetSuiteProjectManagerOption } from "@/features/time-allocation/types";

export function AdminUsersPanel({
  currentUserId,
  editingUserId,
  form,
  loading,
  netSuiteProjectManagerOptions,
  notice,
  onCancelEdit,
  onCreatePasswordResetToken,
  onEditUser,
  onRefresh,
  onSaveUser,
  onSetUserActive,
  onUpdateForm,
  resetToken,
  saving,
  users
}: {
  currentUserId: string;
  editingUserId: string;
  form: AdminUserFormState;
  loading: boolean;
  netSuiteProjectManagerOptions: NetSuiteProjectManagerOption[];
  notice: string;
  onCancelEdit: () => void;
  onCreatePasswordResetToken: (user: ManagedAppUser) => void;
  onEditUser: (user: ManagedAppUser) => void;
  onRefresh: () => void;
  onSaveUser: () => void;
  onSetUserActive: (user: ManagedAppUser, active: boolean) => void;
  onUpdateForm: (field: keyof AdminUserFormState, value: string | boolean) => void;
  resetToken: PasswordResetResponse | null;
  saving: boolean;
  users: ManagedAppUser[];
}) {
  const activeUserCount = users.filter((user) => user.active).length;
  const projectManagerOptions = mergeNetSuiteProjectManagerOptions(netSuiteProjectManagerOptions, {
    id: form.netSuiteProjectManagerId,
    name: form.netSuiteProjectManagerName
  });

  return (
    <details className="admin-users">
      <summary>
        <Users aria-hidden="true" size={16} />
        Users ({activeUserCount}/{users.length})
      </summary>
      <div className="admin-users-body">
        {notice ? <div className={notice.toLowerCase().includes("unable") || notice.toLowerCase().includes("requires") ? "inline-alert" : "success-alert"}>{notice}</div> : null}
        {resetToken?.token ? (
          <div className="password-reset-code-panel">
            <span>One-time reset code for {resetToken.userId}</span>
            <strong>{resetToken.token}</strong>
            <small>Give this code to the user. It expires {resetToken.expiresAt ? new Date(resetToken.expiresAt).toLocaleString() : "in 24 hours"}.</small>
          </div>
        ) : null}
        <div className="admin-user-form">
          <div className="field-group">
            <label htmlFor="admin-user-id">User ID</label>
            <input
              disabled={Boolean(editingUserId) || saving}
              id="admin-user-id"
              onChange={(event) => onUpdateForm("userId", event.target.value)}
              placeholder="jdoe"
              value={form.userId}
            />
          </div>
          <div className="admin-user-name-grid">
            <div className="field-group">
              <label htmlFor="admin-user-first-name">First Name</label>
              <input
                disabled={saving}
                id="admin-user-first-name"
                onChange={(event) => onUpdateForm("firstName", event.target.value)}
                value={form.firstName}
              />
            </div>
            <div className="field-group">
              <label htmlFor="admin-user-last-name">Last Name</label>
              <input
                disabled={saving}
                id="admin-user-last-name"
                onChange={(event) => onUpdateForm("lastName", event.target.value)}
                value={form.lastName}
              />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="admin-user-role">Role</label>
            <select
              disabled={saving || form.userId === currentUserId}
              id="admin-user-role"
              onChange={(event) => {
                const role = event.target.value as AuthUser["role"];
                onUpdateForm("role", role);

                if (role !== "project_manager") {
                  onUpdateForm("netSuiteProjectManagerId", "");
                  onUpdateForm("netSuiteProjectManagerName", "");
                }
              }}
              value={form.role}
            >
              <option value="standard">Field</option>
              <option value="project_manager">Project Manager</option>
              <option value="executive">Executive</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === "project_manager" ? (
            <div className="field-group">
              <label htmlFor="admin-user-netsuite-pm">NetSuite Project Manager</label>
              <select
                disabled={saving}
                id="admin-user-netsuite-pm"
                onChange={(event) => {
                  const selectedOption = projectManagerOptions.find((option) => option.id === event.target.value);

                  onUpdateForm("netSuiteProjectManagerId", selectedOption?.id ?? "");
                  onUpdateForm("netSuiteProjectManagerName", selectedOption?.name ?? "");
                }}
                value={form.netSuiteProjectManagerId}
              >
                <option value="">No NetSuite PM mapping</option>
                {projectManagerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <div className="field-note">Used to default this PM&apos;s My Projects from NetSuite project records.</div>
            </div>
          ) : null}
          <div className="field-group">
            <label htmlFor="admin-user-password">{editingUserId ? "New Password" : "Temporary Password"}</label>
            <input
              autoComplete="new-password"
              disabled={saving}
              id="admin-user-password"
              onChange={(event) => onUpdateForm("password", event.target.value)}
              placeholder={editingUserId ? "Leave blank to keep current password" : ""}
              type="password"
              value={form.password}
            />
          </div>
          <label className="compact-check-row">
            <input
              checked={form.active}
              disabled={saving || form.userId === currentUserId}
              onChange={(event) => onUpdateForm("active", event.target.checked)}
              type="checkbox"
            />
            <span>Active account</span>
          </label>
          <div className="admin-user-actions">
            <button className="primary-button" disabled={saving} onClick={onSaveUser} type="button">
              <Save aria-hidden="true" size={16} />
              {saving ? "Saving..." : editingUserId ? "Save user" : "Create user"}
            </button>
            {editingUserId ? (
              <button className="secondary-button" disabled={saving} onClick={onCancelEdit} type="button">
                <X aria-hidden="true" size={16} />
                Cancel
              </button>
            ) : null}
            <button className="secondary-button" disabled={loading || saving} onClick={onRefresh} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="field-note">No database users loaded yet.</div>
        ) : (
          <div className="admin-user-list">
            {users.map((user) => (
              <div className={user.active ? "admin-user-row" : "admin-user-row inactive"} key={user.id}>
                <div className="admin-user-row-main">
                  <strong>{formatUserName(user)}</strong>
                  <span>
                    {user.id} - {formatRole(user.role)}
                    {user.role === "project_manager" && user.netSuiteProjectManagerName
                      ? ` - NetSuite PM: ${user.netSuiteProjectManagerName}`
                      : ""}
                  </span>
                </div>
                <div className="admin-user-row-actions">
                  <button className="icon-button" onClick={() => onEditUser(user)} title="Edit user" type="button">
                    <Edit3 aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving || !user.active}
                    onClick={() => onCreatePasswordResetToken(user)}
                    title="Create password reset code"
                    type="button"
                  >
                    <KeyRound aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving || user.id === currentUserId}
                    onClick={() => onSetUserActive(user, !user.active)}
                    title={user.active ? "Deactivate user" : "Reactivate user"}
                    type="button"
                  >
                    {user.active ? <X aria-hidden="true" size={16} /> : <UserPlus aria-hidden="true" size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function mergeNetSuiteProjectManagerOptions(
  options: NetSuiteProjectManagerOption[],
  selectedOption: NetSuiteProjectManagerOption
) {
  if (!selectedOption.id || options.some((option) => option.id === selectedOption.id)) {
    return options;
  }

  return [...options, selectedOption].sort((left, right) => left.name.localeCompare(right.name));
}
