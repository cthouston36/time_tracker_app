import { todayInputValue } from "@/lib/date";
import { getDayKey } from "@/lib/day-key";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import type {
  DayEntryNotes,
  DayEntryNotesByKey,
  DaySubmission,
  DaySubmissionsByKey,
  ProjectBlacklistById
} from "@/features/time-allocation/types";
import { downloadBlob } from "@/features/time-allocation/lib/browser-actions";
import { formatCsvIdentifier, formatCsvNumber, rowsToCsv } from "@/features/time-allocation/lib/csv-utils";
import { formatCrewLaborType, getCrewLaborType } from "@/features/time-allocation/lib/crew-formatters";

export function exportEntriesToCsv({
  dayEntryNotesByKey,
  daySubmissions,
  entries,
  projectBlacklistById,
  projects
}: {
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
}) {
  const headers = [
    "entry_id",
    "project_id",
    "project_name",
    "project_blacklisted",
    "entry_date",
    "day_status",
    "day_notes",
    "day_inventory",
    "submitted_by_user_id",
    "submitted_by_name",
    "submitted_at",
    "pay_item_id",
    "pay_item_code",
    "pay_item_name",
    "pay_item_budgeted_quantity",
    "pay_item_unit_of_measure",
    "entry_total_hours",
    "entry_total_quantity_completed",
    "entry_hours_per_unit",
    "crew_member_id",
    "crew_member_name",
    "crew_job_title",
    "crew_labor_type",
    "subcontractor_company",
    "crew_hours",
    "crew_hour_share_percent",
    "crew_quantity_completed_prorated",
    "crew_hours_per_unit",
    "saved_by_user_id",
    "saved_by_name",
    "saved_at"
  ];
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const rows = entries.flatMap((entry) =>
    buildEntryCsvRows({
      daySubmission: daySubmissions[getDayKey(entry.projectId, entry.date)],
      dayEntryNotes: dayEntryNotesByKey[getDayKey(entry.projectId, entry.date)],
      entry,
      project: projectMap.get(entry.projectId),
      projectBlacklisted: Boolean(projectBlacklistById[entry.projectId])
    })
  );
  const csv = rowsToCsv([headers, ...rows]);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  downloadBlob(blob, `time-allocation-entry-detail-${todayInputValue()}.csv`);
}

function buildEntryCsvRows({
  dayEntryNotes,
  daySubmission,
  entry,
  project,
  projectBlacklisted
}: {
  dayEntryNotes: DayEntryNotes | undefined;
  daySubmission: DaySubmission | undefined;
  entry: AllocationEntry;
  project: Project | undefined;
  projectBlacklisted: boolean;
}) {
  const projectName = entry.projectName ?? project?.name ?? "";
  const baseRow = [
    entry.id,
    formatCsvIdentifier(entry.projectId),
    projectName,
    projectBlacklisted ? "yes" : "no",
    entry.date,
    daySubmission?.status ?? "draft",
    dayEntryNotes?.notes ?? "",
    dayEntryNotes?.inventory ?? "",
    daySubmission?.submittedByUserId ?? "",
    daySubmission?.submittedByName ?? "",
    daySubmission?.submittedAt ?? "",
    formatCsvIdentifier(entry.payItemId),
    entry.payItemCode,
    entry.payItemName,
    formatCsvNumber(entry.payItemBudgetedQuantity),
    entry.payItemUnitOfMeasure ?? "",
    formatCsvNumber(entry.hours),
    formatCsvNumber(entry.quantityCompleted),
    formatCsvNumber(entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : undefined)
  ];
  const allocationTotalHours = entry.crewAllocations?.reduce((total, allocation) => total + allocation.hours, 0) ?? 0;

  if (!entry.crewAllocations?.length) {
    return [
      [
        ...baseRow,
        "unassigned",
        "Unassigned",
        "",
        "",
        "",
        formatCsvNumber(entry.hours),
        "100.00",
        formatCsvNumber(entry.quantityCompleted),
        formatCsvNumber(entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : undefined),
        entry.savedByUserId ?? "",
        entry.savedByName ?? "",
        entry.savedAt ?? ""
      ]
    ];
  }

  return entry.crewAllocations.map((allocation) => {
    const hourShare = allocationTotalHours > 0 ? allocation.hours / allocationTotalHours : 0;
    const proratedQuantity = entry.quantityCompleted * hourShare;

    return [
      ...baseRow,
      allocation.crewMemberId,
      allocation.crewMemberName,
      allocation.jobTitle,
      formatCrewLaborType(getCrewLaborType(allocation)),
      allocation.subcontractorCompany ?? "",
      formatCsvNumber(allocation.hours),
      formatCsvNumber(hourShare * 100),
      formatCsvNumber(proratedQuantity),
      formatCsvNumber(proratedQuantity > 0 ? allocation.hours / proratedQuantity : undefined),
      entry.savedByUserId ?? "",
      entry.savedByName ?? "",
      entry.savedAt ?? ""
    ];
  });
}
