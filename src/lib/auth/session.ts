import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "@/lib/auth/types";

const SESSION_COOKIE = "time_tracker_user";
const SESSION_COOKIE_VERSION = "v1";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  const signedUser = parseSignedSessionValue(value);

  if (signedUser) {
    return signedUser;
  }

  return process.env.NODE_ENV === "production" ? null : parseLegacySessionValue(value);
}

export async function setCurrentUser(user: AuthUser) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, createSignedSessionValue(user), {
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

function createSignedSessionValue(user: AuthUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const signature = signSessionPayload(payload);

  return `${SESSION_COOKIE_VERSION}.${payload}.${signature}`;
}

function parseSignedSessionValue(value: string) {
  const [version, payload, signature] = value.split(".");

  if (version !== SESSION_COOKIE_VERSION || !payload || !signature) {
    return null;
  }

  if (!signatureIsValid(payload, signature)) {
    return null;
  }

  try {
    return normalizeSessionUser(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

function parseLegacySessionValue(value: string) {
  try {
    const parsed = JSON.parse(value) as AuthUser & { name?: string };

    if (parsed.firstName && parsed.lastName) {
      return normalizeSessionUser(parsed);
    }

    if (parsed.name) {
      const [firstName, ...lastNameParts] = parsed.name.split(" ");

      return normalizeSessionUser({
        firstName,
        id: parsed.id,
        lastName: lastNameParts.join(" ") || "",
        role: parsed.role
      });
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeSessionUser(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const user = value as Partial<AuthUser>;

  if (
    typeof user.id !== "string" ||
    typeof user.firstName !== "string" ||
    typeof user.lastName !== "string" ||
    (user.role !== "standard" && user.role !== "project_manager" && user.role !== "admin")
  ) {
    return null;
  }

  return {
    firstName: user.firstName,
    id: user.id,
    lastName: user.lastName,
    role: user.role
  } satisfies AuthUser;
}

function signatureIsValid(payload: string, signature: string) {
  const expectedSignature = signSessionPayload(payload);
  const expected = Buffer.from(expectedSignature, "base64url");
  const actual = Buffer.from(signature, "base64url");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.PROCORE_TOKEN_ENCRYPTION_KEY ??
    process.env.PROCORE_CLIENT_SECRET ??
    "local-development-session-secret"
  );
}
