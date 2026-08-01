import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ListChecks,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";
import { MobileOptionPicker } from "@/features/time-allocation/components/mobile-option-picker";
import { MyJobsManager } from "@/features/time-allocation/components/my-jobs-manager";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import { openDatePicker } from "@/features/time-allocation/lib/browser-actions";
import { formatDate } from "@/features/time-allocation/lib/date-helpers";
import {
  crewMemberHasSavedAllocations,
  DEFAULT_CREW_LABOR_TYPE,
  formatCrewMemberMeta,
  formatCrewMemberOption,
  formatNetSuiteVendorOption,
  getCrewDisplayName,
  sortCrewMembersByName
} from "@/features/time-allocation/lib/crew-entry-helpers";
import {
  entryNoticeIsCrewRelated,
  getEntryNoticeClassName
} from "@/features/time-allocation/lib/notice-helpers";
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
              ? "All cached projects are currently hidden by admin controls."
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
        </div>

        <div className="crew-setup">
          <button
            aria-controls="crew-setup-body"
            aria-expanded={crewSetupExpanded}
            className="crew-setup-heading"
            onClick={() => onSetCrewSetupExpanded((current) => !current)}
            type="button"
          >
            <span className="crew-setup-title">Crew Members</span>
            <span className="crew-setup-meta">
              <span>{selectedProjectCrewMembers.length}</span>
              <ChevronDown aria-hidden="true" className="crew-setup-chevron" size={18} />
            </span>
          </button>
          {crewSetupExpanded ? (
            <div className="crew-setup-body" id="crew-setup-body">
              <div className="crew-existing-picker">
                <div className="field-group">
                  <label htmlFor="existing-crew-member">Add Existing Crew Member</label>
                  <select
                    id="existing-crew-member"
                    disabled={!selectedProject || existingCrewMemberOptions.length === 0}
                    value={selectedExistingCrewMemberId}
                    onChange={(event) => onSetSelectedExistingCrewMemberId(event.target.value)}
                  >
                    <option value="">
                      {existingCrewMemberOptions.length === 0 ? "No existing crew available" : "Select crew member"}
                    </option>
                    {existingCrewMemberOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {formatCrewMemberOption(member)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="secondary-button"
                  disabled={!selectedProject || !selectedExistingCrewMemberId}
                  onClick={onAddExistingCrewMemberToProject}
                  type="button"
                >
                  Add to job
                </button>
              </div>
              <div className="field-note">Add people as crew members. Add subcontractors as company names only.</div>
              {entryNotice && entryNoticeIsCrewRelated(entryNotice) ? (
                <div className={getEntryNoticeClassName(entryNotice)}>{entryNotice}</div>
              ) : null}
              <div className="crew-form-section">
                <h3>Crew Member</h3>
                <div className="field-group">
                  <label htmlFor="crew-member-temp">Temp Employee?</label>
                  <select
                    id="crew-member-temp"
                    disabled={!selectedProject}
                    value={crewMemberLaborType === "temp_employee" ? "yes" : "no"}
                    onChange={(event) =>
                      onSetCrewMemberLaborType(event.target.value === "yes" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE)
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="crew-member-name">Name</label>
                  <input
                    id="crew-member-name"
                    disabled={!selectedProject}
                    value={crewMemberName}
                    onChange={(event) => onSetCrewMemberName(event.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="crew-member-job-title">Job Title</label>
                  <input
                    id="crew-member-job-title"
                    disabled={!selectedProject}
                    value={crewMemberJobTitle}
                    onChange={(event) => onSetCrewMemberJobTitle(event.target.value)}
                  />
                </div>
                <button
                  className="secondary-button crew-add-button"
                  disabled={!selectedProject}
                  onClick={onAddCrewMember}
                  type="button"
                >
                  <UserPlus aria-hidden="true" size={18} />
                  Add crew member
                </button>
              </div>

              <div className="crew-form-section">
                <h3>Subcontractor</h3>
                <div className="field-group">
                  <label htmlFor="crew-member-subcontractor-vendor">NetSuite Vendor</label>
                  <div className="vendor-search-picker">
                    <input
                      autoComplete="off"
                      disabled={!selectedProject || loadingNetSuiteVendors || netSuiteVendors.length === 0}
                      id="crew-member-subcontractor-vendor"
                      placeholder={
                        loadingNetSuiteVendors
                          ? "Loading vendors..."
                          : netSuiteVendors.length === 0
                            ? "No vendors loaded"
                            : "Search vendor"
                      }
                      value={subcontractorVendorSearch}
                      onChange={(event) => onUpdateSubcontractorVendorSearch(event.target.value)}
                    />
                    {netSuiteVendors.length > 0 ? (
                      <div className="vendor-search-results" role="listbox">
                        {filteredSubcontractorVendors.length === 0 ? (
                          <div className="vendor-search-empty">No matching vendors.</div>
                        ) : (
                          filteredSubcontractorVendors.map((vendor) => (
                            <button
                              aria-selected={selectedSubcontractorVendorId === vendor.id}
                              className={selectedSubcontractorVendorId === vendor.id ? "vendor-search-option selected" : "vendor-search-option"}
                              key={vendor.id}
                              onClick={() => onSelectSubcontractorVendor(vendor)}
                              role="option"
                              type="button"
                            >
                              <span>{formatNetSuiteVendorOption(vendor)}</span>
                              <small>{vendor.defaultAddress}</small>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                {netSuiteVendors.length === 0 ? (
                  <div className="field-note">
                    Admins can use Get Vendors in Admin Tools to load NetSuite vendors with default addresses.
                  </div>
                ) : null}
                <button
                  className="secondary-button crew-add-button"
                  disabled={!selectedProject || (!selectedSubcontractorVendorId && filteredSubcontractorVendors.length !== 1)}
                  onClick={onAddSubcontractorVendorToProject}
                  type="button"
                >
                  <UserPlus aria-hidden="true" size={18} />
                  Add subcontractor
                </button>
              </div>
              <div className="crew-list">
                {selectedProjectCrewMembers.length === 0 ? (
                  <EmptyState icon={Users} title="No crew assigned">
                    Add crew members or subcontractors to make pay item hour allocation available.
                  </EmptyState>
                ) : (
                  selectedProjectCrewMembers.map((member) => {
                    const memberIsUsed = selectedProject
                      ? crewMemberHasSavedAllocations(member.id, selectedProject.id, entries)
                      : false;

                    return (
                      <div className="crew-list-row" key={member.id}>
                        {editingCrewMember?.crewMemberId === member.id ? (
                          <div className="crew-edit-form">
                            {editingCrewMember.laborType === "subcontractor" ? (
                              <input
                                aria-label={`Edit company name for ${getCrewDisplayName(member)}`}
                                placeholder="Company name"
                                value={editingCrewMember.subcontractorCompany}
                                onChange={(event) => onUpdateEditingCrewMember("subcontractorCompany", event.target.value)}
                              />
                            ) : (
                              <>
                                <input
                                  aria-label={`Edit name for ${getCrewDisplayName(member)}`}
                                  value={editingCrewMember.name}
                                  onChange={(event) => onUpdateEditingCrewMember("name", event.target.value)}
                                />
                                <input
                                  aria-label={`Edit job title for ${getCrewDisplayName(member)}`}
                                  value={editingCrewMember.jobTitle}
                                  onChange={(event) => onUpdateEditingCrewMember("jobTitle", event.target.value)}
                                />
                                <select
                                  aria-label={`Edit temp employee status for ${getCrewDisplayName(member)}`}
                                  value={editingCrewMember.laborType === "temp_employee" ? "yes" : "no"}
                                  onChange={(event) =>
                                    onUpdateEditingCrewMember(
                                      "laborType",
                                      event.target.value === "yes" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE
                                    )
                                  }
                                >
                                  <option value="no">Temp Employee? No</option>
                                  <option value="yes">Temp Employee? Yes</option>
                                </select>
                              </>
                            )}
                            <div className="crew-edit-actions">
                              <button className="secondary-button" onClick={onSaveEditedCrewMember} type="button">
                                Save
                              </button>
                              <button className="icon-button" onClick={onCancelEditingCrewMember} type="button">
                                <X aria-hidden="true" size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span>
                              <strong>{getCrewDisplayName(member)}</strong>
                              {formatCrewMemberMeta(member)}
                            </span>
                            <div className="crew-row-actions">
                              <button
                                aria-label={`Edit ${getCrewDisplayName(member)}`}
                                className="icon-button"
                                onClick={() => onStartEditingCrewMember(member)}
                                type="button"
                              >
                                <Edit3 aria-hidden="true" size={16} />
                              </button>
                              <button
                                aria-label={`Remove ${getCrewDisplayName(member)}`}
                                className="icon-button"
                                disabled={memberIsUsed}
                                onClick={() => onRemoveCrewMember(member.id)}
                                title={
                                  memberIsUsed
                                    ? "This crew member is already assigned to saved pay item hours."
                                    : undefined
                                }
                                type="button"
                              >
                                <Trash2 aria-hidden="true" size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {currentUser.role === "admin" ? (
                <div className="admin-crew-merge">
                  <div className="admin-crew-merge-heading">
                    <strong>Admin Crew Merge</strong>
                    <span>Use this when the same person was created twice because of spelling or nickname differences.</span>
                  </div>
                  <div className="field-group">
                    <label htmlFor="merge-source-crew-member">Duplicate Crew Member</label>
                    <select
                      id="merge-source-crew-member"
                      disabled={crewDirectory.length < 2}
                      value={mergeSourceCrewMemberId}
                      onChange={(event) => onSetMergeSourceCrewMemberId(event.target.value)}
                    >
                      <option value="">Select duplicate</option>
                      {sortCrewMembersByName(crewDirectory).map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatCrewMemberOption(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="merge-target-crew-member">Keep Crew Member</label>
                    <select
                      id="merge-target-crew-member"
                      disabled={crewDirectory.length < 2}
                      value={mergeTargetCrewMemberId}
                      onChange={(event) => onSetMergeTargetCrewMemberId(event.target.value)}
                    >
                      <option value="">Select crew member to keep</option>
                      {sortCrewMembersByName(crewDirectory).map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatCrewMemberOption(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={
                      crewDirectory.length < 2 ||
                      !mergeSourceCrewMemberId ||
                      !mergeTargetCrewMemberId ||
                      mergeSourceCrewMemberId === mergeTargetCrewMemberId
                    }
                    onClick={onMergeCrewMembers}
                    type="button"
                  >
                    Merge crew members
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {adminTools}
      </div>
    </aside>
  );
}
