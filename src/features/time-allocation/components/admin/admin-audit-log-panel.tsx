"use client";

import { useMemo, useState } from "react";
import { ListChecks, RefreshCw } from "lucide-react";
import { formatStatusDateTime } from "@/lib/date";
import type { Project } from "@/lib/domain/types";
import { readApiJson } from "@/features/time-allocation/lib/api-utils";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import type { ManagedAppUser } from "@/features/time-allocation/types";

type AuditLogEntry = {
  action: string;
  actorName?: string;
  actorRole?: string;
  actorUserId?: string;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  targetId?: string;
  targetType?: string;
};

type AuditLogFilters = {
  action: string;
  actorUserId: string;
  endDate: string;
  limit: string;
  projectId: string;
  startDate: string;
  targetId: string;
  targetType: string;
};

type AuditLogResponse = {
  auditLog?: AuditLogEntry[];
  databaseConfigured?: boolean;
  error?: string;
};

export function AdminAuditLogPanel({ projects, users }: { projects: Project[]; users: ManagedAppUser[] }) {
  const [filters, setFilters] = useState<AuditLogFilters>(() => createEmptyAuditLogFilters());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const sortedProjects = useMemo(() => sortProjectsByName(projects), [projects]);
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)) || a.id.localeCompare(b.id)),
    [users]
  );

  async function refreshAuditLog(nextFilters = filters) {
    setLoading(true);
    setNotice("");

    try {
      const data = await loadAdminAuditLog(nextFilters);

      if (!data.databaseConfigured) {
        setNotice("Audit log viewer requires the production database.");
        setAuditLog([]);
        return;
      }

      setAuditLog(data.auditLog ?? []);
      setLoaded(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load audit log.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(field: keyof AuditLogFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  function clearFilters() {
    const emptyFilters = createEmptyAuditLogFilters();

    setFilters(emptyFilters);
    void refreshAuditLog(emptyFilters);
  }

  return (
    <details
      className="admin-audit-log"
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) {
          void refreshAuditLog();
        }
      }}
    >
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Audit Log {loaded ? `(${auditLog.length})` : ""}
      </summary>
      <div className="admin-audit-body">
        <div className="admin-audit-filters">
          <label>
            User
            <select value={filters.actorUserId} onChange={(event) => updateFilter("actorUserId", event.target.value)}>
              <option value="">All users</option>
              {sortedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserName(user)} ({user.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Job
            <select value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
              <option value="">All jobs</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("action", event.target.value)}
              placeholder="sync, upload, user..."
              value={filters.action}
            />
          </label>
          <label>
            Target Type
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("targetType", event.target.value)}
              placeholder="project, user..."
              value={filters.targetType}
            />
          </label>
          <label>
            Target ID
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("targetId", event.target.value)}
              placeholder="Exact target ID"
              value={filters.targetId}
            />
          </label>
          <label>
            Start
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("startDate", event.target.value)}
              type="date"
              value={filters.startDate}
            />
          </label>
          <label>
            End
            <input
              className="compact-search-input"
              onChange={(event) => updateFilter("endDate", event.target.value)}
              type="date"
              value={filters.endDate}
            />
          </label>
          <label>
            Limit
            <select value={filters.limit} onChange={(event) => updateFilter("limit", event.target.value)}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </label>
        </div>
        <div className="admin-panel-toolbar">
          <span>Use filters before refreshing to keep the audit query narrow.</span>
          <div className="admin-panel-actions">
            <button className="secondary-button compact-button" disabled={loading} onClick={clearFilters} type="button">
              Clear
            </button>
            <button className="primary-button compact-button" disabled={loading} onClick={() => refreshAuditLog()} type="button">
              <RefreshCw aria-hidden="true" size={14} />
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
        {notice ? <div className="inline-alert">{notice}</div> : null}
        {!loading && loaded && auditLog.length === 0 ? <div className="field-note">No audit log entries match the filters.</div> : null}
        {auditLog.length > 0 ? (
          <div className="audit-log-list">
            {auditLog.map((entry) => (
              <div className="audit-log-row" key={entry.id}>
                <div className="audit-log-main">
                  <strong>{entry.action}</strong>
                  <span>{entry.createdAt ? formatStatusDateTime(entry.createdAt) : "Unknown time"}</span>
                </div>
                <div className="audit-log-meta">
                  <span>
                    Actor: {entry.actorName || entry.actorUserId || "system"}
                    {entry.actorRole ? ` (${entry.actorRole})` : ""}
                  </span>
                  <span>
                    Target: {entry.targetType || "unknown"}
                    {entry.targetId ? ` ${entry.targetId}` : ""}
                  </span>
                </div>
                <small>{formatAuditMetadata(entry.metadata)}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function createEmptyAuditLogFilters(): AuditLogFilters {
  return {
    action: "",
    actorUserId: "",
    endDate: "",
    limit: "200",
    projectId: "",
    startDate: "",
    targetId: "",
    targetType: ""
  };
}

async function loadAdminAuditLog(filters: AuditLogFilters) {
  const params = new URLSearchParams();

  params.set("limit", filters.limit || "200");

  for (const [key, value] of Object.entries(filters)) {
    if (key === "limit") {
      continue;
    }

    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  const response = await fetch(`/api/admin/audit-log?${params.toString()}`, {
    cache: "no-store"
  });
  const data = (await readApiJson(response)) as AuditLogResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load audit log.");
  }

  return data;
}

function formatAuditMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length === 0) {
    return "No extra metadata.";
  }

  return entries
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${formatAuditMetadataValue(value)}`)
    .join(" | ");
}

function formatAuditMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatAuditMetadataValue).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
