const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
}

export function parseDayKey(dayKey: string) {
  const [projectId, date] = dayKey.split("|");

  if (!projectId || !date) {
    return null;
  }

  return {
    date,
    projectId
  };
}

export function parseIsoDayKey(dayKey: string) {
  const parsedDayKey = parseDayKey(dayKey);

  if (!parsedDayKey || !isIsoDate(parsedDayKey.date)) {
    return null;
  }

  return parsedDayKey;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}
