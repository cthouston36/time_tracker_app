"use client";

import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import type { Project } from "@/lib/procore/types";

export function MyJobsManager({
  automaticJobIds = [],
  description = "Tag projects you want to filter quickly.",
  myJobIds,
  projects,
  setMyJobIds,
  title = "My Projects"
}: {
  automaticJobIds?: string[];
  description?: string;
  myJobIds: string[];
  projects: Project[];
  setMyJobIds: (jobIds: string[]) => void;
  title?: string;
}) {
  const automaticJobIdSet = new Set(automaticJobIds);
  const selectedJobIds = new Set(myJobIds);
  const sortedProjects = sortProjectsByName(projects);

  function toggleJob(projectId: string, checked: boolean) {
    if (automaticJobIdSet.has(projectId)) {
      return;
    }

    const nextSelectedJobIds = new Set(selectedJobIds);

    if (checked) {
      nextSelectedJobIds.add(projectId);
    } else {
      nextSelectedJobIds.delete(projectId);
    }

    setMyJobIds(sortedProjects.filter((project) => nextSelectedJobIds.has(project.id)).map((project) => project.id));
  }

  return (
    <div className="my-jobs-panel">
      <div className="my-jobs-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      {sortedProjects.length === 0 ? (
        <EmptyState title="No jobs available">Synced projects will appear here for My Projects tagging.</EmptyState>
      ) : (
        <div className="my-jobs-list">
          {sortedProjects.map((project) => (
            <label className="my-job-row" key={project.id}>
              <input
                checked={selectedJobIds.has(project.id)}
                disabled={automaticJobIdSet.has(project.id)}
                onChange={(event) => toggleJob(project.id, event.target.checked)}
                type="checkbox"
              />
              <span>
                {project.name}
                {automaticJobIdSet.has(project.id) ? " (NetSuite PM)" : ""}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
