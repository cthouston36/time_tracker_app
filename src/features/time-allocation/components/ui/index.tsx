"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from "react";
import { forwardRef } from "react";
import { Inbox, X, type LucideIcon } from "lucide-react";

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "text" | "icon";
type ButtonSize = "default" | "compact";

function buttonClassName({
  className,
  prominent,
  size,
  variant
}: {
  className?: string;
  prominent?: boolean;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  return cx(
    variant === "primary" && "primary-button",
    variant === "secondary" && "secondary-button",
    variant === "danger" && "danger-button",
    variant === "text" && "text-button",
    variant === "icon" && "icon-button",
    size === "compact" && "compact-button",
    prominent && "prominent-action",
    className
  );
}

export function Button({
  children,
  className,
  prominent = false,
  size = "default",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  prominent?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button className={buttonClassName({ className, prominent, size, variant })} type="button" {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  prominent = false,
  size = "default",
  variant = "secondary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  prominent?: boolean;
  size?: ButtonSize;
  variant?: Exclude<ButtonVariant, "icon">;
}) {
  return (
    <a className={buttonClassName({ className, prominent, size, variant })} {...props}>
      {children}
    </a>
  );
}

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Panel(
  { children, className, ...props },
  ref
) {
  return (
    <div className={cx("panel", className)} ref={ref} {...props}>
      {children}
    </div>
  );
});

export function PanelHeader({
  actions,
  children,
  className
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("panel-heading", className)}>
      {typeof children === "string" ? <h2>{children}</h2> : children}
      {actions ? <div className="panel-heading-actions">{actions}</div> : null}
    </div>
  );
}

export function PanelActions({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("panel-heading-actions", className)}>{children}</div>;
}

export function StatusPill({
  children,
  className,
  tone = "neutral"
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "error";
}) {
  return <span className={cx("status-pill", `status-pill-${tone}`, className)}>{children}</span>;
}

export function Toast({
  children,
  className,
  tone = "info"
}: {
  children: ReactNode;
  className?: string;
  tone?: "info" | "success" | "warning" | "error";
}) {
  const legacyClassName = tone === "success" ? "success-alert" : tone === "error" ? "inline-alert" : "field-note";
  return <div className={cx("toast", `toast-${tone}`, legacyClassName, className)}>{children}</div>;
}

export function EmptyState({
  children,
  className,
  icon: Icon = Inbox,
  title
}: {
  children?: ReactNode;
  className?: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className={cx("empty-state enhanced-empty-state", className)}>
      <span className="empty-state-icon">
        <Icon aria-hidden="true" size={20} />
      </span>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function DataTable({
  "aria-label": ariaLabel,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  "aria-label": string;
}) {
  return (
    <div aria-label={ariaLabel} className={cx("data-table", "report-table", className)} role="table" {...props}>
      {children}
    </div>
  );
}

export function Drawer({
  children,
  className,
  summary,
  ...props
}: HTMLAttributes<HTMLDetailsElement> & {
  summary: ReactNode;
}) {
  return (
    <details className={cx("drawer", className)} {...props}>
      <summary>{summary}</summary>
      <div className="drawer-body">{children}</div>
    </details>
  );
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  children,
  className,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  disabled = false,
  title,
  onCancel,
  onConfirm
}: {
  cancelLabel?: string;
  children?: ReactNode;
  className?: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className={cx("modal-panel confirm-dialog", className)} role="dialog">
        <div className="modal-heading">
          <h2>{title}</h2>
          <Button aria-label="Close dialog" onClick={onCancel} variant="icon">
            <X aria-hidden="true" size={18} />
          </Button>
        </div>
        {children ? <div className="confirm-dialog-body">{children}</div> : null}
        <div className="modal-actions">
          <Button disabled={disabled} onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button disabled={disabled} onClick={onConfirm} variant={confirmVariant}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Combobox({
  className,
  options,
  placeholder = "Select",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}) {
  return (
    <select className={cx("combobox-field", className)} {...props}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("date-field", className)} type="date" {...props} />;
}
