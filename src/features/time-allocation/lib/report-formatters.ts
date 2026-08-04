import type { CrewPerformanceRow } from "@/lib/report-builders";
export { formatCrewLaborType, formatCrewLaborTypeWithCompany } from "@/features/time-allocation/lib/crew-formatters";

export function formatCrewPerformanceStatus(status: CrewPerformanceRow["status"]) {
  if (status === "strong") {
    return "Strong";
  }

  if (status === "review") {
    return "Needs review";
  }

  if (status === "limited") {
    return "Limited data";
  }

  return "At average";
}

export function formatDailyWorkDateRange(firstDate: string, lastDate: string) {
  return firstDate === lastDate
    ? formatReportDate(firstDate)
    : `${formatReportDate(firstDate)} - ${formatReportDate(lastDate)}`;
}

export function formatDailyWorkQuantity(quantity: number, unitOfMeasure: string | undefined) {
  const formattedQuantity = quantity.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: quantity % 1 === 0 ? 0 : 2
  });

  return unitOfMeasure ? `${formattedQuantity} ${unitOfMeasure}` : formattedQuantity;
}

export function formatReportDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseInputDate(value).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

export function formatReportEntryCount(row: { entryCount: number; excludedEntryCount?: number }) {
  return row.excludedEntryCount ? `${row.entryCount} (${row.excludedEntryCount} excluded)` : String(row.entryCount);
}

export function formatVariance(variance: number) {
  const percent = Math.abs(variance * 100);

  if (percent < 0.5) {
    return "At average";
  }

  return `${percent.toFixed(1)}% ${variance < 0 ? "better" : "worse"}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}
