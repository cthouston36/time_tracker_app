import type { AllocationEntry } from "@/lib/domain/types";
import type {
  CrewMember,
  CrewMembersByProject,
  DailyReportUploadsByKey,
  DailyReportsByKey,
  DayEntryNotesByKey,
  DaySubmissionsByKey,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById,
  SharedAppState,
  SyncLogEntry
} from "@/features/time-allocation/types";
import { getCrewLaborType, sortCrewMembersByName } from "@/features/time-allocation/lib/crew-entry-helpers";
import { normalizeSyncLogEntries, readTextValue } from "@/features/time-allocation/lib/selectors";

export function buildCrewDirectoryFromProjects(crewMembersByProject: CrewMembersByProject) {
  const crewMembersById = new Map<string, CrewMember>();

  for (const crewMembers of Object.values(crewMembersByProject)) {
    for (const crewMember of crewMembers) {
      if (!crewMembersById.has(crewMember.id)) {
        crewMembersById.set(crewMember.id, crewMember);
      }
    }
  }

  return sortCrewMembersByName(Array.from(crewMembersById.values()));
}

export function mergeCrewDirectories(primaryCrewMembers: unknown, fallbackCrewMembers: unknown) {
  const crewMembersById = new Map<string, CrewMember>();

  for (const crewMember of [...normalizeCrewMemberList(fallbackCrewMembers), ...normalizeCrewMemberList(primaryCrewMembers)]) {
    crewMembersById.set(crewMember.id, crewMember);
  }

  return sortCrewMembersByName(Array.from(crewMembersById.values()));
}

export function buildSharedAppState(state: SharedAppState): SharedAppState {
  return {
    crewDirectory: sortCrewMembersByName(normalizeCrewMemberList(state.crewDirectory)),
    crewMembersByProject: normalizeCrewMembersByProject(state.crewMembersByProject),
    dailyReportUploadsByKey: normalizeRecord(state.dailyReportUploadsByKey),
    dailyReportsByKey: normalizeRecord(state.dailyReportsByKey),
    dayEntryNotesByKey: normalizeRecord(state.dayEntryNotesByKey),
    daySubmissions: normalizeRecord(state.daySubmissions),
    entries: normalizeAllocationEntryList(state.entries),
    myJobsByUser: normalizeRecord(state.myJobsByUser),
    projectArchiveById: normalizeRecord(state.projectArchiveById),
    projectBlacklistById: normalizeRecord(state.projectBlacklistById),
    syncLog: normalizeSyncLogEntries(state.syncLog)
  };
}

export function normalizeRecord<TRecord extends Record<string, unknown>>(value: unknown): TRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TRecord) : ({} as TRecord);
}

export function normalizeCrewMembersByProject(value: unknown): CrewMembersByProject {
  const crewMembersByProject: CrewMembersByProject = {};

  for (const [projectId, crewMembers] of Object.entries(normalizeRecord<Record<string, unknown>>(value))) {
    const normalizedCrewMembers = normalizeCrewMemberList(crewMembers);

    if (projectId && normalizedCrewMembers.length > 0) {
      crewMembersByProject[projectId] = normalizedCrewMembers;
    }
  }

  return crewMembersByProject;
}

export function normalizeCrewMemberList(value: unknown): CrewMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeCrewMember)
    .filter((crewMember): crewMember is CrewMember => crewMember !== null);
}

function normalizeCrewMember(value: unknown): CrewMember | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const crewMember = value as Partial<CrewMember>;
  const id = readTextValue(crewMember.id);
  const laborType = getCrewLaborType(crewMember);
  const subcontractorCompany = readTextValue(crewMember.subcontractorCompany);
  const name = laborType === "subcontractor"
    ? subcontractorCompany || readTextValue(crewMember.name)
    : readTextValue(crewMember.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    jobTitle: laborType === "subcontractor" ? "Subcontractor" : readTextValue(crewMember.jobTitle),
    laborType,
    name,
    netSuiteVendorEntityId: readTextValue(crewMember.netSuiteVendorEntityId) || undefined,
    netSuiteVendorId: readTextValue(crewMember.netSuiteVendorId) || undefined,
    subcontractorCompany: laborType === "subcontractor" ? name : subcontractorCompany || undefined
  };
}

export function normalizeAllocationEntryList(value: unknown): AllocationEntry[] {
  return Array.isArray(value) ? (value.filter((entry) => entry && typeof entry === "object") as AllocationEntry[]) : [];
}

export function normalizeSharedAppState(state: Partial<SharedAppState> | null | undefined): SharedAppState {
  const crewMembersByProject = normalizeCrewMembersByProject(state?.crewMembersByProject);
  const crewDirectory = mergeCrewDirectories(
    normalizeCrewMemberList(state?.crewDirectory),
    buildCrewDirectoryFromProjects(crewMembersByProject)
  );

  return buildSharedAppState({
    crewDirectory,
    crewMembersByProject,
    dailyReportUploadsByKey: state?.dailyReportUploadsByKey ?? {},
    dailyReportsByKey: state?.dailyReportsByKey ?? {},
    dayEntryNotesByKey: state?.dayEntryNotesByKey ?? {},
    daySubmissions: state?.daySubmissions ?? {},
    entries: state?.entries ?? [],
    myJobsByUser: state?.myJobsByUser ?? {},
    projectArchiveById: state?.projectArchiveById ?? {},
    projectBlacklistById: state?.projectBlacklistById ?? {},
    syncLog: state?.syncLog ?? []
  });
}

export function readLocalSharedAppState(): SharedAppState {
  const crewMembersByProject = normalizeCrewMembersByProject(readLocalJson<unknown>("project-crew-members", {}));
  const crewDirectory = mergeCrewDirectories(
    normalizeCrewMemberList(readLocalJson<unknown>("crew-member-directory", [])),
    buildCrewDirectoryFromProjects(crewMembersByProject)
  );

  return buildSharedAppState({
    crewDirectory,
    crewMembersByProject,
    dailyReportUploadsByKey: readLocalJson<DailyReportUploadsByKey>("daily-report-uploads", {}),
    dailyReportsByKey: readLocalJson<DailyReportsByKey>("daily-reports", {}),
    dayEntryNotesByKey: readLocalJson<DayEntryNotesByKey>("day-entry-notes", {}),
    daySubmissions: readLocalJson<DaySubmissionsByKey>("day-submissions", {}),
    entries: readLocalJson<AllocationEntry[]>("allocation-entries", []),
    myJobsByUser: readLocalJson<MyJobsByUser>("my-jobs-by-user", {}),
    projectArchiveById: readLocalJson<ProjectArchiveById>("project-archive", {}),
    projectBlacklistById: readLocalJson<ProjectBlacklistById>("project-blacklist", {}),
    syncLog: readLocalJson<SyncLogEntry[]>("procore-sync-log", [])
  });
}

export function writeLocalSharedAppState(state: SharedAppState) {
  window.localStorage.setItem("allocation-entries", JSON.stringify(state.entries));
  window.localStorage.setItem("day-submissions", JSON.stringify(state.daySubmissions));
  window.localStorage.setItem("day-entry-notes", JSON.stringify(state.dayEntryNotesByKey));
  window.localStorage.setItem("daily-reports", JSON.stringify(state.dailyReportsByKey));
  window.localStorage.setItem("daily-report-uploads", JSON.stringify(state.dailyReportUploadsByKey));
  window.localStorage.setItem("crew-member-directory", JSON.stringify(state.crewDirectory));
  window.localStorage.setItem("project-crew-members", JSON.stringify(state.crewMembersByProject));
  window.localStorage.setItem("my-jobs-by-user", JSON.stringify(state.myJobsByUser));
  window.localStorage.setItem("project-archive", JSON.stringify(state.projectArchiveById));
  window.localStorage.setItem("project-blacklist", JSON.stringify(state.projectBlacklistById));
  window.localStorage.setItem("procore-sync-log", JSON.stringify(state.syncLog));
}

export function readLocalJson<TValue>(key: string, fallback: TValue): TValue {
  const value = window.localStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return fallback;
  }
}
