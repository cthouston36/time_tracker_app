import type { Dispatch, SetStateAction } from "react";
import {
  ChevronDown,
  Edit3,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
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
import type { EditingCrewMember } from "@/features/time-allocation/hooks/use-crew-management";
import type {
  CrewMember,
  NetSuiteVendor
} from "@/features/time-allocation/types";

export function CrewSetupPanel({
  crewDirectory,
  crewMemberJobTitle,
  crewMemberLaborType,
  crewMemberName,
  crewSetupExpanded,
  currentUserRole,
  editingCrewMember,
  entries,
  entryNotice,
  existingCrewMemberOptions,
  filteredSubcontractorVendors,
  loadingNetSuiteVendors,
  mergeSourceCrewMemberId,
  mergeTargetCrewMemberId,
  netSuiteVendors,
  selectedExistingCrewMemberId,
  selectedProject,
  selectedProjectCrewMembers,
  selectedSubcontractorVendorId,
  subcontractorVendorSearch,
  onAddCrewMember,
  onAddExistingCrewMemberToProject,
  onAddSubcontractorVendorToProject,
  onCancelEditingCrewMember,
  onMergeCrewMembers,
  onRemoveCrewMember,
  onSaveEditedCrewMember,
  onSelectSubcontractorVendor,
  onSetCrewMemberJobTitle,
  onSetCrewMemberLaborType,
  onSetCrewMemberName,
  onSetCrewSetupExpanded,
  onSetMergeSourceCrewMemberId,
  onSetMergeTargetCrewMemberId,
  onSetSelectedExistingCrewMemberId,
  onStartEditingCrewMember,
  onUpdateEditingCrewMember,
  onUpdateSubcontractorVendorSearch
}: {
  crewDirectory: CrewMember[];
  crewMemberJobTitle: string;
  crewMemberLaborType: CrewLaborType;
  crewMemberName: string;
  crewSetupExpanded: boolean;
  currentUserRole: AuthUser["role"];
  editingCrewMember: EditingCrewMember | null;
  entries: AllocationEntry[];
  entryNotice: string;
  existingCrewMemberOptions: CrewMember[];
  filteredSubcontractorVendors: NetSuiteVendor[];
  loadingNetSuiteVendors: boolean;
  mergeSourceCrewMemberId: string;
  mergeTargetCrewMemberId: string;
  netSuiteVendors: NetSuiteVendor[];
  selectedExistingCrewMemberId: string;
  selectedProject: Project | undefined;
  selectedProjectCrewMembers: CrewMember[];
  selectedSubcontractorVendorId: string;
  subcontractorVendorSearch: string;
  onAddCrewMember: () => void;
  onAddExistingCrewMemberToProject: () => void;
  onAddSubcontractorVendorToProject: () => void;
  onCancelEditingCrewMember: () => void;
  onMergeCrewMembers: () => void;
  onRemoveCrewMember: (crewMemberId: string) => void;
  onSaveEditedCrewMember: () => void;
  onSelectSubcontractorVendor: (vendor: NetSuiteVendor) => void;
  onSetCrewMemberJobTitle: (jobTitle: string) => void;
  onSetCrewMemberLaborType: (laborType: CrewLaborType) => void;
  onSetCrewMemberName: (name: string) => void;
  onSetCrewSetupExpanded: Dispatch<SetStateAction<boolean>>;
  onSetMergeSourceCrewMemberId: (crewMemberId: string) => void;
  onSetMergeTargetCrewMemberId: (crewMemberId: string) => void;
  onSetSelectedExistingCrewMemberId: (crewMemberId: string) => void;
  onStartEditingCrewMember: (member: CrewMember) => void;
  onUpdateEditingCrewMember: <Field extends keyof Omit<EditingCrewMember, "crewMemberId">>(
    field: Field,
    value: EditingCrewMember[Field]
  ) => void;
  onUpdateSubcontractorVendorSearch: (value: string) => void;
}) {
  return (
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
                          className={
                            selectedSubcontractorVendorId === vendor.id
                              ? "vendor-search-option selected"
                              : "vendor-search-option"
                          }
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
                            onChange={(event) =>
                              onUpdateEditingCrewMember("subcontractorCompany", event.target.value)
                            }
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
          {currentUserRole === "admin" ? (
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
  );
}
