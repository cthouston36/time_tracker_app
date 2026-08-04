export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readOptionalString(value: unknown) {
  const text = readString(value);
  return text || undefined;
}

export function readStringList(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map(readString).filter(Boolean))) : [];
}

export function readRecordString(record: Record<string, unknown>, key: string) {
  return readString(record[key]);
}

export function readNullableRecordString(record: Record<string, unknown>, key: string) {
  const text = readRecordString(record, key);
  return text || null;
}

export function readOptionalRecordString(record: Record<string, unknown>, key: string) {
  return readOptionalString(record[key]);
}

export function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

export function readNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

export function readOptionalNumber(value: unknown) {
  const numberValue = readNullableNumber(value);
  return numberValue === null ? undefined : numberValue;
}

export function readRecordNumber(record: Record<string, unknown>, key: string) {
  return readNumber(record[key]);
}

export function readNullableRecordNumber(record: Record<string, unknown>, key: string) {
  return readNullableNumber(record[key]);
}

export function readOptionalRecordNumber(record: Record<string, unknown>, key: string) {
  return readOptionalNumber(record[key]);
}
