export function formatRetryAfter(value: string) {
  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return new Date(Date.now() + seconds * 1000).toLocaleTimeString();
  }

  return value;
}
