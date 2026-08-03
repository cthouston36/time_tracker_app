import type { AllocationEntry, Project } from "@/lib/domain/types";
import {
  calculateDailyReportTotalHours,
  createEmptyDailyReportPayItemRows,
  isDailyReportTimeField,
  normalizeDailyReportEmployeeRows,
  normalizeDailyReportItsfmRows,
  normalizeDailyReportPayItemRows,
  normalizeDailyReportTimeInput,
  sanitizeDailyReportTimeInput
} from "@/features/time-allocation/lib/daily-report-helpers";
import type {
  DailyReport,
  DailyReportAnswers,
  DailyReportEmployeeRow,
  DailyReportItsfmRow,
  DailyReportPayItemRow,
  DailyReportTimeField
} from "@/features/time-allocation/types";

export function applyDailyReportFieldChange(
  current: DailyReportAnswers,
  field: keyof DailyReportAnswers,
  value: string
): DailyReportAnswers {
  const updatedDraft = {
    ...current,
    [field]: value
  } as DailyReportAnswers;

  if (field === "quantitiesTurnedIn" && value !== "yes") {
    updatedDraft.inspectorName = "";
    updatedDraft.inspectorQuantityDetails = "";
  }

  if (field === "incidentOccurred" && value !== "yes") {
    updatedDraft.accidentReportFiled = "";
    updatedDraft.incidentDetails = "";
  }

  return updatedDraft;
}

export function applyDailyReportEmployeeRowChange(
  current: DailyReportAnswers,
  rowIndex: number,
  field: keyof DailyReportEmployeeRow,
  value: string | boolean
): DailyReportAnswers {
  return {
    ...current,
    employeeRows: current.employeeRows.map((row, index) => {
      if (index !== rowIndex) {
        return row;
      }

      const updatedRow = {
        ...row,
        [field]: isDailyReportTimeField(field) && typeof value === "string" ? sanitizeDailyReportTimeInput(value) : value
      };

      return {
        ...updatedRow,
        totalHours: isDailyReportTimeField(field) ? calculateDailyReportTotalHours(updatedRow) : updatedRow.totalHours
      };
    })
  };
}

export function applyDailyReportEmployeeTimeNormalization(
  current: DailyReportAnswers,
  rowIndex: number,
  field: DailyReportTimeField
): DailyReportAnswers {
  return {
    ...current,
    employeeRows: current.employeeRows.map((row, index) => {
      if (index !== rowIndex) {
        return row;
      }

      const updatedRow = {
        ...row,
        [field]: normalizeDailyReportTimeInput(row[field])
      };

      return {
        ...updatedRow,
        totalHours: calculateDailyReportTotalHours(updatedRow)
      };
    })
  };
}

export function applyDailyReportPayItemRowChange(
  current: DailyReportAnswers,
  rowIndex: number,
  field: keyof DailyReportPayItemRow,
  value: string
): DailyReportAnswers {
  return {
    ...current,
    payItemRows: current.payItemRows.map((row, index) =>
      index === rowIndex
        ? {
            ...row,
            [field]: value
          }
        : row
    )
  };
}

export function applyDailyReportItsfmRowChange(
  current: DailyReportAnswers,
  itemKey: string,
  field: keyof Omit<DailyReportItsfmRow, "itemKey">,
  value: string
): DailyReportAnswers {
  return {
    ...current,
    itsfmRows: normalizeDailyReportItsfmRows(current.itsfmRows).map((row) =>
      row.itemKey === itemKey
        ? {
            ...row,
            [field]: value
          }
        : row
    )
  };
}

export function buildPreviousDailyReportCrewRows(report: DailyReport) {
  return normalizeDailyReportEmployeeRows(report.employeeRows).map((row) => ({
    ...row,
    totalHours: row.totalHours || calculateDailyReportTotalHours(row)
  }));
}

export function buildDailyReportWorkRowsFromSavedEntries(project: Project, entries: AllocationEntry[]) {
  const sortedEntries = project.payItems.flatMap((payItem) => entries.filter((entry) => entry.payItemId === payItem.id));
  const maxRows = createEmptyDailyReportPayItemRows().length;

  return {
    maxRows,
    payItemRows: normalizeDailyReportPayItemRows(
      sortedEntries.map((entry) => ({
        notes: "",
        payItemId: entry.payItemId,
        quantity: Number.isFinite(entry.quantityCompleted) ? String(entry.quantityCompleted) : ""
      }))
    ),
    sourceEntryCount: sortedEntries.length
  };
}
