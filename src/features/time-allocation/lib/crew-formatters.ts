import {
  DEFAULT_CREW_LABOR_TYPE,
  normalizeCrewLaborType,
  type CrewLaborType
} from "@/lib/domain/types";

export { DEFAULT_CREW_LABOR_TYPE };

export function getCrewLaborType(source: { laborType?: CrewLaborType } | undefined | null): CrewLaborType {
  return normalizeCrewLaborType(source?.laborType);
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
