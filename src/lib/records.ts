export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readOptionalString(value: unknown) {
  const text = readString(value);
  return text || undefined;
}
