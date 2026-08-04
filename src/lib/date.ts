export function todayInputValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseInputDate(value).toLocaleDateString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function formatStatusDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "numeric",
    year: "numeric"
  });
}

export function formatStatusTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function getWeekStart(value: string) {
  const date = parseInputDate(value);

  date.setDate(date.getDate() - date.getDay());

  return formatInputDate(date);
}

export function getWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToInputDate(weekStart, index));
}

export function addDaysToInputDate(value: string, days: number) {
  const date = parseInputDate(value);

  date.setDate(date.getDate() + days);

  return formatInputDate(date);
}

export function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatWeekRange(weekDates: string[]) {
  const start = parseInputDate(weekDates[0]);
  const end = parseInputDate(weekDates[weekDates.length - 1]);

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  )}`;
}

export function formatWeekDayLabel(value: string) {
  return parseInputDate(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric"
  });
}

export function buildDailyReportUploadFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";

  return `${date}_${sanitizeDailyReportFileName(projectNumber)}_Daily_Report.pdf`;
}

function sanitizeDailyReportFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}
