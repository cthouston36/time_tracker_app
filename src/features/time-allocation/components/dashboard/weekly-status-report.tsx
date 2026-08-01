import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react";
import { EmptyState } from "@/features/time-allocation/components/workspace-primitives";
import { downloadBlob } from "@/features/time-allocation/lib/browser-actions";
import { readApiError, readDownloadFileName } from "@/features/time-allocation/lib/api-client";
import {
  addDaysToInputDate,
  formatWeekDayLabel,
  formatWeekRange,
  getDayKey,
  getWeekDates
} from "@/features/time-allocation/lib/date-helpers";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import {
  buildEntryDayKeySet,
  getDailyReportCalendarStatus,
  getHasDailyEntryActivity,
  getProjectEntryCalendarStatus
} from "@/features/time-allocation/lib/status-helpers";
import type {
  CalendarStatusMode,
  DailyReportUploadsByKey,
  DailyReportsByKey,
  DaySubmissionsByKey
} from "@/features/time-allocation/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";

export function WeeklyStatusReport({
  canExportWeeklyDailyReports,
  dailyReportUploadsByKey,
  dailyReportsByKey,
  daySubmissions,
  entries,
  myJobIds,
  onOpenDay,
  projects,
  selectedProjectIds,
  setSelectedProjectIds,
  setUseMyJobs,
  setWeekStart,
  useMyJobs,
  weekStart
}: {
  canExportWeeklyDailyReports: boolean;
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  myJobIds: string[];
  onOpenDay: (projectId: string, date: string) => void;
  projects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (projectIds: string[]) => void;
  setUseMyJobs: (useMyJobs: boolean) => void;
  setWeekStart: (weekStart: string) => void;
  useMyJobs: boolean;
  weekStart: string;
}) {
  const [calendarStatusMode, setCalendarStatusMode] = useState<CalendarStatusMode>("entry_status");
  const [exportingWeeklyDailyReportsPdf, setExportingWeeklyDailyReportsPdf] = useState(false);
  const [weeklyDailyReportsNotice, setWeeklyDailyReportsNotice] = useState<{ message: string; status: "error" | "success" } | null>(null);
  const sortedProjects = sortProjectsByName(projects);
  const weekDates = getWeekDates(weekStart);
  const activeProjectIds = useMyJobs ? myJobIds : selectedProjectIds;
  const activeProjectIdSet = new Set(activeProjectIds);
  const visibleProjects = sortedProjects.filter((project) => activeProjectIdSet.has(project.id));
  const entryDayKeys = useMemo(() => buildEntryDayKeySet(entries), [entries]);
  const savedDailyReportCount = visibleProjects.reduce(
    (total, project) => total + weekDates.filter((date) => dailyReportsByKey[getDayKey(project.id, date)]).length,
    0
  );
  const selectedLabel = useMyJobs
    ? `My Projects (${myJobIds.length})`
    : selectedProjectIds.length === 0
      ? "Select jobs"
      : `${selectedProjectIds.length} selected`;

  function toggleProject(projectId: string, checked: boolean) {
    const nextSelectedProjectIds = new Set(selectedProjectIds);

    if (checked) {
      nextSelectedProjectIds.add(projectId);
    } else {
      nextSelectedProjectIds.delete(projectId);
    }

    setSelectedProjectIds(
      sortedProjects.filter((project) => nextSelectedProjectIds.has(project.id)).map((project) => project.id)
    );
  }

  async function downloadWeeklyDailyReportsPdf() {
    if (visibleProjects.length === 0) {
      setWeeklyDailyReportsNotice({
        message: "Select one or more projects before exporting weekly daily reports.",
        status: "error"
      });
      return;
    }

    if (savedDailyReportCount === 0) {
      setWeeklyDailyReportsNotice({
        message: "No saved daily reports are available for this week.",
        status: "error"
      });
      return;
    }

    setExportingWeeklyDailyReportsPdf(true);
    setWeeklyDailyReportsNotice(null);

    try {
      const response = await fetch("/api/daily-reports/weekly-pdf", {
        body: JSON.stringify({
          projectIds: visibleProjects.map((project) => project.id),
          weekStart
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export weekly daily reports."));
      }

      const blob = await response.blob();
      const fileName = readDownloadFileName(response.headers) ?? `weekly-daily-reports-${weekStart}.pdf`;

      downloadBlob(blob, fileName);
      setWeeklyDailyReportsNotice({
        message: `Downloaded ${fileName}.`,
        status: "success"
      });
    } catch (error) {
      setWeeklyDailyReportsNotice({
        message: error instanceof Error ? error.message : "Unable to export weekly daily reports.",
        status: "error"
      });
    } finally {
      setExportingWeeklyDailyReportsPdf(false);
    }
  }

  return (
    <div className="weekly-status-report">
      <div className="weekly-status-controls">
        <div className="week-nav">
          <button
            aria-label="Previous week"
            className="icon-button"
            onClick={() => setWeekStart(addDaysToInputDate(weekStart, -7))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div className="week-range">
            <span>Week</span>
            <strong>{formatWeekRange(weekDates)}</strong>
          </div>
          <button
            aria-label="Next week"
            className="icon-button"
            onClick={() => setWeekStart(addDaysToInputDate(weekStart, 7))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        <details className="job-multi-select">
          <summary>
            <span>{selectedLabel}</span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className="job-multi-select-panel">
            <label className="job-checkbox-row emphasized">
              <input
                checked={useMyJobs}
                disabled={myJobIds.length === 0 && !useMyJobs}
                onChange={(event) => setUseMyJobs(event.target.checked)}
                type="checkbox"
              />
              <span>My Projects{myJobIds.length === 0 ? " (none tagged)" : ""}</span>
            </label>
            <div className="job-multi-actions">
              <button
                className="secondary-button"
                disabled={useMyJobs || selectedProjectIds.length === sortedProjects.length}
                onClick={() => setSelectedProjectIds(sortedProjects.map((project) => project.id))}
                type="button"
              >
                Select all
              </button>
              <button
                className="secondary-button"
                disabled={useMyJobs || selectedProjectIds.length === 0}
                onClick={() => setSelectedProjectIds([])}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="job-checkbox-list">
              {sortedProjects.map((project) => (
                <label className="job-checkbox-row" key={project.id}>
                  <input
                    checked={!useMyJobs && selectedProjectIds.includes(project.id)}
                    disabled={useMyJobs}
                    onChange={(event) => toggleProject(project.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
        <div className="calendar-status-toggle" aria-label="Calendar status type">
          <button
            className={calendarStatusMode === "entry_status" ? "active" : ""}
            onClick={() => setCalendarStatusMode("entry_status")}
            type="button"
          >
            Entry Status
          </button>
          <button
            className={calendarStatusMode === "daily_reports" ? "active" : ""}
            onClick={() => setCalendarStatusMode("daily_reports")}
            type="button"
          >
            Daily Reports
          </button>
        </div>
        {canExportWeeklyDailyReports ? (
          <div className="weekly-export-actions">
            <button
              className="primary-button"
              disabled={exportingWeeklyDailyReportsPdf || visibleProjects.length === 0 || savedDailyReportCount === 0}
              onClick={downloadWeeklyDailyReportsPdf}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              {exportingWeeklyDailyReportsPdf
                ? "Exporting..."
                : savedDailyReportCount > 0
                  ? `Export Week PDF (${savedDailyReportCount})`
                  : "Export Week PDF"}
            </button>
          </div>
        ) : null}
      </div>
      {weeklyDailyReportsNotice ? (
        <div className={weeklyDailyReportsNotice.status === "error" ? "inline-alert" : "success-alert"}>
          {weeklyDailyReportsNotice.message}
        </div>
      ) : null}
      {visibleProjects.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No calendar projects selected">
          Select one or more projects, or tag My Projects, to view weekly status.
        </EmptyState>
      ) : (
        <div className="weekly-calendar">
          <div className="weekly-calendar-row weekly-calendar-header">
            <span>Job</span>
            {weekDates.map((date) => (
              <span key={date}>{formatWeekDayLabel(date)}</span>
            ))}
          </div>
          {visibleProjects.map((project) => (
            <div className="weekly-calendar-row" key={project.id}>
              <span className="weekly-calendar-job">{project.name}</span>
              {weekDates.map((date) => {
                const dayKey = getDayKey(project.id, date);
                const hasDailyEntryActivity = getHasDailyEntryActivity(project, dayKey, daySubmissions, entryDayKeys);
                const status =
                  calendarStatusMode === "daily_reports"
                    ? getDailyReportCalendarStatus(
                        dailyReportsByKey[dayKey],
                        dailyReportUploadsByKey[dayKey],
                        hasDailyEntryActivity
                      )
                    : getProjectEntryCalendarStatus(project, daySubmissions[dayKey], entryDayKeys.has(dayKey));

                return (
                  <button
                    aria-label={`Open ${project.name} entry for ${formatWeekDayLabel(date)}. Status: ${status.label}`}
                    className={`status-badge ${status.className}`}
                    data-label={formatWeekDayLabel(date)}
                    key={date}
                    onClick={() => onOpenDay(project.id, date)}
                    type="button"
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
