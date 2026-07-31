import {
  TWO_SERIES_PRODUCTION_CODES,
  type DailyReportTemplate
} from "@/lib/daily-report-templates";
import type { PayItem } from "@/lib/procore/types";
import type {
  DailyReport,
  DailyReportAnswers,
  DailyReportEmployeeRow,
  DailyReportItsfmItem,
  DailyReportItsfmRow,
  DailyReportPayItemRow,
  DailyReportsByKey,
  DailyReportTimeField
} from "@/features/time-allocation/types";

const DAILY_REPORT_VALIDATION_NOTICE_PREFIX = "Daily report needs attention";

export type DailyReportValidationResult = {
  errors: string[];
  warnings: string[];
};

type DailyReportValidationOptions = {
  template: DailyReportTemplate;
};

export const DAILY_REPORT_ITSFM_ITEMS: DailyReportItsfmItem[] = [
  { group: "Aboveground Equipment", key: "cctv-1", label: "CCTV #1" },
  { group: "Aboveground Equipment", key: "cctv-2", label: "CCTV #2" },
  { group: "Aboveground Equipment", key: "cctv-3", label: "CCTV #3" },
  { group: "Aboveground Equipment", key: "cctv-4", label: "CCTV #4" },
  { group: "Aboveground Equipment", key: "cctv-5", label: "CCTV #5" },
  { group: "Aboveground Equipment", key: "cctv-6", label: "CCTV #6" },
  { group: "Aboveground Equipment", key: "preemption-unit-1", label: "#1 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "preemption-unit-2", label: "#2 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "rsu", label: "RSU" },
  { group: "Aboveground Equipment", key: "antenna", label: "Antenna" },
  { group: "Cabinet Equipment", key: "cabinet", label: "Cabinet" },
  { group: "Cabinet Equipment", key: "controller", label: "Controller" },
  { group: "Cabinet Equipment", key: "mmu", label: "MMU" },
  { group: "Cabinet Equipment", key: "biu-1", label: "BIU #1" },
  { group: "Cabinet Equipment", key: "biu-2", label: "BIU #2" },
  { group: "Cabinet Equipment", key: "detection-ccu", label: "Detection CCU" },
  { group: "Cabinet Equipment", key: "rpm", label: "RPM" },
  { group: "Cabinet Equipment", key: "ups", label: "UPS" },
  { group: "Cabinet Equipment", key: "ethernet-switch", label: "Ethernet Switch" },
  { group: "Cabinet Equipment", key: "preemption-card", label: "Preemtion Card" },
  { group: "Cabinet Equipment", key: "misc-1", label: "Misc" },
  { group: "Cabinet Equipment", key: "misc-2", label: "Misc" }
];

export function isDailyReportTimeField(field: keyof DailyReportEmployeeRow): field is DailyReportTimeField {
  return field === "timeIn" || field === "lunchOut" || field === "lunchIn" || field === "timeOut";
}

export function sanitizeDailyReportTimeInput(value: string) {
  const cleaned = value.replace(/[^\d:]/g, "");

  if (!cleaned.includes(":")) {
    return cleaned.slice(0, 4);
  }

  const [hours = "", minutes = ""] = cleaned.split(":");

  return `${hours.slice(0, 2)}:${minutes.slice(0, 2)}`;
}

export function normalizeDailyReportTimeInput(value: string) {
  const cleaned = sanitizeDailyReportTimeInput(value);

  if (!cleaned) {
    return "";
  }

  let hourText = "";
  let minuteText = "";

  if (cleaned.includes(":")) {
    const [hours = "", minutes = ""] = cleaned.split(":");

    hourText = hours;
    minuteText = minutes.padEnd(2, "0").slice(0, 2);
  } else if (cleaned.length <= 2) {
    hourText = cleaned;
    minuteText = "00";
  } else if (cleaned.length === 3) {
    hourText = cleaned.slice(0, 1);
    minuteText = cleaned.slice(1);
  } else {
    hourText = cleaned.slice(0, 2);
    minuteText = cleaned.slice(2);
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "";
  }

  return `${hour}:${String(minute).padStart(2, "0")}`;
}

export function calculateDailyReportTotalHours(row: DailyReportEmployeeRow) {
  const timeIn = parseDailyReportTimeToMinutes(row.timeIn);
  const timeOut = parseDailyReportTimeToMinutes(row.timeOut);

  if (timeIn === null || timeOut === null) {
    return "";
  }

  const workMinutes = calculateDailyReportDurationMinutes(timeIn, timeOut);

  if (workMinutes === null) {
    return "";
  }

  const lunchOut = parseDailyReportTimeToMinutes(row.lunchOut);
  const lunchIn = parseDailyReportTimeToMinutes(row.lunchIn);
  let lunchMinutes = 0;

  if (lunchOut !== null && lunchIn !== null) {
    const calculatedLunchMinutes = calculateDailyReportDurationMinutes(lunchOut, lunchIn);

    if (calculatedLunchMinutes === null) {
      return "";
    }

    lunchMinutes = calculatedLunchMinutes;
  }

  const totalMinutes = workMinutes - lunchMinutes;

  if (totalMinutes < 0 || totalMinutes > 12 * 60) {
    return "";
  }

  return (totalMinutes / 60).toFixed(2);
}

export function createEmptyDailyReportAnswers(): DailyReportAnswers {
  return {
    employeeRows: createEmptyDailyReportEmployeeRows(),
    payItemRows: createEmptyDailyReportPayItemRows(),
    quantitiesTurnedIn: "",
    inspectorName: "",
    inspectorQuantityDetails: "",
    workDescription: "",
    planSheetNumbers: "",
    workDetails: "",
    incidentOccurred: "",
    incidentDetails: "",
    accidentReportFiled: "",
    motSigns: "",
    conesBarrels: "",
    typeIISidewalkBarricades: "",
    typeIIIBarricades: "",
    lcdCount: "",
    lcdFootage: "",
    arrowBoards: "",
    vmsBoards: "",
    fdotIndex: "",
    itsfmRows: createEmptyDailyReportItsfmRows(),
    itsfmAbovegroundEquipment: "",
    itsfmCabinetEquipment: "",
    twoSeriesEquipmentTools: "",
    twoSeriesSafetyIssues: "",
    twoSeriesDelayReasons: "",
    twoSeriesDeliveries: ""
  };
}

export function getDailyReportAnswers(report: DailyReport): DailyReportAnswers {
  return {
    employeeRows: normalizeDailyReportEmployeeRows(report.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(report.payItemRows),
    quantitiesTurnedIn: report.quantitiesTurnedIn ?? "",
    inspectorName: report.inspectorName ?? "",
    inspectorQuantityDetails: report.inspectorQuantityDetails ?? "",
    workDescription: report.workDescription ?? "",
    planSheetNumbers: report.planSheetNumbers ?? "",
    workDetails: report.workDetails ?? "",
    incidentOccurred: report.incidentOccurred ?? "",
    incidentDetails: report.incidentDetails ?? "",
    accidentReportFiled: report.accidentReportFiled ?? "",
    motSigns: report.motSigns ?? "",
    conesBarrels: report.conesBarrels ?? "",
    typeIISidewalkBarricades: report.typeIISidewalkBarricades ?? "",
    typeIIIBarricades: report.typeIIIBarricades ?? "",
    lcdCount: report.lcdCount ?? "",
    lcdFootage: report.lcdFootage ?? "",
    arrowBoards: report.arrowBoards ?? "",
    vmsBoards: report.vmsBoards ?? "",
    fdotIndex: report.fdotIndex ?? "",
    itsfmRows: normalizeDailyReportItsfmRows(report.itsfmRows),
    itsfmAbovegroundEquipment: report.itsfmAbovegroundEquipment ?? "",
    itsfmCabinetEquipment: report.itsfmCabinetEquipment ?? "",
    twoSeriesEquipmentTools: report.twoSeriesEquipmentTools ?? "",
    twoSeriesSafetyIssues: report.twoSeriesSafetyIssues ?? "",
    twoSeriesDelayReasons: report.twoSeriesDelayReasons ?? "",
    twoSeriesDeliveries: report.twoSeriesDeliveries ?? ""
  };
}

export function normalizeDailyReportAnswersForSave(report: DailyReportAnswers): DailyReportAnswers {
  return {
    ...report,
    accidentReportFiled: report.incidentOccurred === "yes" ? report.accidentReportFiled : "",
    incidentDetails: report.incidentOccurred === "yes" ? report.incidentDetails : "",
    inspectorName: report.quantitiesTurnedIn === "yes" ? report.inspectorName : "",
    inspectorQuantityDetails: report.quantitiesTurnedIn === "yes" ? report.inspectorQuantityDetails : "",
    employeeRows: normalizeDailyReportEmployeeRows(report.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(report.payItemRows),
    itsfmRows: normalizeDailyReportItsfmRows(report.itsfmRows)
  };
}

export function normalizeDailyReportDraftAnswers(value: unknown): DailyReportAnswers {
  const draft = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<DailyReportAnswers>) : {};
  const emptyDraft = createEmptyDailyReportAnswers();

  return {
    ...emptyDraft,
    ...draft,
    employeeRows: normalizeDailyReportEmployeeRows(draft.employeeRows),
    payItemRows: normalizeDailyReportPayItemRows(draft.payItemRows),
    itsfmRows: normalizeDailyReportItsfmRows(draft.itsfmRows)
  };
}

export function validateDailyReportAnswers(
  report: DailyReportAnswers,
  payItems: PayItem[],
  options: DailyReportValidationOptions = { template: "standard" }
): DailyReportValidationResult {
  const errors: string[] = [];
  const isTwoSeriesTemplate = options.template === "two-series";
  const payItemIds = new Set(payItems.map((payItem) => payItem.id));
  const employeeRows = normalizeDailyReportEmployeeRows(report.employeeRows);
  const activeEmployeeRows = employeeRows
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => dailyReportEmployeeRowHasContent(row));

  if (activeEmployeeRows.length === 0) {
    errors.push("Add at least one employee time row.");
  }

  for (const { index, row } of activeEmployeeRows) {
    const rowLabel = `Employee row ${index + 1}`;
    const timeFields: Array<{ field: DailyReportTimeField; label: string }> = [
      { field: "timeIn", label: "Time In" },
      { field: "lunchOut", label: "Lunch Out" },
      { field: "lunchIn", label: "Lunch In" },
      { field: "timeOut", label: "Time Out" }
    ];
    const invalidTimeLabels = timeFields
      .filter(({ field }) => row[field].trim() && !normalizeDailyReportTimeInput(row[field]))
      .map(({ label }) => label);
    const missingTimeLabels = timeFields
      .filter(({ field }) => (field === "timeIn" || field === "timeOut") && !row[field].trim())
      .map(({ label }) => label);
    const hasPartialLunch = Boolean(row.lunchOut.trim()) !== Boolean(row.lunchIn.trim());
    const calculatedTotalHours = Number(row.totalHours || calculateDailyReportTotalHours(row));

    if (!row.employeeClassification.trim()) {
      errors.push(`${rowLabel}: enter employee name/classification.`);
    }

    for (const label of missingTimeLabels) {
      errors.push(`${rowLabel}: enter ${label}.`);
    }

    if (invalidTimeLabels.length > 0) {
      errors.push(`${rowLabel}: fix ${invalidTimeLabels.join(", ")} to HH:MM format.`);
    }

    if (hasPartialLunch) {
      errors.push(`${rowLabel}: enter both Lunch Out and Lunch In, or leave both blank.`);
    }

    if (
      missingTimeLabels.length === 0 &&
      invalidTimeLabels.length === 0 &&
      !hasPartialLunch &&
      (!Number.isFinite(calculatedTotalHours) || calculatedTotalHours <= 0)
    ) {
      errors.push(`${rowLabel}: enter valid time values so Total Hours calculates.`);
    }

    if (Number.isFinite(calculatedTotalHours) && calculatedTotalHours > 12) {
      errors.push(`${rowLabel}: Total Hours cannot exceed 12.`);
    }

    if (isTwoSeriesTemplate) {
      validateTwoSeriesProductionAllocation(row, rowLabel, calculatedTotalHours, errors);
    }
  }

  const payItemRows = normalizeDailyReportPayItemRows(report.payItemRows);
  const activePayItemRows = payItemRows
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => dailyReportPayItemRowHasContent(row));

  if (!isTwoSeriesTemplate) {
    if (activePayItemRows.length === 0) {
      errors.push("Add at least one Work Performed pay item row.");
    }

    for (const { index, row } of activePayItemRows) {
      const rowLabel = `Work Performed row ${index + 1}`;
      const quantity = parseDailyReportPositiveNumber(row.quantity);

      if (!row.payItemId.trim()) {
        errors.push(`${rowLabel}: select a pay item.`);
      } else if (!payItemIds.has(row.payItemId)) {
        errors.push(`${rowLabel}: select a valid pay item for this job.`);
      }

      if (!row.quantity.trim()) {
        errors.push(`${rowLabel}: enter quantity.`);
      } else if (quantity === null || quantity <= 0) {
        errors.push(`${rowLabel}: quantity must be greater than 0.`);
      }
    }

    if (!isAnsweredYesNo(report.quantitiesTurnedIn)) {
      errors.push("Answer whether quantities were turned into the inspector.");
    }

    if (report.quantitiesTurnedIn === "yes") {
      if (!report.inspectorName.trim()) {
        errors.push("Enter the inspector name.");
      }

      if (!report.inspectorQuantityDetails.trim()) {
        errors.push("Enter the quantities and items turned into the inspector.");
      }
    }

    if (!isAnsweredYesNo(report.incidentOccurred)) {
      errors.push("Answer whether there were incidents or accidents today.");
    }

    if (report.incidentOccurred === "yes") {
      if (!isAnsweredYesNo(report.accidentReportFiled)) {
        errors.push("Answer whether an accident report was filed.");
      }

      if (!report.incidentDetails.trim()) {
        errors.push("Enter incident / accident details.");
      }
    }
  } else if (!report.workDescription.trim()) {
    errors.push("Enter the detailed description of work completed.");
  }

  return {
    errors,
    warnings: []
  };
}

export function formatDailyReportValidationMessage(errors: string[]) {
  const visibleErrors = errors.slice(0, 6);
  const remainingErrorCount = errors.length - visibleErrors.length;
  const remainingText =
    remainingErrorCount > 0 ? ` ${remainingErrorCount} more item${remainingErrorCount === 1 ? "" : "s"} need attention.` : "";

  return `${DAILY_REPORT_VALIDATION_NOTICE_PREFIX}: ${visibleErrors.join(" ")}${remainingText}`;
}

export function createEmptyDailyReportItsfmRows() {
  return DAILY_REPORT_ITSFM_ITEMS.map((item) => createEmptyDailyReportItsfmRow(item.key));
}

export function createEmptyDailyReportItsfmRow(itemKey: string): DailyReportItsfmRow {
  return {
    itemKey,
    location: "",
    modelNumber: "",
    serialNumber: ""
  };
}

export function normalizeDailyReportItsfmRows(rows: DailyReportItsfmRow[] | undefined) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.itemKey, row]));

  return DAILY_REPORT_ITSFM_ITEMS.map((item) => ({
    ...createEmptyDailyReportItsfmRow(item.key),
    ...(rowsByKey.get(item.key) ?? {})
  }));
}

export function createEmptyDailyReportPayItemRows() {
  return Array.from({ length: 8 }, () => ({
    notes: "",
    payItemId: "",
    quantity: ""
  }));
}

export function normalizeDailyReportPayItemRows(rows: DailyReportPayItemRow[] | undefined) {
  const emptyRows = createEmptyDailyReportPayItemRows();

  return emptyRows.map((emptyRow, index) => ({
    ...emptyRow,
    ...(rows?.[index] ?? {})
  }));
}

export function createEmptyDailyReportEmployeeRows() {
  return Array.from({ length: 10 }, () => ({
    employeeClassification: "",
    truckNumber: "",
    timeIn: "",
    lunchOut: "",
    lunchIn: "",
    timeOut: "",
    productionCode1: "",
    productionHours1: "",
    productionCode2: "",
    productionHours2: "",
    totalHours: "",
    driver: false,
    passenger: false
  }));
}

export function normalizeDailyReportEmployeeRows(rows: DailyReportEmployeeRow[] | undefined) {
  const emptyRows = createEmptyDailyReportEmployeeRows();

  return emptyRows.map((emptyRow, index) => ({
    ...emptyRow,
    ...(rows?.[index] ?? {})
  }));
}

export function findPreviousDailyReportWithCrewTime(dailyReportsByKey: DailyReportsByKey, projectId: string, date: string) {
  const previousReports = Object.values(dailyReportsByKey)
    .filter(
      (report) =>
        report.projectId === projectId &&
        report.date < date &&
        normalizeDailyReportEmployeeRows(report.employeeRows).some(dailyReportEmployeeRowHasContent)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const previousReport = previousReports[0];

  return previousReport
    ? {
        date: previousReport.date,
        report: previousReport
      }
    : null;
}

export function dailyReportEmployeeRowHasContent(row: DailyReportEmployeeRow) {
  return (
    Boolean(row.employeeClassification.trim()) ||
    Boolean(row.truckNumber.trim()) ||
    Boolean(row.timeIn.trim()) ||
    Boolean(row.lunchOut.trim()) ||
    Boolean(row.lunchIn.trim()) ||
    Boolean(row.timeOut.trim()) ||
    Boolean(row.productionCode1.trim()) ||
    Boolean(row.productionHours1.trim()) ||
    Boolean(row.productionCode2.trim()) ||
    Boolean(row.productionHours2.trim()) ||
    Boolean(row.totalHours.trim()) ||
    row.driver ||
    row.passenger
  );
}

export function getDailyReportEmployeeTotalHours(rows: DailyReportEmployeeRow[] | undefined) {
  return normalizeDailyReportEmployeeRows(rows).reduce((total, row) => {
    if (!dailyReportEmployeeRowHasContent(row)) {
      return total;
    }

    const rowHours = Number(row.totalHours || calculateDailyReportTotalHours(row));
    return Number.isFinite(rowHours) ? total + rowHours : total;
  }, 0);
}

export function dailyReportPayItemRowHasContent(row: DailyReportPayItemRow) {
  return Boolean(row.payItemId.trim()) || Boolean(row.quantity.trim()) || Boolean(row.notes.trim());
}

export function formatYesNoAnswer(value: string) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "Not answered";
}

function parseDailyReportTimeToMinutes(value: string) {
  const normalized = normalizeDailyReportTimeInput(value);

  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(":").map(Number);

  return hours * 60 + minutes;
}

function calculateDailyReportDurationMinutes(start: number, end: number) {
  let duration = end - start;

  if (duration < 0) {
    duration += 12 * 60;
  }

  return duration > 12 * 60 ? null : duration;
}

function validateTwoSeriesProductionAllocation(
  row: DailyReportEmployeeRow,
  rowLabel: string,
  totalHours: number,
  errors: string[]
) {
  const productionPairs = [
    {
      code: row.productionCode1.trim(),
      hours: row.productionHours1.trim(),
      label: "first production code"
    },
    {
      code: row.productionCode2.trim(),
      hours: row.productionHours2.trim(),
      label: "second production code"
    }
  ];
  const allowedCodes = new Set(TWO_SERIES_PRODUCTION_CODES.map((productionCode) => productionCode.code));
  let productionHoursTotal = 0;
  let completeProductionPairCount = 0;

  for (const pair of productionPairs) {
    const hasCode = Boolean(pair.code);
    const hasHours = Boolean(pair.hours);
    const parsedHours = parseDailyReportPositiveNumber(pair.hours);

    if (!hasCode && !hasHours) {
      continue;
    }

    if (!hasCode) {
      errors.push(`${rowLabel}: select the ${pair.label}.`);
      continue;
    }

    if (!allowedCodes.has(pair.code)) {
      errors.push(`${rowLabel}: select a valid ${pair.label}.`);
    }

    if (!hasHours) {
      errors.push(`${rowLabel}: enter hours for the ${pair.label}.`);
      continue;
    }

    if (parsedHours === null || parsedHours <= 0) {
      errors.push(`${rowLabel}: production hours must be greater than 0.`);
      continue;
    }

    productionHoursTotal += parsedHours;
    completeProductionPairCount += 1;
  }

  if (completeProductionPairCount === 0) {
    errors.push(`${rowLabel}: add at least one production code and hours.`);
    return;
  }

  if (Number.isFinite(totalHours) && totalHours > 0 && Math.abs(productionHoursTotal - totalHours) > 0.01) {
    errors.push(`${rowLabel}: production hours must equal Total Hours.`);
  }
}

function parseDailyReportPositiveNumber(value: string) {
  const number = Number(value.replaceAll(",", "").trim());

  return Number.isFinite(number) ? number : null;
}

function isAnsweredYesNo(value: string) {
  return value === "yes" || value === "no";
}
