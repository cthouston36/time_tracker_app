import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth/types";

const SESSION_COOKIE = "time_tracker_user";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as AuthUser & { name?: string };

    if (parsed.firstName && parsed.lastName) {
      return {
        ...parsed,
        role: parsed.id === "caleb" ? "admin" : parsed.role
      };
    }

    if (parsed.name) {
      const [firstName, ...lastNameParts] = parsed.name.split(" ");

      return {
        id: parsed.id,
        firstName,
        lastName: lastNameParts.join(" ") || "",
        role: parsed.id === "caleb" ? "admin" : parsed.role
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function setCurrentUser(user: AuthUser) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
}

export async function clearCurrentUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
