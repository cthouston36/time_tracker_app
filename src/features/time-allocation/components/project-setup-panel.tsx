import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks
} from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import { MyJobsManager } from "@/features/time-allocation/components/my-jobs-manager";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import { openDatePicker } from "@/features/time-allocation/lib/browser-actions";
import { addDaysToInputDate } from "@/features/time-allocation/lib/date-helpers";

export function ProjectSetupPanel({
  allProjects,
  currentUser,
  currentUserAutoMyJobIds,
  currentUserCanManageMyProjects,
  currentUserMyJobIds,
  dateInputRef,
  jobPickerProjects,
  myProjectsEditorOpen,
  projectLoadError,
  projects,
  selectedProjectId,
  showOnlyMyProjects,
  syncedAt,
  workDate,
  onChangeSelectedProject,
  onChangeWorkDate,
  onSetMyProjectsEditorOpen,
  onSetShowOnlyMyProjects,
  onSetUserMyJobIds
}: {
  allProjects: Project[];
  currentUser: AuthUser;
  currentUserAutoMyJobIds: string[];
  currentUserCanManageMyProjects: boolean;
  currentUserMyJobIds: string[];
  dateInputRef: RefObject<HTMLInputElement | null>;
  jobPickerProjects: Project[];
  myProjectsEditorOpen: boolean;
  projectLoadError: string;
  projects: Project[];
  selectedProjectId: string;
  showOnlyMyProjects: boolean;
  syncedAt: string | null;
  workDate: string;
  onChangeSelectedProject: (projectId: string) => void;
  onChangeWorkDate: (workDate: string) => void;
  onSetMyProjectsEditorOpen: Dispatch<SetStateAction<boolean>>;
  onSetShowOnlyMyProjects: (showOnlyMyProjects: boolean) => void;
  onSetUserMyJobIds: (jobIds: string[]) => void;
}) {
  return (
    <>
      <div className="field-group">
        <label htmlFor="project">Job</label>
        <select
          className="desktop-select"
          id="project"
          disabled={jobPickerProjects.length === 0}
          value={selectedProjectId}
          onChange={(event) => {
            onChangeSelectedProject(event.target.value);
          }}
        >
          {jobPickerProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <MobileOptionPicker
          disabled={jobPickerProjects.length === 0}
          label="Job"
          options={jobPickerProjects.map((project) => ({
            value: project.id,
            label: project.name
          }))}
          value={selectedProjectId}
          onChange={(value) => {
            onChangeSelectedProject(value);
          }}
        />
      </div>
      {currentUserCanManageMyProjects ? (
        <div className="my-project-sidebar-tools">
          <button
            aria-expanded={myProjectsEditorOpen}
            className="secondary-button"
            onClick={() => onSetMyProjectsEditorOpen((current) => !current)}
            type="button"
          >
            <ListChecks aria-hidden="true" size={18} />
            Create/Update My Projects ({currentUserMyJobIds.length})
          </button>
          <label className="compact-check-row">
            <input
              checked={showOnlyMyProjects}
              disabled={currentUserMyJobIds.length === 0}
              onChange={(event) => onSetShowOnlyMyProjects(event.target.checked)}
              type="checkbox"
            />
            <span>Show My Projects only</span>
          </label>
        </div>
      ) : currentUser.role === "project_manager" ? (
        <div className="field-note">Your projects are assigned from the NetSuite Project Manager field.</div>
      ) : null}
      {myProjectsEditorOpen ? (
        <MyJobsManager
          automaticJobIds={currentUserAutoMyJobIds}
          description="Tag projects you work on so they are easier to find in entry and dashboard views."
          myJobIds={currentUserMyJobIds}
          projects={projects}
          setMyJobIds={onSetUserMyJobIds}
          title="My Projects"
        />
      ) : null}
      {projects.length === 0 && !projectLoadError ? (
        <EmptyState title={allProjects.length > 0 ? "No selectable projects" : "No projects loaded"}>
          {allProjects.length > 0
            ? "All project catalog jobs are currently hidden by admin controls."
            : currentUser.role === "admin"
              ? "Use Admin Tools to load NetSuite jobs and pay items."
              : "Projects will appear after an admin syncs NetSuite data."}
        </EmptyState>
      ) : null}
      {projectLoadError ? <div className="inline-alert">{projectLoadError}</div> : null}
      {currentUser.role === "admin" ? (
        syncedAt ? (
          <div className="field-note">Last synced {new Date(syncedAt).toLocaleString()}</div>
        ) : (
          <div className="field-note">Use Admin Tools to load uncached NetSuite jobs and pay items.</div>
        )
      ) : null}

      <div className="field-group">
        <label htmlFor="work-date">Date</label>
        <div className="date-stepper-row">
          <button
            aria-label="Go to previous day"
            className="date-step-button"
            onClick={() => onChangeWorkDate(addDaysToInputDate(workDate, -1))}
            type="button"
            title="Previous day"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div className="date-input-wrap">
            <input
              id="work-date"
              ref={dateInputRef}
              type="date"
              value={workDate}
              onChange={(event) => {
                onChangeWorkDate(event.target.value);
              }}
            />
            <button
              aria-label="Open date picker"
              className="date-input-button"
              onClick={() => openDatePicker(dateInputRef.current)}
              type="button"
            >
              <CalendarDays aria-hidden="true" size={18} />
            </button>
          </div>
          <button
            aria-label="Go to next day"
            className="date-step-button"
            onClick={() => onChangeWorkDate(addDaysToInputDate(workDate, 1))}
            type="button"
            title="Next day"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
