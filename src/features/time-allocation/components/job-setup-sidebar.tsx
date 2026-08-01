import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";
import { CrewSetupPanel } from "@/features/time-allocation/components/crew-setup-panel";
import { ProjectSetupPanel } from "@/features/time-allocation/components/project-setup-panel";
import { formatDate } from "@/features/time-allocation/lib/date-helpers";
import type {
  CrewMember,
  NetSuiteVendor
} from "@/features/time-allocation/types";
import type { EditingCrewMember } from "@/features/time-allocation/hooks/use-crew-management";

export function JobSetupSidebar({
  adminTools,
  allProjects,
  currentUser,
  currentUserAutoMyJobIds,
  currentUserCanManageMyProjects,
  currentUserMyJobIds,
  crewDirectory,
  crewMemberJobTitle,
  crewMemberLaborType,
  crewMemberName,
  crewSetupExpanded,
  dateInputRef,
  editingCrewMember,
  entries,
  entryNotice,
  existingCrewMemberOptions,
  filteredSubcontractorVendors,
  jobPickerProjects,
  jobSetupCollapsed,
  jobSetupExpanded,
  loadingNetSuiteVendors,
  mergeSourceCrewMemberId,
  mergeTargetCrewMemberId,
  myProjectsEditorOpen,
  netSuiteVendors,
  projectLoadError,
  projects,
  selectedExistingCrewMemberId,
  selectedProject,
  selectedProjectCrewMembers,
  selectedProjectId,
  selectedSubcontractorVendorId,
  showOnlyMyProjects,
  subcontractorVendorSearch,
  syncedAt,
  workDate,
  onAddCrewMember,
  onAddExistingCrewMemberToProject,
  onAddSubcontractorVendorToProject,
  onCancelEditingCrewMember,
  onChangeSelectedProject,
  onChangeWorkDate,
  onMergeCrewMembers,
  onRemoveCrewMember,
  onSaveEditedCrewMember,
  onSelectSubcontractorVendor,
  onSetCrewMemberJobTitle,
  onSetCrewMemberLaborType,
  onSetCrewMemberName,
  onSetCrewSetupExpanded,
  onSetJobSetupCollapsed,
  onSetJobSetupExpanded,
  onSetMergeSourceCrewMemberId,
  onSetMergeTargetCrewMemberId,
  onSetMyProjectsEditorOpen,
  onSetSelectedExistingCrewMemberId,
  onSetShowOnlyMyProjects,
  onSetUserMyJobIds,
  onStartEditingCrewMember,
  onUpdateEditingCrewMember,
  onUpdateSubcontractorVendorSearch
}: {
  adminTools: ReactNode;
  allProjects: Project[];
  currentUser: AuthUser;
  currentUserAutoMyJobIds: string[];
  currentUserCanManageMyProjects: boolean;
  currentUserMyJobIds: string[];
  crewDirectory: CrewMember[];
  crewMemberJobTitle: string;
  crewMemberLaborType: CrewLaborType;
  crewMemberName: string;
  crewSetupExpanded: boolean;
  dateInputRef: RefObject<HTMLInputElement | null>;
  editingCrewMember: EditingCrewMember | null;
  entries: AllocationEntry[];
  entryNotice: string;
  existingCrewMemberOptions: CrewMember[];
  filteredSubcontractorVendors: NetSuiteVendor[];
  jobPickerProjects: Project[];
  jobSetupCollapsed: boolean;
  jobSetupExpanded: boolean;
  loadingNetSuiteVendors: boolean;
  mergeSourceCrewMemberId: string;
  mergeTargetCrewMemberId: string;
  myProjectsEditorOpen: boolean;
  netSuiteVendors: NetSuiteVendor[];
  projectLoadError: string;
  projects: Project[];
  selectedExistingCrewMemberId: string;
  selectedProject: Project | undefined;
  selectedProjectCrewMembers: CrewMember[];
  selectedProjectId: string;
  selectedSubcontractorVendorId: string;
  showOnlyMyProjects: boolean;
  subcontractorVendorSearch: string;
  syncedAt: string | null;
  workDate: string;
  onAddCrewMember: () => void;
  onAddExistingCrewMemberToProject: () => void;
  onAddSubcontractorVendorToProject: () => void;
  onCancelEditingCrewMember: () => void;
  onChangeSelectedProject: (projectId: string) => void;
  onChangeWorkDate: (workDate: string) => void;
  onMergeCrewMembers: () => void;
  onRemoveCrewMember: (crewMemberId: string) => void;
  onSaveEditedCrewMember: () => void;
  onSelectSubcontractorVendor: (vendor: NetSuiteVendor) => void;
  onSetCrewMemberJobTitle: (jobTitle: string) => void;
  onSetCrewMemberLaborType: (laborType: CrewLaborType) => void;
  onSetCrewMemberName: (name: string) => void;
  onSetCrewSetupExpanded: Dispatch<SetStateAction<boolean>>;
  onSetJobSetupCollapsed: Dispatch<SetStateAction<boolean>>;
  onSetJobSetupExpanded: Dispatch<SetStateAction<boolean>>;
  onSetMergeSourceCrewMemberId: (crewMemberId: string) => void;
  onSetMergeTargetCrewMemberId: (crewMemberId: string) => void;
  onSetMyProjectsEditorOpen: Dispatch<SetStateAction<boolean>>;
  onSetSelectedExistingCrewMemberId: (crewMemberId: string) => void;
  onSetShowOnlyMyProjects: (showOnlyMyProjects: boolean) => void;
  onSetUserMyJobIds: (jobIds: string[]) => void;
  onStartEditingCrewMember: (member: CrewMember) => void;
  onUpdateEditingCrewMember: <Field extends keyof Omit<EditingCrewMember, "crewMemberId">>(
    field: Field,
    value: EditingCrewMember[Field]
  ) => void;
  onUpdateSubcontractorVendorSearch: (value: string) => void;
}) {
  return (
    <aside
      className={[
        "panel",
        "job-setup-panel",
        jobSetupExpanded ? "expanded" : "",
        jobSetupCollapsed ? "collapsed" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        aria-controls="job-setup-body"
        aria-expanded={jobSetupExpanded}
        className="job-setup-mobile-toggle"
        onClick={() => onSetJobSetupExpanded((current) => !current)}
        type="button"
      >
        <span>
          <strong>Job Setup</strong>
          <small>
            {selectedProject?.name ?? "No job selected"} - {formatDate(workDate)}
          </small>
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      <div className="job-setup-desktop-heading">
        <h2 className="job-setup-desktop-title">Job Setup</h2>
        <button
          aria-label={jobSetupCollapsed ? "Expand Job Setup sidebar" : "Collapse Job Setup sidebar"}
          className="job-setup-desktop-toggle"
          onClick={() => onSetJobSetupCollapsed((current) => !current)}
          title={jobSetupCollapsed ? "Expand Job Setup" : "Collapse Job Setup"}
          type="button"
        >
          {jobSetupCollapsed ? (
            <ChevronRight aria-hidden="true" size={18} />
          ) : (
            <ChevronLeft aria-hidden="true" size={18} />
          )}
        </button>
      </div>
      <div className="job-setup-body" id="job-setup-body">
        <ProjectSetupPanel
          allProjects={allProjects}
          currentUser={currentUser}
          currentUserAutoMyJobIds={currentUserAutoMyJobIds}
          currentUserCanManageMyProjects={currentUserCanManageMyProjects}
          currentUserMyJobIds={currentUserMyJobIds}
          dateInputRef={dateInputRef}
          jobPickerProjects={jobPickerProjects}
          myProjectsEditorOpen={myProjectsEditorOpen}
          projectLoadError={projectLoadError}
          projects={projects}
          selectedProjectId={selectedProjectId}
          showOnlyMyProjects={showOnlyMyProjects}
          syncedAt={syncedAt}
          workDate={workDate}
          onChangeSelectedProject={onChangeSelectedProject}
          onChangeWorkDate={onChangeWorkDate}
          onSetMyProjectsEditorOpen={onSetMyProjectsEditorOpen}
          onSetShowOnlyMyProjects={onSetShowOnlyMyProjects}
          onSetUserMyJobIds={onSetUserMyJobIds}
        />

        <CrewSetupPanel
          crewDirectory={crewDirectory}
          crewMemberJobTitle={crewMemberJobTitle}
          crewMemberLaborType={crewMemberLaborType}
          crewMemberName={crewMemberName}
          crewSetupExpanded={crewSetupExpanded}
          currentUserRole={currentUser.role}
          editingCrewMember={editingCrewMember}
          entries={entries}
          entryNotice={entryNotice}
          existingCrewMemberOptions={existingCrewMemberOptions}
          filteredSubcontractorVendors={filteredSubcontractorVendors}
          loadingNetSuiteVendors={loadingNetSuiteVendors}
          mergeSourceCrewMemberId={mergeSourceCrewMemberId}
          mergeTargetCrewMemberId={mergeTargetCrewMemberId}
          netSuiteVendors={netSuiteVendors}
          selectedExistingCrewMemberId={selectedExistingCrewMemberId}
          selectedProject={selectedProject}
          selectedProjectCrewMembers={selectedProjectCrewMembers}
          selectedSubcontractorVendorId={selectedSubcontractorVendorId}
          subcontractorVendorSearch={subcontractorVendorSearch}
          onAddCrewMember={onAddCrewMember}
          onAddExistingCrewMemberToProject={onAddExistingCrewMemberToProject}
          onAddSubcontractorVendorToProject={onAddSubcontractorVendorToProject}
          onCancelEditingCrewMember={onCancelEditingCrewMember}
          onMergeCrewMembers={onMergeCrewMembers}
          onRemoveCrewMember={onRemoveCrewMember}
          onSaveEditedCrewMember={onSaveEditedCrewMember}
          onSelectSubcontractorVendor={onSelectSubcontractorVendor}
          onSetCrewMemberJobTitle={onSetCrewMemberJobTitle}
          onSetCrewMemberLaborType={onSetCrewMemberLaborType}
          onSetCrewMemberName={onSetCrewMemberName}
          onSetCrewSetupExpanded={onSetCrewSetupExpanded}
          onSetMergeSourceCrewMemberId={onSetMergeSourceCrewMemberId}
          onSetMergeTargetCrewMemberId={onSetMergeTargetCrewMemberId}
          onSetSelectedExistingCrewMemberId={onSetSelectedExistingCrewMemberId}
          onStartEditingCrewMember={onStartEditingCrewMember}
          onUpdateEditingCrewMember={onUpdateEditingCrewMember}
          onUpdateSubcontractorVendorSearch={onUpdateSubcontractorVendorSearch}
        />
        {adminTools}
      </div>
    </aside>
  );
}
