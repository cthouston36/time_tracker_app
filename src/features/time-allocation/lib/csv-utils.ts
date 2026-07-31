export function formatCsvNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return String(Math.round(value * 1000000) / 1000000);
}

export function formatCsvIdentifier(value: string) {
  if (/^\d{12,}$/.test(value)) {
    return `\t${value}`;
  }

  return value;
}

export function escapeCsvCell(value: string) {
  const safeValue = value.trimStart().match(/^[=+\-@]/) ? `'${value}` : value;

  if (/[",\r\n\t]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  return safeValue;
}

export function rowsToCsv(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(",")).join("\r\n");
}
