import type { AllocationEntry } from "@/lib/domain/types";
import type { DailyReport, DaySubmission } from "@/features/time-allocation/types";
import {
  getDailyReportAnswers,
  normalizeDailyReportAnswersForSave
} from "@/features/time-allocation/lib/daily-report-helpers";

export function buildEntryConflictSignature(entries: AllocationEntry[]) {
  return entries
    .map((entry) => {
      const crewSignature = (entry.crewAllocations ?? [])
        .map((allocation) =>
          [
            allocation.crewMemberId,
            allocation.crewMemberName,
            allocation.jobTitle,
            formatConflictNumber(allocation.hours)
          ].join(":")
        )
        .sort()
        .join(",");

      return [
        entry.id,
        entry.payItemId,
        formatConflictNumber(entry.hours),
        formatConflictNumber(entry.quantityCompleted),
        formatConflictTimestamp(entry.savedAt),
        crewSignature
      ].join("|");
    })
    .sort()
    .join(";");
}

export function buildDaySubmissionConflictSignature(daySubmission: DaySubmission) {
  return [
    daySubmission.status,
    daySubmission.submittedByUserId ?? "",
    daySubmission.submittedByName ?? "",
    daySubmission.submittedAt ?? ""
  ].join("|");
}

export function buildDailyReportConflictSignature(dailyReport: DailyReport | undefined) {
  if (!dailyReport) {
    return "";
  }

  return JSON.stringify({
    updatedAt: dailyReport.updatedAt,
    report: normalizeDailyReportAnswersForSave(getDailyReportAnswers(dailyReport))
  });
}

function formatConflictNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : "";
}

function formatConflictTimestamp(value: string | undefined) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? String(timestamp) : value;
}
