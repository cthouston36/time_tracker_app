import type { AllocationEntry, CrewLaborType, PayItem } from "@/lib/domain/types";
import type { CrewMember, PayItemDraft } from "@/features/time-allocation/types";

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

export function draftQuantityExceedsRemaining(draft: PayItemDraft | undefined, remainingQuantity: number) {
  if (!draft?.quantity) {
    return false;
  }

  const quantity = Number(draft.quantity);

  return Number.isFinite(quantity) && quantity > remainingQuantity + 0.0001;
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

export function getDraftCrewHourStats(draft: PayItemDraft) {
  let hasAnyInput = false;
  let hasInvalid = false;
  let hasMissing = false;
  let hasNonPositive = false;
  let total = 0;

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

export function formatCalculatedHours(value: number) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "-";
}

export function getSelectedCrewMemberIds(draft: PayItemDraft | undefined, savedEntry: AllocationEntry | undefined) {
  return draft?.crewMemberIds ?? savedEntry?.crewAllocations?.map((allocation) => allocation.crewMemberId) ?? [];
}

export function getSelectedCrewHours(draft: PayItemDraft | undefined, savedEntry: AllocationEntry | undefined) {
  if (draft) {
    return draft.crewHours;
  }

  return (
    savedEntry?.crewAllocations?.reduce<Record<string, string>>((hoursByCrewMemberId, allocation) => {
      hoursByCrewMemberId[allocation.crewMemberId] = String(allocation.hours);
      return hoursByCrewMemberId;
    }, {}) ?? {}
  );
}

export function getSelectedCrewMembers(
  selectedCrewMemberIds: string[],
  crewMembers: CrewMember[],
  savedEntry: AllocationEntry | undefined
) {
  return selectedCrewMemberIds.map((crewMemberId) => {
    const currentCrewMember = crewMembers.find((member) => member.id === crewMemberId);
    const savedCrewMember = savedEntry?.crewAllocations?.find((allocation) => allocation.crewMemberId === crewMemberId);

    return {
      id: crewMemberId,
      name: currentCrewMember ? getCrewDisplayName(currentCrewMember) : getCrewDisplayName(savedCrewMember),
      jobTitle: currentCrewMember ? getCrewJobTitle(currentCrewMember) : getCrewJobTitle(savedCrewMember),
      laborType: currentCrewMember ? getCrewLaborType(currentCrewMember) : getCrewLaborType(savedCrewMember),
      subcontractorCompany: currentCrewMember?.subcontractorCompany ?? savedCrewMember?.subcontractorCompany
    };
  });
}

export function getCrewLaborType(source: { laborType?: CrewLaborType } | undefined | null): CrewLaborType {
  if (source?.laborType === "subcontractor" || source?.laborType === "temp_employee") {
    return source.laborType;
  }

  return "chinchor_employee";
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

export function formatPayItemQuantity(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

export function formatPayItemUnitOfMeasure(payItem: Pick<PayItem, "unitOfMeasure"> | null | undefined) {
  return typeof payItem?.unitOfMeasure === "string" ? payItem.unitOfMeasure.toUpperCase() : "";
}
