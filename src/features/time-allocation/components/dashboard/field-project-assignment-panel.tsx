"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Inbox, Save, Users } from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import { formatUserName } from "@/lib/auth/display";
import { EmptyState, InlineSpinner } from "@/features/time-allocation/components/workspace-primitives";
import { getFieldUserIdsAssignedToProject } from "@/features/time-allocation/lib/selectors";
import type { MyJobsByUser } from "@/features/time-allocation/types";

export function FieldProjectAssignmentPanel({
  currentUser,
  fieldUsers,
  myJobsByUser,
  notice,
  onSaveAssignments,
  projects,
  requestedProjectId,
  requestKey = 0,
  savingProjectId
}: {
  currentUser: AuthUser;
  fieldUsers: AuthUser[];
  myJobsByUser: MyJobsByUser;
  notice: { message: string; status: "success" | "error" } | null;
  onSaveAssignments: (projectId: string, fieldUserIds: string[]) => Promise<void>;
  projects: Project[];
  requestedProjectId?: string;
  requestKey?: number;
  savingProjectId: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [fieldUserSearch, setFieldUserSearch] = useState("");
  const [draftFieldUserIds, setDraftFieldUserIds] = useState<string[]>([]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const assignedFieldUserIds = selectedProject ? getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, selectedProject.id) : [];
  const draftFieldUserIdSet = useMemo(() => new Set(draftFieldUserIds), [draftFieldUserIds]);
  const filteredFieldUsers = useMemo(
    () => filterFieldUsersBySearch(fieldUsers, fieldUserSearch),
    [fieldUserSearch, fieldUsers]
  );
  const hasChanges = selectedProject ? !sameStringSet(assignedFieldUserIds, draftFieldUserIds) : false;

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectId("");
      setDraftFieldUserIds([]);
      return;
    }

    if (selectedProject.id !== selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    }

    setDraftFieldUserIds(getFieldUserIdsAssignedToProject(fieldUsers, myJobsByUser, selectedProject.id));
  }, [fieldUsers, myJobsByUser, selectedProject, selectedProjectId]);

  useEffect(() => {
    if (!requestedProjectId || !projects.some((project) => project.id === requestedProjectId)) {
      return;
    }

    setSelectedProjectId(requestedProjectId);

    if (detailsRef.current) {
      detailsRef.current.open = true;
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }
  }, [projects, requestedProjectId, requestKey]);

  function toggleFieldUser(userId: string) {
    setDraftFieldUserIds((current) =>
      current.includes(userId) ? current.filter((candidate) => candidate !== userId) : [...current, userId]
    );
  }

  if (currentUser.role === "standard") {
    return null;
  }

  return (
    <details className="panel dashboard-field-access-panel" ref={detailsRef}>
      <summary className="field-access-summary">
        <span>
          <strong>Field Access</strong>
          <small>Assign Field users by project</small>
        </span>
        <span className="field-access-summary-meta">
          {selectedProject ? `${draftFieldUserIds.length} assigned` : `${projects.length} projects`}
          <ChevronDown aria-hidden="true" size={18} />
        </span>
      </summary>

      <div className="field-access-body">
        <div className="field-access-intro">
          <span className="dashboard-panel-meta">Choose a job, then assign the Field users who can enter and upload against it.</span>
          {selectedProject ? (
            <span className="dashboard-panel-meta">
              {draftFieldUserIds.length} Field user{draftFieldUserIds.length === 1 ? "" : "s"} assigned
            </span>
          ) : null}
        </div>

        {notice ? <div className={notice.status === "error" ? "inline-alert" : "success-alert"}>{notice.message}</div> : null}

        {fieldUsers.length === 0 ? (
          <EmptyState icon={Users} title="No Field users available">
            Create active Field users before assigning project access.
          </EmptyState>
        ) : projects.length === 0 ? (
          <EmptyState icon={Inbox} title="No assignable projects">
            Projects you can assign will appear here after sync and access setup.
          </EmptyState>
        ) : (
          <div className="field-access-layout">
            <div className="field-access-controls">
              <label className="field-group">
                <span>Project</span>
                <select value={selectedProject?.id ?? ""} onChange={(event) => setSelectedProjectId(event.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Find Field User</span>
                <input
                  placeholder="Search name or user ID"
                  value={fieldUserSearch}
                  onChange={(event) => setFieldUserSearch(event.target.value)}
                />
              </label>
            </div>

            <div className="field-access-project-list">
              {filteredFieldUsers.map((user) => (
                <label className="field-access-project-row" key={user.id}>
                  <input checked={draftFieldUserIdSet.has(user.id)} onChange={() => toggleFieldUser(user.id)} type="checkbox" />
                  <span>
                    <strong>{formatUserName(user)}</strong>
                    <small>
                      {user.id} - {draftFieldUserIdSet.has(user.id) ? "Attached" : "Not assigned"}
                    </small>
                  </span>
                </label>
              ))}
              {filteredFieldUsers.length === 0 ? <EmptyState title="No matching Field users" /> : null}
            </div>

            <div className="field-access-actions">
              <span className="field-note">
                PMs can only assign projects tied to their NetSuite Project Manager record.
              </span>
              <button
                className="primary-button prominent-action"
                disabled={!selectedProject || !hasChanges || savingProjectId === selectedProject.id}
                onClick={() => selectedProject && void onSaveAssignments(selectedProject.id, draftFieldUserIds)}
                type="button"
              >
                {savingProjectId === selectedProject?.id ? <InlineSpinner /> : <Save aria-hidden="true" size={18} />}
                {savingProjectId === selectedProject?.id ? "Saving..." : "Save Field Access"}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function filterFieldUsersBySearch(fieldUsers: AuthUser[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return fieldUsers;
  }

  return fieldUsers.filter((fieldUser) =>
    [fieldUser.id, fieldUser.firstName, fieldUser.lastName].join(" ").toLowerCase().includes(normalizedSearch)
  );
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
}
