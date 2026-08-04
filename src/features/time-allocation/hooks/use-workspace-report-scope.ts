import { useMemo } from "react";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { filterDailyReportsByProjectIds } from "@/features/time-allocation/lib/daily-report-helpers";
import type { DailyReportsByKey } from "@/features/time-allocation/types";

type WorkspaceReportScopeOptions = {
  dailyReportsByKey: DailyReportsByKey;
  entries: AllocationEntry[];
  projects: Project[];
};

export function useWorkspaceReportScope({
  dailyReportsByKey,
  entries,
  projects
}: WorkspaceReportScopeOptions) {
  const visibleProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const reportEntries = useMemo(
    () => entries.filter((entry) => visibleProjectIds.has(entry.projectId)),
    [entries, visibleProjectIds]
  );
  const reportDailyReportsByKey = useMemo(
    () => filterDailyReportsByProjectIds(dailyReportsByKey, visibleProjectIds),
    [dailyReportsByKey, visibleProjectIds]
  );

  return {
    reportDailyReportsByKey,
    reportEntries
  };
}
