import type { ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { EmptyState as DesignEmptyState } from "@/features/time-allocation/components/ui";

export function AppLoadingShell() {
  return (
    <main className="app-shell centered-shell">
      <div className="panel auth-panel loading-panel" aria-label="Loading application">
        <LoadingSkeleton className="skeleton-title" />
        <LoadingSkeleton />
        <div className="skeleton-field-stack">
          <LoadingSkeleton className="skeleton-field" />
          <LoadingSkeleton className="skeleton-field" />
          <LoadingSkeleton className="skeleton-button" />
        </div>
      </div>
    </main>
  );
}

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`loading-skeleton ${className}`} />;
}

export function ReportLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="report-loading-skeleton" aria-label="Loading report rows">
      {Array.from({ length: rows }, (_, index) => (
        <div className="report-skeleton-row" key={index}>
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  children,
  icon,
  title
}: {
  children?: ReactNode;
  icon?: LucideIcon;
  title: string;
}) {
  return <DesignEmptyState icon={icon} title={title}>{children}</DesignEmptyState>;
}

export function InlineSpinner() {
  return <LoaderCircle aria-hidden="true" className="inline-spinner" size={17} />;
}

export function PageHeader({
  icon: Icon,
  kicker,
  meta,
  title,
  titleOnly = false
}: {
  icon: LucideIcon;
  kicker: string;
  meta: string[];
  title: string;
  titleOnly?: boolean;
}) {
  return (
    <div className="page-header">
      <div className="page-title-group">
        {titleOnly ? (
          <h2 className="page-title-inline">
            <Icon aria-hidden="true" size={19} />
            <span>{title}</span>
          </h2>
        ) : (
          <>
            <div className="page-title-kicker">
              <Icon aria-hidden="true" size={17} />
              <span>{kicker}</span>
            </div>
            <h2>{title}</h2>
          </>
        )}
      </div>
      <div className="page-header-meta">
        {meta.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}
