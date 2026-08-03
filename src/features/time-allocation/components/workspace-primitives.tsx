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
      <div className="report-skeleton-header">
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
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

export function ReportControlsLoadingSkeleton() {
  return (
    <div className="report-controls report-controls-skeleton" aria-label="Loading report filters">
      <LoadingSkeleton className="skeleton-field" />
      <LoadingSkeleton className="skeleton-field" />
      <LoadingSkeleton className="skeleton-field" />
      <LoadingSkeleton className="skeleton-field" />
      <LoadingSkeleton className="skeleton-button" />
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="dashboard-loading-skeleton" aria-label="Loading dashboard">
      <div className="dashboard-metrics">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="dashboard-metric-card skeleton-card" key={index}>
            <LoadingSkeleton />
            <LoadingSkeleton className="skeleton-title" />
          </div>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <div className="dashboard-main-column">
          <div className="panel dashboard-calendar-panel">
            <div className="panel-heading">
              <LoadingSkeleton className="skeleton-title" />
              <LoadingSkeleton className="skeleton-short" />
            </div>
            <div className="dashboard-calendar-skeleton">
              {Array.from({ length: 4 }, (_, rowIndex) => (
                <div className="dashboard-calendar-skeleton-row" key={rowIndex}>
                  <LoadingSkeleton />
                  {Array.from({ length: 4 }, (_, cellIndex) => (
                    <LoadingSkeleton key={cellIndex} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="panel dashboard-projects-panel">
            <div className="panel-heading">
              <LoadingSkeleton className="skeleton-title" />
              <LoadingSkeleton className="skeleton-short" />
            </div>
            <div className="dashboard-section-list">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="dashboard-list-row" key={index}>
                  <LoadingSkeleton />
                  <LoadingSkeleton className="skeleton-short" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
