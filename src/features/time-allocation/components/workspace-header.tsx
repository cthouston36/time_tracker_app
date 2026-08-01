import NextImage from "next/image";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Edit3,
  KeyRound,
  LayoutDashboard,
  LogOut
} from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { canAccessReports } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import {
  formatRole,
  formatUserName
} from "@/features/time-allocation/lib/auth-ui-helpers";
import type { ViewMode } from "@/features/time-allocation/lib/client-storage";

export function WorkspaceHeader({
  connectionStatus,
  currentUser,
  userCanAccessDashboard,
  viewMode,
  onChangePassword,
  onChangeViewMode,
  onLogout
}: {
  connectionStatus: string;
  currentUser: AuthUser;
  userCanAccessDashboard: boolean;
  viewMode: ViewMode;
  onChangePassword: () => void;
  onChangeViewMode: (viewMode: ViewMode) => void;
  onLogout: () => void;
}) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <NextImage
          alt="Chinchor Electric Inc."
          className="brand-logo"
          height={908}
          priority
          src="/chinchor-logo.png"
          width={3310}
        />
        <div className="brand-copy">
          <h1>Crew Time Allocation</h1>
        </div>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {userCanAccessDashboard ? (
          <button
            className={viewMode === "dashboard" ? "tab-button active" : "tab-button"}
            onClick={() => onChangeViewMode("dashboard")}
            type="button"
          >
            <LayoutDashboard aria-hidden="true" size={16} />
            Dashboard
          </button>
        ) : null}
        <button
          className={viewMode === "entry" ? "tab-button active" : "tab-button"}
          onClick={() => onChangeViewMode("entry")}
          type="button"
        >
          <Edit3 aria-hidden="true" size={16} />
          Entry
        </button>
        {canAccessReports(currentUser) ? (
          <button
            className={viewMode === "reports" ? "tab-button active" : "tab-button"}
            onClick={() => onChangeViewMode("reports")}
            type="button"
          >
            <BarChart3 aria-hidden="true" size={16} />
            Reports
          </button>
        ) : null}
      </nav>
      <div className="header-actions">
        <details className="desktop-header-menu">
          <summary>
            <span>
              <strong>{formatUserName(currentUser)}</strong>
              <small>{formatRole(currentUser.role)}</small>
            </span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className="desktop-header-menu-body">
            <IconLabel icon={CheckCircle2} text={connectionStatus} />
            <button className="secondary-button" onClick={onChangePassword} type="button">
              <KeyRound aria-hidden="true" size={18} />
              Change Password
            </button>
            <button className="secondary-button" onClick={onLogout} type="button">
              <LogOut aria-hidden="true" size={18} />
              Sign out
            </button>
          </div>
        </details>
      </div>
      <details className="mobile-header-menu">
        <summary>
          <span>
            <strong>{formatUserName(currentUser)}</strong>
            <small>{formatRole(currentUser.role)}</small>
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <div className="mobile-header-menu-body">
          <IconLabel icon={CheckCircle2} text={connectionStatus} />
          <button className="secondary-button" onClick={onChangePassword} type="button">
            <KeyRound aria-hidden="true" size={18} />
            Change Password
          </button>
          <button className="secondary-button" onClick={onLogout} type="button">
            <LogOut aria-hidden="true" size={18} />
            Sign out
          </button>
        </div>
      </details>
    </header>
  );
}
