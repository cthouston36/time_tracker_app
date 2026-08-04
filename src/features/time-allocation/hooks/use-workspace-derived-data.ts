import { useMemo } from "react";
import { getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { getDayKey } from "@/features/time-allocation/lib/date-helpers";
import { buildRemainingQuantitiesByPayItem } from "@/features/time-allocation/lib/pay-item-helpers";
import {
  buildNetSuiteProjectManagerOptions,
  filterActiveProjects,
  getDefaultMyJobIdsForUser
} from "@/features/time-allocation/lib/selectors";
import type {
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  DraftsByPayItem,
  MyJobsByUser,
  ProjectArchiveById,
  ProjectBlacklistById
} from "@/features/time-allocation/types";
import { draftIsSaveable } from "@/features/time-allocation/lib/crew-entry-helpers";

type WorkspaceDerivedDataOptions = {
  allProjects: Project[];
  currentUser: AuthUser | null;
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  draftsByPayItem: DraftsByPayItem;
  entries: AllocationEntry[];
  mobileSelectedPayItemId: string;
  myJobsByUser: MyJobsByUser;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  selectedProjectId: string;
  showOnlyMyProjects: boolean;
  workDate: string;
};

const DEFAULT_DAY_SUBMISSION: DaySubmission = { status: "draft" };
const DEFAULT_DAY_ENTRY_NOTES = { notes: "", inventory: "" };

export function useWorkspaceDerivedData({
  allProjects,
  currentUser,
  dayEntryNotesByKey,
  daySubmissions,
  draftsByPayItem,
  entries,
  mobileSelectedPayItemId,
  myJobsByUser,
  projectArchiveById,
  projectBlacklistById,
  selectedProjectId,
  showOnlyMyProjects,
  workDate
}: WorkspaceDerivedDataOptions) {
  const activeProjects = useMemo(
    () => filterActiveProjects(allProjects, projectBlacklistById, projectArchiveById),
    [allProjects, projectArchiveById, projectBlacklistById]
  );
  const projects = useMemo(
    () =>
      currentUser
        ? getAccessibleProjectsForUser(currentUser, activeProjects, {
            assignedProjectIdsByUser: myJobsByUser
          })
        : [],
    [activeProjects, currentUser, myJobsByUser]
  );
  const visibleProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const netSuiteProjectManagerOptions = useMemo(() => buildNetSuiteProjectManagerOptions(allProjects), [allProjects]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const selectedProjectUsesTwoSeriesDailyReport = isTwoSeriesProject(selectedProject);
  const selectedProjectUsesPayItems = Boolean(selectedProject && !selectedProjectUsesTwoSeriesDailyReport);
  const selectedProjectEntries = useMemo(
    () => entries.filter((entry) => entry.projectId === selectedProject?.id),
    [entries, selectedProject?.id]
  );
  const visibleEntries = useMemo(
    () => selectedProjectEntries.filter((entry) => entry.date === workDate),
    [selectedProjectEntries, workDate]
  );
  const remainingQuantitiesByPayItem = useMemo(
    () =>
      selectedProject
        ? buildRemainingQuantitiesByPayItem(selectedProject.payItems, selectedProjectEntries, workDate)
        : {},
    [selectedProject, selectedProjectEntries, workDate]
  );
  const displayedPayItems = useMemo(() => selectedProject?.payItems ?? [], [selectedProject?.payItems]);
  const mobileSelectedPayItem = useMemo(
    () =>
      displayedPayItems.find((payItem) => payItem.id === mobileSelectedPayItemId) ??
      displayedPayItems[0] ??
      null,
    [displayedPayItems, mobileSelectedPayItemId]
  );
  const currentDaySubmission = selectedProject
    ? daySubmissions[getDayKey(selectedProject.id, workDate)] ?? DEFAULT_DAY_SUBMISSION
    : DEFAULT_DAY_SUBMISSION;
  const dayIsSubmitted = currentDaySubmission.status === "submitted";
  const currentDayEntryNotes = selectedProject
    ? dayEntryNotesByKey[getDayKey(selectedProject.id, workDate)] ?? DEFAULT_DAY_ENTRY_NOTES
    : DEFAULT_DAY_ENTRY_NOTES;
  const currentDayKey = selectedProject ? getDayKey(selectedProject.id, workDate) : "";
  const currentUserAutoMyJobIds = useMemo(
    () => (currentUser ? getDefaultMyJobIdsForUser(currentUser, projects) : []),
    [currentUser, projects]
  );
  const currentUserMyJobIds = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "project_manager") {
      return currentUserAutoMyJobIds;
    }

    const savedJobIds = (myJobsByUser[currentUser.id] ?? []).filter((projectId) => visibleProjectIds.has(projectId));
    const combinedJobIds = new Set([...currentUserAutoMyJobIds, ...savedJobIds]);

    return projects.filter((project) => combinedJobIds.has(project.id)).map((project) => project.id);
  }, [currentUser, currentUserAutoMyJobIds, myJobsByUser, projects, visibleProjectIds]);
  const myProjectIdSet = useMemo(() => new Set(currentUserMyJobIds), [currentUserMyJobIds]);
  const jobPickerProjects = useMemo(
    () =>
      showOnlyMyProjects && currentUserMyJobIds.length > 0
        ? projects.filter((project) => myProjectIdSet.has(project.id))
        : projects,
    [currentUserMyJobIds.length, myProjectIdSet, projects, showOnlyMyProjects]
  );
  const draftEntryCount = selectedProject
    ? selectedProject.payItems.filter((item) => draftIsSaveable(draftsByPayItem[item.id])).length
    : 0;

  return {
    currentDayEntryNotes,
    currentDayKey,
    currentDaySubmission,
    currentUserAutoMyJobIds,
    currentUserMyJobIds,
    dayIsSubmitted,
    displayedPayItems,
    draftEntryCount,
    jobPickerProjects,
    mobileSelectedPayItem,
    netSuiteProjectManagerOptions,
    projects,
    remainingQuantitiesByPayItem,
    selectedProject,
    selectedProjectUsesPayItems,
    selectedProjectUsesTwoSeriesDailyReport,
    visibleEntries
  };
}
