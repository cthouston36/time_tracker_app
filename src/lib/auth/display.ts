export type UserNameParts = {
  firstName?: string | null;
  id?: string | null;
  lastName?: string | null;
};

export function formatUserName(user: UserNameParts, index?: number): string;
export function formatUserName(user: UserNameParts, options?: { fallbackToId?: boolean }): string;
export function formatUserName(user: UserNameParts, optionsOrIndex: { fallbackToId?: boolean } | number = {}) {
  const options = typeof optionsOrIndex === "number" ? {} : optionsOrIndex;
  const fullName = [user.firstName, user.lastName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");

  if (fullName) {
    return fullName;
  }

  return options.fallbackToId && typeof user.id === "string" ? user.id.trim() : "";
}
