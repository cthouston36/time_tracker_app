import type { AllocationEntry, CrewLaborType, PayItem } from "@/lib/domain/types";
import type {
  CrewMember,
  CrewMembersByProject,
  CrewSummaryRow,
  DraftsByPayItem,
  NetSuiteVendor,
  PayItemDraft
} from "@/features/time-allocation/types";

export const DEFAULT_CREW_LABOR_TYPE: CrewLaborType = "chinchor_employee";

export function sortCrewMembersByName(crewMembers: CrewMember[]) {
  return [...crewMembers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

export function getCrewLaborType(source: { laborType?: CrewLaborType } | undefined | null): CrewLaborType {
  if (source?.laborType === "subcontractor" || source?.laborType === "temp_employee") {
    return source.laborType;
  }

  return DEFAULT_CREW_LABOR_TYPE;
}

export function formatCrewLaborType(value: CrewLaborType | undefined) {
  if (value === "subcontractor") {
    return "Subcontractor";
  }

  if (value === "temp_employee") {
    return "Temp Employee";
  }

  return "Chinchor Employee";
}

export function formatCrewLaborTypeWithCompany(
  source: { laborType?: CrewLaborType; subcontractorCompany?: string } | undefined | null
) {
  const laborType = getCrewLaborType(source);
  const label = formatCrewLaborType(laborType);

  if (laborType === "subcontractor" && source?.subcontractorCompany) {
    return `${label}: ${source.subcontractorCompany}`;
  }

  return label;
}

export function getCrewDisplayName(
  member: { name?: string; crewMemberName?: string; laborType?: CrewLaborType; subcontractorCompany?: string } | undefined | null
) {
  if (getCrewLaborType(member) === "subcontractor") {
    return member?.subcontractorCompany || member?.name || member?.crewMemberName || "Unknown subcontractor";
  }

  return member?.name || member?.crewMemberName || "Unknown crew member";
}

export function getCrewJobTitle(member: { jobTitle?: string; laborType?: CrewLaborType } | undefined | null) {
  return getCrewLaborType(member) === "subcontractor" ? "Subcontractor" : member?.jobTitle || "-";
}

export function formatCrewMemberMeta(member: { jobTitle: string; laborType?: CrewLaborType; subcontractorCompany?: string }) {
  if (getCrewLaborType(member) === "subcontractor") {
    return "Subcontractor";
  }

  return `${member.jobTitle} - ${formatCrewLaborTypeWithCompany(member)}`;
}

export function formatCrewMemberOption(member: CrewMember) {
  return `${getCrewDisplayName(member)} - ${formatCrewMemberMeta(member)}`;
}

export function filterNetSuiteVendors(vendors: NetSuiteVendor[], searchText: string) {
  const normalizedSearchText = normalizeVendorSearchText(searchText);

  if (!normalizedSearchText) {
    return sortNetSuiteVendors(vendors);
  }

  return sortNetSuiteVendors(
    vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.entityId ?? "",
        vendor.companyName ?? "",
        vendor.defaultAddress,
        formatNetSuiteVendorOption(vendor)
      ].some((value) => normalizeVendorSearchText(value).includes(normalizedSearchText))
    )
  );
}

export function sortNetSuiteVendors(vendors: NetSuiteVendor[]) {
  return [...vendors].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
      (left.entityId ?? "").localeCompare(right.entityId ?? "", undefined, { numeric: true, sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
  );
}

export function formatNetSuiteVendorOption(vendor: NetSuiteVendor) {
  return vendor.entityId && vendor.entityId !== vendor.name ? `${vendor.name} (${vendor.entityId})` : vendor.name;
}

export function getNetSuiteVendorCrewMemberId(vendorId: string) {
  return `netsuite-vendor-${vendorId}`;
}

export function normalizeVendorSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeCrewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function projectHasCrewMember(crewMembers: CrewMember[], crewMemberId: string) {
  return crewMembers.some((member) => member.id === crewMemberId);
}

export function mergeProjectCrewMembers(
  crewMembersByProject: CrewMembersByProject,
  sourceCrewMemberId: string,
  targetCrewMember: CrewMember
) {
  return Object.fromEntries(
    Object.entries(crewMembersByProject).map(([projectId, crewMembers]) => {
      const crewMembersById = new Map<string, CrewMember>();

      for (const crewMember of crewMembers) {
        if (crewMember.id === sourceCrewMemberId || crewMember.id === targetCrewMember.id) {
          crewMembersById.set(targetCrewMember.id, targetCrewMember);
        } else {
          crewMembersById.set(crewMember.id, crewMember);
        }
      }

      return [projectId, sortCrewMembersByName(Array.from(crewMembersById.values()))];
    })
  ) as CrewMembersByProject;
}

export function mergeEntryCrewAllocations(
  entry: AllocationEntry,
  sourceCrewMemberId: string,
  targetCrewMember: CrewMember
): AllocationEntry {
  if (!entry.crewAllocations?.length) {
    return entry;
  }

  const mergedAllocations = new Map<string, NonNullable<AllocationEntry["crewAllocations"]>[number]>();
  let changed = false;

  for (const allocation of entry.crewAllocations) {
    const nextAllocation =
      allocation.crewMemberId === sourceCrewMemberId || allocation.crewMemberId === targetCrewMember.id
        ? {
            ...allocation,
            crewMemberId: targetCrewMember.id,
            crewMemberName: getCrewDisplayName(targetCrewMember),
            jobTitle: getCrewJobTitle(targetCrewMember),
            laborType: getCrewLaborType(targetCrewMember),
            subcontractorCompany: targetCrewMember.subcontractorCompany
          }
        : allocation;
    const existingAllocation = mergedAllocations.get(nextAllocation.crewMemberId);

    if (nextAllocation !== allocation) {
      changed = true;
    }

    if (existingAllocation) {
      changed = true;
      mergedAllocations.set(nextAllocation.crewMemberId, {
        ...existingAllocation,
        hours: existingAllocation.hours + nextAllocation.hours
      });
    } else {
      mergedAllocations.set(nextAllocation.crewMemberId, nextAllocation);
    }
  }

  if (!changed) {
    return entry;
  }

  return {
    ...entry,
    crewAllocations: Array.from(mergedAllocations.values())
  };
}

export function mergeDraftCrewMembers(
  draftsByPayItem: DraftsByPayItem,
  sourceCrewMemberId: string,
  targetCrewMemberId: string
) {
  return Object.fromEntries(
    Object.entries(draftsByPayItem).map(([payItemId, draft]) => {
      const draftUsesSourceCrewMember =
        draft.crewMemberIds.includes(sourceCrewMemberId) || draft.crewHours[sourceCrewMemberId] !== undefined;

      if (!draftUsesSourceCrewMember) {
        return [payItemId, draft];
      }

      const nextCrewMemberIds = Array.from(
        new Set(draft.crewMemberIds.map((crewMemberId) => (crewMemberId === sourceCrewMemberId ? targetCrewMemberId : crewMemberId)))
      );
      const nextCrewHours: Record<string, string> = {};

      for (const [crewMemberId, hours] of Object.entries(draft.crewHours)) {
        const nextCrewMemberId = crewMemberId === sourceCrewMemberId ? targetCrewMemberId : crewMemberId;

        nextCrewHours[nextCrewMemberId] =
          nextCrewHours[nextCrewMemberId] === undefined
            ? hours
            : mergeDraftHourValues(nextCrewHours[nextCrewMemberId], hours);
      }

      return [
        payItemId,
        normalizeDraftCrewHours({
          ...draft,
          crewMemberIds: nextCrewMemberIds,
          crewHours: nextCrewHours
        })
      ];
    })
  ) as DraftsByPayItem;
}

function mergeDraftHourValues(firstValue: string, secondValue: string) {
  if (firstValue === "" && secondValue === "") {
    return "";
  }

  if (firstValue === "") {
    return secondValue;
  }

  if (secondValue === "") {
    return firstValue;
  }

  const firstNumber = Number(firstValue);
  const secondNumber = Number(secondValue);

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return String(Math.round((firstNumber + secondNumber) * 100) / 100);
  }

  return firstValue || secondValue;
}

export function crewMemberHasSavedAllocations(crewMemberId: string, projectId: string, entries: AllocationEntry[]) {
  return entries.some(
    (entry) =>
      entry.projectId === projectId &&
      entry.crewAllocations?.some((allocation) => allocation.crewMemberId === crewMemberId)
  );
}

export function getExistingDraft(
  draft: PayItemDraft | undefined,
  payItemId: string,
  visibleEntries: AllocationEntry[]
): PayItemDraft {
  if (draft) {
    return {
      hours: draft.hours ?? "",
      quantity: draft.quantity ?? "",
      crewMemberIds: draft.crewMemberIds ?? [],
      crewHours: draft.crewHours ?? {}
    };
  }

  const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItemId);

  return {
    hours: "",
    quantity: "",
    crewMemberIds: existingEntry?.crewAllocations?.map((allocation) => allocation.crewMemberId) ?? [],
    crewHours:
      existingEntry?.crewAllocations?.reduce<Record<string, string>>((hoursByCrewMemberId, allocation) => {
        hoursByCrewMemberId[allocation.crewMemberId] = String(allocation.hours);
        return hoursByCrewMemberId;
      }, {}) ?? {}
  };
}

export function normalizeDraftCrewHours(draft: PayItemDraft) {
  const crewHours = Object.fromEntries(
    Object.entries(draft.crewHours).filter(([crewMemberId]) => draft.crewMemberIds.includes(crewMemberId))
  );
  const nextDraft: PayItemDraft = {
    ...draft,
    crewHours
  };
  const hourStats = getDraftCrewHourStats(nextDraft);

  return {
    ...nextDraft,
    hours: hourStats.hasAnyInput && !hourStats.hasInvalid ? formatDraftHourValue(hourStats.total) : ""
  };
}

export function splitCrewHoursEvenly(draft: PayItemDraft) {
  const totalHours = getDraftTotalHours(draft);

  if (!Number.isFinite(totalHours) || draft.crewMemberIds.length === 0) {
    return draft;
  }

  const crewHours: Record<string, string> = {};
  const roundedShare = Math.floor((totalHours / draft.crewMemberIds.length) * 100) / 100;
  let allocated = 0;

  draft.crewMemberIds.forEach((crewMemberId, index) => {
    const value = index === draft.crewMemberIds.length - 1 ? totalHours - allocated : roundedShare;
    allocated += value;
    crewHours[crewMemberId] = value.toFixed(2);
  });

  return {
    ...draft,
    hours: formatDraftHourValue(totalHours),
    crewHours
  };
}

function getDraftCrewHourStats(draft: PayItemDraft | undefined) {
  if (!draft) {
    return {
      hasAnyInput: false,
      hasInvalid: false,
      hasMissing: false,
      hasNonPositive: false,
      total: 0
    };
  }

  let total = 0;
  let hasAnyInput = false;
  let hasInvalid = false;
  let hasMissing = false;
  let hasNonPositive = false;

  for (const crewMemberId of draft.crewMemberIds) {
    const value = draft.crewHours[crewMemberId];

    if (value === undefined || value === "") {
      hasMissing = true;
      continue;
    }

    hasAnyInput = true;
    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
      hasInvalid = true;
      continue;
    }

    if (hours <= 0) {
      hasNonPositive = true;
    }

    total += hours;
  }

  return {
    hasAnyInput,
    hasInvalid,
    hasMissing,
    hasNonPositive,
    total
  };
}

export function getDraftTotalHours(draft: PayItemDraft | undefined, savedEntry?: AllocationEntry) {
  if (!draft) {
    return savedEntry?.hours ?? 0;
  }

  const hourStats = getDraftCrewHourStats(draft);

  if (hourStats.hasAnyInput) {
    return hourStats.hasInvalid ? Number.NaN : hourStats.total;
  }

  if (draft.crewMemberIds.length > 0 && draft.hours === "") {
    return 0;
  }

  if (draft.hours !== "") {
    const fallbackHours = Number(draft.hours);

    if (Number.isFinite(fallbackHours) && fallbackHours >= 0) {
      return fallbackHours;
    }
  }

  return savedEntry?.hours ?? 0;
}

function formatDraftHourValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function getCrewAllocationError(draft: PayItemDraft | undefined, crewMembers: CrewMember[]) {
  if (!draft || !draftHasAnyInput(draft)) {
    return "";
  }

  if (crewMembers.length === 0) {
    return "Add at least one crew member before saving hours.";
  }

  if (draft.crewMemberIds.length === 0) {
    return "Select at least one crew member for every row with hours.";
  }

  const selectedCrewMemberIds = new Set(draft.crewMemberIds);

  if (draft.crewMemberIds.some((crewMemberId) => !crewMembers.some((member) => member.id === crewMemberId))) {
    return "One selected crew member is no longer saved to this job.";
  }

  const hourStats = getDraftCrewHourStats(draft);

  if (hourStats.hasMissing || !hourStats.hasAnyInput) {
    return "Enter allocated hours for each selected crew member.";
  }

  if (hourStats.hasInvalid) {
    return "Enter valid allocated hours for each selected crew member.";
  }

  if (hourStats.hasNonPositive) {
    return "Enter allocated hours greater than 0 for each selected crew member.";
  }

  if (Array.from(selectedCrewMemberIds).length !== draft.crewMemberIds.length) {
    return "Remove duplicate crew selections before saving.";
  }

  if (hourStats.total <= 0) {
    return "Allocate more than 0 crew hours before saving.";
  }

  return "";
}

export function buildCrewAllocations(draft: PayItemDraft | undefined, crewMembers: CrewMember[], totalHours: number) {
  if (!draft || totalHours <= 0 || draft.crewMemberIds.length === 0) {
    return [];
  }

  return draft.crewMemberIds.map((crewMemberId) => {
    const crewMember = crewMembers.find((member) => member.id === crewMemberId);
    const hours = Number(draft.crewHours[crewMemberId]);

    return {
      crewMemberId,
      crewMemberName: getCrewDisplayName(crewMember),
      jobTitle: getCrewJobTitle(crewMember),
      laborType: getCrewLaborType(crewMember),
      subcontractorCompany: crewMember?.subcontractorCompany,
      hours
    };
  });
}

export function scaleCrewAllocations(allocations: NonNullable<AllocationEntry["crewAllocations"]>, nextTotalHours: number) {
  if (allocations.length === 0) {
    return [];
  }

  if (allocations.length === 1) {
    return [
      {
        ...allocations[0],
        hours: nextTotalHours
      }
    ];
  }

  const currentTotalHours = allocations.reduce((total, allocation) => total + allocation.hours, 0);

  if (currentTotalHours <= 0) {
    const draft = splitCrewHoursEvenly({
      hours: String(nextTotalHours),
      quantity: "",
      crewMemberIds: allocations.map((allocation) => allocation.crewMemberId),
      crewHours: {}
    });

    return allocations.map((allocation) => ({
      ...allocation,
      hours: Number(draft.crewHours[allocation.crewMemberId] ?? 0)
    }));
  }

  let allocated = 0;

  return allocations.map((allocation, index) => {
    const value =
      index === allocations.length - 1
        ? nextTotalHours - allocated
        : Math.round((allocation.hours / currentTotalHours) * nextTotalHours * 100) / 100;

    allocated += value;

    return {
      ...allocation,
      hours: value
    };
  });
}

export function buildCrewSummary(entries: AllocationEntry[], crewMembers: CrewMember[]) {
  const rows = new Map<string, CrewSummaryRow>();

  for (const entry of entries) {
    if (!entry.crewAllocations?.length) {
      rows.set("unassigned", {
        crewMemberId: "unassigned",
        name: "Unassigned",
        jobTitle: "No crew selected",
        laborType: DEFAULT_CREW_LABOR_TYPE,
        hours: (rows.get("unassigned")?.hours ?? 0) + entry.hours
      });
      continue;
    }

    for (const allocation of entry.crewAllocations) {
      const crewMember = crewMembers.find((member) => member.id === allocation.crewMemberId);
      const row = rows.get(allocation.crewMemberId) ?? {
        crewMemberId: allocation.crewMemberId,
        name: crewMember ? getCrewDisplayName(crewMember) : getCrewDisplayName(allocation),
        jobTitle: crewMember ? getCrewJobTitle(crewMember) : getCrewJobTitle(allocation),
        laborType: crewMember ? getCrewLaborType(crewMember) : getCrewLaborType(allocation),
        subcontractorCompany: crewMember?.subcontractorCompany ?? allocation.subcontractorCompany,
        hours: 0
      };

      row.hours += allocation.hours;
      rows.set(allocation.crewMemberId, row);
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatEntryCrew(entry: AllocationEntry) {
  if (!entry.crewAllocations?.length) {
    return "Crew: Unassigned";
  }

  return `Crew: ${entry.crewAllocations
    .map((allocation) => `${getCrewDisplayName(allocation)} ${allocation.hours.toFixed(2)}h`)
    .join(", ")}`;
}

export function draftIsSaveable(draft: PayItemDraft | undefined) {
  const hasQuantityInput = draft?.quantity !== undefined && draft.quantity !== "";

  if (!draft || !hasQuantityInput) {
    return false;
  }

  const hours = getDraftTotalHours(draft);
  const quantity = Number(draft.quantity);
  const hourStats = getDraftCrewHourStats(draft);

  return (
    hours > 0 &&
    quantity >= 0 &&
    Number.isFinite(hours) &&
    Number.isFinite(quantity) &&
    hourStats.hasAnyInput &&
    !hourStats.hasInvalid &&
    !hourStats.hasMissing &&
    !hourStats.hasNonPositive
  );
}

export function getDraftQuantityOverrunWarnings(
  payItems: PayItem[],
  draftsByPayItem: DraftsByPayItem,
  visibleEntries: AllocationEntry[],
  remainingQuantitiesByPayItem: Record<string, number>
) {
  const warnings: string[] = [];

  for (const payItem of payItems) {
    const draft = draftsByPayItem[payItem.id];

    if (!draftIsSaveable(draft)) {
      continue;
    }

    const existingEntry = visibleEntries.find((entry) => entry.payItemId === payItem.id);
    const quantity = draft?.quantity ? Number(draft.quantity) : existingEntry?.quantityCompleted ?? 0;
    const remainingQuantity = remainingQuantitiesByPayItem[payItem.id] ?? payItem.budgetedQuantity;

    if (Number.isFinite(quantity) && quantity > remainingQuantity + 0.0001) {
      warnings.push(
        `${payItem.code}: ${formatPayItemQuantity(quantity)} entered, ${formatPayItemQuantity(remainingQuantity)} remaining.`
      );
    }
  }

  return warnings;
}

export function buildQuantityOverrunConfirmationDetails(warnings: string[]) {
  const visibleWarnings = warnings.slice(0, 6);
  const hiddenWarningCount = warnings.length - visibleWarnings.length;
  const hiddenWarning =
    hiddenWarningCount > 0 ? `${hiddenWarningCount} more overrun${hiddenWarningCount === 1 ? "" : "s"} not shown.` : "";

  return {
    hiddenWarning,
    visibleWarnings
  };
}

function formatPayItemQuantity(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

export function draftIsIncomplete(draft: PayItemDraft | undefined) {
  if (!draft) {
    return false;
  }

  const hasQuantityInput = draft.quantity !== "";
  const hasCrewInput =
    draft.crewMemberIds.length > 0 ||
    Object.values(draft.crewHours).some((value) => value !== "") ||
    draft.hours !== "";

  if (!hasQuantityInput && !hasCrewInput) {
    return false;
  }

  return !draftIsSaveable(draft);
}

export function draftHasAnyInput(draft: PayItemDraft | undefined) {
  if (!draft) {
    return false;
  }

  return (
    draft.hours !== "" ||
    draft.quantity !== "" ||
    draft.crewMemberIds.length > 0 ||
    Object.values(draft.crewHours).some((value) => value !== "")
  );
}
