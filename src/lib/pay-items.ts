export function splitCostCodeDisplay(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (!normalizedValue) {
    return {
      code: "",
      name: ""
    };
  }

  const match = normalizedValue.match(/^([A-Za-z0-9][A-Za-z0-9.\-]*)\s*(?:-\s*)?(.*)$/);
  const rawCode = match?.[1]?.trim() ?? normalizedValue;
  const rawName = match?.[2]?.trim() ?? "";
  const code = normalizeNumericCostCode(rawCode);

  if (!code) {
    return {
      code: "",
      name: rawName || normalizedValue
    };
  }

  return {
    code,
    name: rawName || code
  };
}

export function normalizeNumericCostCode(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  const firstDigitIndex = normalizedValue.search(/\d/);

  if (firstDigitIndex < 0) {
    return "";
  }

  return normalizedValue.slice(firstDigitIndex).trim();
}
