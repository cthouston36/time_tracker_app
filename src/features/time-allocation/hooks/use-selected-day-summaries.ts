import { useMemo } from "react";
import type { AllocationEntry } from "@/lib/domain/types";
import {
  buildCrewSummary
} from "@/features/time-allocation/lib/crew-entry-helpers";
import { getDailyReportEmployeeTotalHours } from "@/features/time-allocation/lib/daily-report-helpers";
import type { CrewMember, DailyReport } from "@/features/time-allocation/types";

type SelectedDaySummariesOptions = {
  currentDailyReport: DailyReport | null | undefined;
  selectedProjectCrewMembers: CrewMember[];
  selectedProjectUsesPayItems: boolean;
  visibleEntries: AllocationEntry[];
};

export function useSelectedDaySummaries({
  currentDailyReport,
  selectedProjectCrewMembers,
  selectedProjectUsesPayItems,
  visibleEntries
}: SelectedDaySummariesOptions) {
  const crewSummaryRows = useMemo(
    () => buildCrewSummary(visibleEntries, selectedProjectCrewMembers),
    [selectedProjectCrewMembers, visibleEntries]
  );
  const totalHours = useMemo(
    () => visibleEntries.reduce((total, entry) => total + entry.hours, 0),
    [visibleEntries]
  );
  const selectedDayTotalHours = selectedProjectUsesPayItems
    ? totalHours
    : currentDailyReport
      ? getDailyReportEmployeeTotalHours(currentDailyReport.employeeRows)
      : 0;

  return {
    crewSummaryRows,
    selectedDayTotalHours,
    totalHours
  };
}
