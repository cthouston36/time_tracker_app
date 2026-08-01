import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";
import {
  addDatabaseCrewMemberToProject,
  mergeDatabaseCrewMembers,
  removeDatabaseCrewMemberFromProject,
  saveDatabaseEntries,
  updateDatabaseCrewMember
} from "@/features/time-allocation/lib/api-client";
import {
  buildCrewDirectoryFromProjects,
  mergeCrewDirectories
} from "@/features/time-allocation/lib/app-state-storage";
import {
  crewMemberHasSavedAllocations,
  DEFAULT_CREW_LABOR_TYPE,
  getCrewDisplayName,
  getCrewLaborType,
  getNetSuiteVendorCrewMemberId,
  mergeDraftCrewMembers,
  mergeEntryCrewAllocations,
  mergeProjectCrewMembers,
  normalizeCrewName,
  projectHasCrewMember,
  sortCrewMembersByName
} from "@/features/time-allocation/lib/crew-entry-helpers";
import type {
  CrewMember,
  CrewMembersByProject,
  DraftsByPayItem,
  NetSuiteVendor
} from "@/features/time-allocation/types";

export type EditingCrewMember = {
  crewMemberId: string;
  laborType: CrewLaborType;
  name: string;
  jobTitle: string;
  subcontractorCompany: string;
};

export function useCrewManagement({
  clearSubcontractorVendorSelection,
  currentUser,
  entries,
  filteredSubcontractorVendors,
  selectedProject,
  selectedSubcontractorVendor,
  setDraftsByPayItem,
  setEntries,
  setEntryNotice
}: {
  clearSubcontractorVendorSelection: () => void;
  currentUser: AuthUser | null;
  entries: AllocationEntry[];
  filteredSubcontractorVendors: NetSuiteVendor[];
  selectedProject: Project | undefined;
  selectedSubcontractorVendor: NetSuiteVendor | null;
  setDraftsByPayItem: Dispatch<SetStateAction<DraftsByPayItem>>;
  setEntries: Dispatch<SetStateAction<AllocationEntry[]>>;
  setEntryNotice: (message: string) => void;
}) {
  const [crewDirectory, setCrewDirectory] = useState<CrewMember[]>([]);
  const [crewMembersByProject, setCrewMembersByProject] = useState<CrewMembersByProject>({});
  const [crewMemberName, setCrewMemberName] = useState("");
  const [crewMemberJobTitle, setCrewMemberJobTitle] = useState("");
  const [crewMemberLaborType, setCrewMemberLaborType] = useState<CrewLaborType>(DEFAULT_CREW_LABOR_TYPE);
  const [selectedExistingCrewMemberId, setSelectedExistingCrewMemberId] = useState("");
  const [mergeSourceCrewMemberId, setMergeSourceCrewMemberId] = useState("");
  const [mergeTargetCrewMemberId, setMergeTargetCrewMemberId] = useState("");
  const [editingCrewMember, setEditingCrewMember] = useState<EditingCrewMember | null>(null);

  const selectedProjectCrewMembers = useMemo(
    () => (selectedProject ? sortCrewMembersByName(crewMembersByProject[selectedProject.id] ?? []) : []),
    [crewMembersByProject, selectedProject]
  );
  const existingCrewMemberOptions = useMemo(
    () =>
      selectedProject
        ? crewDirectory.filter((member) => !projectHasCrewMember(selectedProjectCrewMembers, member.id))
        : [],
    [crewDirectory, selectedProject, selectedProjectCrewMembers]
  );

  const clearCrewForms = useCallback(() => {
    setEditingCrewMember(null);
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    clearSubcontractorVendorSelection();
    setSelectedExistingCrewMemberId("");
  }, [clearSubcontractorVendorSelection]);

  const cancelEditingCrewMember = useCallback(() => {
    setEditingCrewMember(null);
  }, []);

  const replaceCrewData = useCallback((nextCrewDirectory: CrewMember[], nextCrewMembersByProject: CrewMembersByProject) => {
    setCrewMembersByProject(nextCrewMembersByProject);
    setCrewDirectory(
      mergeCrewDirectories(
        nextCrewDirectory,
        buildCrewDirectoryFromProjects(nextCrewMembersByProject)
      )
    );
  }, []);

  const resetCrewManagementState = useCallback(() => {
    setCrewDirectory([]);
    setCrewMembersByProject({});
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    clearSubcontractorVendorSelection();
    setSelectedExistingCrewMemberId("");
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId("");
    setEditingCrewMember(null);
  }, [clearSubcontractorVendorSelection]);

  const updateEditingCrewMember = useCallback(<Field extends keyof Omit<EditingCrewMember, "crewMemberId">>(
    field: Field,
    value: EditingCrewMember[Field]
  ) => {
    setEditingCrewMember((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const addCrewMember = useCallback(() => {
    if (!selectedProject) {
      return;
    }

    const name = crewMemberName.trim();
    const jobTitle = crewMemberJobTitle.trim();
    const laborType = crewMemberLaborType === "temp_employee" ? "temp_employee" : DEFAULT_CREW_LABOR_TYPE;

    if (!name || !jobTitle) {
      setEntryNotice("Enter both crew member name and job title.");
      return;
    }

    const matchingCrewMember = crewDirectory.find((member) => normalizeCrewName(member.name) === normalizeCrewName(name));

    if (matchingCrewMember) {
      setEntryNotice(`A crew member named ${matchingCrewMember.name} already exists. Select them from existing crew instead.`);
      return;
    }

    const crewMember: CrewMember = {
      id: crypto.randomUUID(),
      laborType,
      name,
      jobTitle
    };

    setCrewDirectory((current) => sortCrewMembersByName([...current, crewMember]));
    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: [
        ...(current[selectedProject.id] ?? []),
        crewMember
      ]
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member added locally, but did not sync.");
    });
    setCrewMemberName("");
    setCrewMemberJobTitle("");
    setCrewMemberLaborType(DEFAULT_CREW_LABOR_TYPE);
    clearSubcontractorVendorSelection();
    setSelectedExistingCrewMemberId("");
    setEditingCrewMember(null);
    setEntryNotice(`${name} added to ${selectedProject.name}.`);
  }, [
    clearSubcontractorVendorSelection,
    crewDirectory,
    crewMemberJobTitle,
    crewMemberLaborType,
    crewMemberName,
    selectedProject,
    setEntryNotice
  ]);

  const addSubcontractorVendorToProject = useCallback(() => {
    if (!selectedProject) {
      return;
    }

    const vendor =
      selectedSubcontractorVendor ??
      (filteredSubcontractorVendors.length === 1 ? filteredSubcontractorVendors[0] : null);

    if (!vendor) {
      setEntryNotice("Select a NetSuite vendor to add as a subcontractor.");
      return;
    }

    const companyName = vendor.name.trim();
    const vendorCrewMemberId = getNetSuiteVendorCrewMemberId(vendor.id);
    const matchingSubcontractor = crewDirectory.find(
      (member) =>
        getCrewLaborType(member) === "subcontractor" &&
        (member.id === vendorCrewMemberId ||
          member.netSuiteVendorId === vendor.id ||
          normalizeCrewName(getCrewDisplayName(member)) === normalizeCrewName(companyName))
    );

    const crewMember: CrewMember = {
      ...(matchingSubcontractor ?? {}),
      id: matchingSubcontractor?.id ?? vendorCrewMemberId,
      laborType: "subcontractor",
      name: companyName,
      jobTitle: "Subcontractor",
      netSuiteVendorEntityId: vendor.entityId,
      netSuiteVendorId: vendor.id,
      subcontractorCompany: companyName
    };

    const alreadyOnProject = projectHasCrewMember(selectedProjectCrewMembers, crewMember.id);

    setCrewDirectory((current) =>
      sortCrewMembersByName(
        current.some((member) => member.id === crewMember.id)
          ? current.map((member) => (member.id === crewMember.id ? crewMember : member))
          : [...current, crewMember]
      )
    );
    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: alreadyOnProject
        ? sortCrewMembersByName(
            (current[selectedProject.id] ?? []).map((member) => (member.id === crewMember.id ? crewMember : member))
          )
        : sortCrewMembersByName([...(current[selectedProject.id] ?? []), crewMember])
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Subcontractor added locally, but did not sync.");
    });
    clearSubcontractorVendorSelection();
    setSelectedExistingCrewMemberId("");
    setEditingCrewMember(null);
    setEntryNotice(
      alreadyOnProject ? `${companyName} is already saved to this job.` : `${companyName} added to ${selectedProject.name}.`
    );
  }, [
    clearSubcontractorVendorSelection,
    crewDirectory,
    filteredSubcontractorVendors,
    selectedProject,
    selectedProjectCrewMembers,
    selectedSubcontractorVendor,
    setEntryNotice
  ]);

  const addExistingCrewMemberToProject = useCallback(() => {
    if (!selectedProject || !selectedExistingCrewMemberId) {
      return;
    }

    const crewMember = crewDirectory.find((member) => member.id === selectedExistingCrewMemberId);

    if (!crewMember) {
      setEntryNotice("Select an existing crew member to add.");
      return;
    }

    if (projectHasCrewMember(selectedProjectCrewMembers, crewMember.id)) {
      setEntryNotice(`${getCrewDisplayName(crewMember)} is already saved to this job.`);
      return;
    }

    setCrewMembersByProject((current) => ({
      ...current,
      [selectedProject.id]: sortCrewMembersByName([...(current[selectedProject.id] ?? []), crewMember])
    }));
    void addDatabaseCrewMemberToProject(selectedProject.id, crewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member added locally, but did not sync.");
    });
    setSelectedExistingCrewMemberId("");
    setEntryNotice(`${getCrewDisplayName(crewMember)} added to ${selectedProject.name}.`);
  }, [
    crewDirectory,
    selectedExistingCrewMemberId,
    selectedProject,
    selectedProjectCrewMembers,
    setEntryNotice
  ]);

  const startEditingCrewMember = useCallback((member: CrewMember) => {
    setEntryNotice("");
    const laborType = getCrewLaborType(member);
    const displayName = getCrewDisplayName(member);

    setEditingCrewMember({
      crewMemberId: member.id,
      laborType,
      name: displayName,
      jobTitle: laborType === "subcontractor" ? "Subcontractor" : member.jobTitle,
      subcontractorCompany: laborType === "subcontractor" ? displayName : ""
    });
  }, [setEntryNotice]);

  const saveEditedCrewMember = useCallback(() => {
    if (!selectedProject || !editingCrewMember) {
      return;
    }

    const laborType = editingCrewMember.laborType;
    const subcontractorCompany = laborType === "subcontractor" ? editingCrewMember.subcontractorCompany.trim() : "";
    const name = laborType === "subcontractor" ? subcontractorCompany : editingCrewMember.name.trim();
    const jobTitle = laborType === "subcontractor" ? "Subcontractor" : editingCrewMember.jobTitle.trim();

    if (!name || !jobTitle) {
      setEntryNotice(laborType === "subcontractor" ? "Enter the subcontractor company name." : "Enter both crew member name and job title.");
      return;
    }

    const matchingCrewMember = crewDirectory.find(
      (member) =>
        member.id !== editingCrewMember.crewMemberId &&
        normalizeCrewName(getCrewDisplayName(member)) === normalizeCrewName(name)
    );

    if (matchingCrewMember) {
      setEntryNotice(`A crew member or subcontractor named ${getCrewDisplayName(matchingCrewMember)} already exists. Use that existing record instead.`);
      return;
    }

    setCrewDirectory((current) =>
      sortCrewMembersByName(
        current.map((member) =>
          member.id === editingCrewMember.crewMemberId
            ? {
                ...member,
                laborType,
                name,
                jobTitle,
                subcontractorCompany: subcontractorCompany || undefined
              }
            : member
        )
      )
    );
    setCrewMembersByProject((current) =>
      Object.fromEntries(
        Object.entries(current).map(([projectId, crewMembers]) => [
          projectId,
          sortCrewMembersByName(
            crewMembers.map((member) =>
              member.id === editingCrewMember.crewMemberId
                ? {
                    ...member,
                    laborType,
                    name,
                    jobTitle,
                    subcontractorCompany: subcontractorCompany || undefined
                  }
                : member
            )
          )
        ])
      ) as CrewMembersByProject
    );
    const originalCrewMember = crewDirectory.find((member) => member.id === editingCrewMember.crewMemberId);
    const updatedCrewMember: CrewMember = {
      ...(originalCrewMember ?? {}),
      id: editingCrewMember.crewMemberId,
      laborType,
      name,
      jobTitle,
      subcontractorCompany: subcontractorCompany || undefined
    };
    const nextEntries = entries.map((entry) => {
      if (!entry.crewAllocations?.length) {
        return entry;
      }

      let entryChanged = false;
      const crewAllocations = entry.crewAllocations.map((allocation) => {
        if (allocation.crewMemberId !== editingCrewMember.crewMemberId) {
          return allocation;
        }

        entryChanged = true;
        return {
          ...allocation,
          crewMemberName: name,
          jobTitle,
          laborType,
          subcontractorCompany: subcontractorCompany || undefined
        };
      });

      if (!entryChanged) {
        return entry;
      }

      return {
        ...entry,
        crewAllocations
      };
    });
    const changedEntries = nextEntries.filter((entry, index) => entry !== entries[index]);

    setEntries(nextEntries);
    void updateDatabaseCrewMember(updatedCrewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew member updated locally, but did not sync.");
    });
    if (changedEntries.length > 0) {
      void saveDatabaseEntries(changedEntries).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Crew member updated locally, but saved entry rows did not sync.");
      });
    }
    setEditingCrewMember(null);
    setEntryNotice(`${name} updated across saved days.`);
  }, [crewDirectory, editingCrewMember, entries, selectedProject, setEntries, setEntryNotice]);

  const removeCrewMember = useCallback(
    (crewMemberId: string) => {
      if (!selectedProject) {
        return;
      }

      if (crewMemberHasSavedAllocations(crewMemberId, selectedProject.id, entries)) {
        setEntryNotice("Crew member is already assigned to saved pay item hours and cannot be deleted.");
        return;
      }

      setCrewMembersByProject((current) => ({
        ...current,
        [selectedProject.id]: (current[selectedProject.id] ?? []).filter((member) => member.id !== crewMemberId)
      }));
      void removeDatabaseCrewMemberFromProject(selectedProject.id, crewMemberId).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Crew member removed locally, but did not sync.");
      });
      setDraftsByPayItem((current) =>
        Object.fromEntries(
          Object.entries(current).map(([payItemId, draft]) => [
            payItemId,
            {
              ...draft,
              crewMemberIds: draft.crewMemberIds.filter((id) => id !== crewMemberId),
              crewHours: Object.fromEntries(
                Object.entries(draft.crewHours).filter(([id]) => id !== crewMemberId)
              )
            }
          ])
        )
      );
      setEditingCrewMember((current) => (current?.crewMemberId === crewMemberId ? null : current));
    },
    [entries, selectedProject, setDraftsByPayItem, setEntryNotice]
  );

  const mergeCrewMembers = useCallback(() => {
    if (currentUser?.role !== "admin") {
      return;
    }

    const sourceCrewMember = crewDirectory.find((member) => member.id === mergeSourceCrewMemberId);
    const targetCrewMember = crewDirectory.find((member) => member.id === mergeTargetCrewMemberId);

    if (!sourceCrewMember || !targetCrewMember) {
      setEntryNotice("Select both crew members before merging.");
      return;
    }

    if (sourceCrewMember.id === targetCrewMember.id) {
      setEntryNotice("Select two different crew members before merging.");
      return;
    }

    const confirmed = window.confirm(
      `Merge ${getCrewDisplayName(sourceCrewMember)} into ${getCrewDisplayName(targetCrewMember)}? This updates saved entries, reports, project crew lists, and draft allocations.`
    );

    if (!confirmed) {
      return;
    }

    const nextEntries = entries.map((entry) => mergeEntryCrewAllocations(entry, sourceCrewMember.id, targetCrewMember));
    const changedEntries = nextEntries.filter((entry, index) => entry !== entries[index]);

    setCrewDirectory((current) => current.filter((member) => member.id !== sourceCrewMember.id));
    setCrewMembersByProject((current) => mergeProjectCrewMembers(current, sourceCrewMember.id, targetCrewMember));
    setEntries(nextEntries);
    void mergeDatabaseCrewMembers(sourceCrewMember.id, targetCrewMember).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Crew members merged locally, but crew records did not sync.");
    });
    if (changedEntries.length > 0) {
      void saveDatabaseEntries(changedEntries).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Crew members merged locally, but saved entry rows did not sync.");
      });
    }
    setDraftsByPayItem((current) => mergeDraftCrewMembers(current, sourceCrewMember.id, targetCrewMember.id));
    setSelectedExistingCrewMemberId((current) => (current === sourceCrewMember.id ? "" : current));
    setEditingCrewMember((current) => (current?.crewMemberId === sourceCrewMember.id ? null : current));
    setMergeSourceCrewMemberId("");
    setMergeTargetCrewMemberId(targetCrewMember.id);
    setEntryNotice(`${getCrewDisplayName(sourceCrewMember)} merged into ${getCrewDisplayName(targetCrewMember)}.`);
  }, [
    crewDirectory,
    currentUser?.role,
    entries,
    mergeSourceCrewMemberId,
    mergeTargetCrewMemberId,
    setDraftsByPayItem,
    setEntries,
    setEntryNotice
  ]);

  return {
    addCrewMember,
    addExistingCrewMemberToProject,
    addSubcontractorVendorToProject,
    cancelEditingCrewMember,
    clearCrewForms,
    crewDirectory,
    crewMemberJobTitle,
    crewMemberLaborType,
    crewMemberName,
    crewMembersByProject,
    editingCrewMember,
    existingCrewMemberOptions,
    mergeCrewMembers,
    mergeSourceCrewMemberId,
    mergeTargetCrewMemberId,
    removeCrewMember,
    replaceCrewData,
    resetCrewManagementState,
    saveEditedCrewMember,
    selectedExistingCrewMemberId,
    selectedProjectCrewMembers,
    setCrewMemberJobTitle,
    setCrewMemberLaborType,
    setCrewMemberName,
    setMergeSourceCrewMemberId,
    setMergeTargetCrewMemberId,
    setSelectedExistingCrewMemberId,
    startEditingCrewMember,
    updateEditingCrewMember
  };
}
