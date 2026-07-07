import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getSql } from "@/lib/db";
import { refreshProcoreToken, type ProcoreTokenResponse } from "@/lib/procore/oauth";

const ACCESS_TOKEN_COOKIE = "procore_access_token";
const REFRESH_TOKEN_COOKIE = "procore_refresh_token";
const OAUTH_STATE_COOKIE = "procore_oauth_state";
const PROCORE_INTEGRATION_TOKEN_SETTING_KEY = "procore_integration_token";
const PROCORE_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
const PROCORE_TOKEN_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const PROCORE_TOKEN_ENCRYPTION_VERSION = 1;

type StoredProcoreIntegrationToken = {
  accessToken: string;
  connectedAt: string;
  connectedBy?: string;
  expiresAt: number;
  refreshToken?: string;
  tokenType: string;
};

type EncryptedProcoreIntegrationToken = {
  algorithm: typeof PROCORE_TOKEN_ENCRYPTION_ALGORITHM;
  authTag: string;
  ciphertext: string;
  encrypted: true;
  iv: string;
  version: typeof PROCORE_TOKEN_ENCRYPTION_VERSION;
};

export async function createOAuthState() {
  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/"
  });

  return state;
}

export async function consumeOAuthState(state: string | null) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  cookieStore.delete(OAUTH_STATE_COOKIE);

  return Boolean(state && expectedState && state === expectedState);
}

export async function saveProcoreTokens(tokenResponse: ProcoreTokenResponse) {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokenResponse.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: tokenResponse.expires_in,
    path: "/"
  });

  if (tokenResponse.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, tokenResponse.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/"
    });
  }
}

export async function getProcoreAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function saveProcoreIntegrationTokens(
  tokenResponse: ProcoreTokenResponse,
  options: {
    connectedAt?: string;
    connectedBy?: string;
    existingRefreshToken?: string;
  } = {}
) {
  const token: StoredProcoreIntegrationToken = {
    accessToken: tokenResponse.access_token,
    connectedAt: options.connectedAt ?? new Date().toISOString(),
    connectedBy: options.connectedBy,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    refreshToken: tokenResponse.refresh_token ?? options.existingRefreshToken,
    tokenType: tokenResponse.token_type
  };

  await writeProcoreIntegrationToken(token);
}

export async function getProcoreIntegrationAccessToken() {
  const token = await readProcoreIntegrationToken();

  if (!token) {
    return null;
  }

  if (token.expiresAt > Date.now() + PROCORE_TOKEN_REFRESH_BUFFER_MS) {
    return token.accessToken;
  }

  if (!token.refreshToken) {
    return null;
  }

  const refreshedToken = await refreshProcoreToken(token.refreshToken);

  await saveProcoreIntegrationTokens(refreshedToken, {
    connectedAt: token.connectedAt,
    connectedBy: token.connectedBy,
    existingRefreshToken: token.refreshToken
  });

  return refreshedToken.access_token;
}

export async function getProcoreIntegrationStatus() {
  const token = await readProcoreIntegrationToken();

  return {
    connected: Boolean(token?.refreshToken || token?.accessToken),
    connectedAt: token?.connectedAt,
    connectedBy: token?.connectedBy,
    expiresAt: token?.expiresAt
  };
}

async function readProcoreIntegrationToken() {
  const sql = getSql();

  if (sql) {
    await ensureAppSettingsTable();

    const rows = await sql`
      select value
      from app_settings
      where key = ${PROCORE_INTEGRATION_TOKEN_SETTING_KEY}
      limit 1
    `;
    const value = rows[0]?.value;

    if (!value) {
      return null;
    }

    const token = parseStoredProcoreIntegrationToken(value);

    if (token && !isEncryptedProcoreIntegrationToken(value) && getProcoreTokenEncryptionKey()) {
      await writeProcoreIntegrationToken(token);
    }

    return token;
  }

  try {
    const file = await readFile(getProcoreIntegrationTokenPath(), "utf8");
    return parseStoredProcoreIntegrationToken(file);
  } catch {
    return null;
  }
}

async function writeProcoreIntegrationToken(token: StoredProcoreIntegrationToken) {
  const sql = getSql();

  if (sql) {
    await ensureAppSettingsTable();
    await sql`
      insert into app_settings (key, value, updated_at)
      values (${PROCORE_INTEGRATION_TOKEN_SETTING_KEY}, ${JSON.stringify(serializeStoredProcoreIntegrationToken(token))}::jsonb, now())
      on conflict (key) do update
      set value = excluded.value,
          updated_at = now()
    `;
    return;
  }

  const filePath = getProcoreIntegrationTokenPath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(serializeStoredProcoreIntegrationToken(token), null, 2), "utf8");
}

async function ensureAppSettingsTable() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
}

function serializeStoredProcoreIntegrationToken(token: StoredProcoreIntegrationToken) {
  const key = getProcoreTokenEncryptionKey();

  if (!key) {
    return token;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(PROCORE_TOKEN_ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final()
  ]);

  return {
    algorithm: PROCORE_TOKEN_ENCRYPTION_ALGORITHM,
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    encrypted: true,
    iv: iv.toString("base64"),
    version: PROCORE_TOKEN_ENCRYPTION_VERSION
  } satisfies EncryptedProcoreIntegrationToken;
}

function parseStoredProcoreIntegrationToken(value: unknown): StoredProcoreIntegrationToken | null {
  if (typeof value === "string") {
    try {
      return parseStoredProcoreIntegrationToken(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (isEncryptedProcoreIntegrationToken(value)) {
    return decryptStoredProcoreIntegrationToken(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  return normalizeStoredProcoreIntegrationToken(value);
}

function decryptStoredProcoreIntegrationToken(value: EncryptedProcoreIntegrationToken) {
  const keys = getProcoreTokenDecryptionKeys();

  if (keys.length === 0) {
    return null;
  }

  for (const key of keys) {
    try {
      const decipher = createDecipheriv(
        PROCORE_TOKEN_ENCRYPTION_ALGORITHM,
        key,
        Buffer.from(value.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, "base64")),
        decipher.final()
      ]).toString("utf8");

      return parseStoredProcoreIntegrationToken(plaintext);
    } catch {
      // Try the next configured key. This supports moving from the client secret fallback
      // to a dedicated token encryption key without forcing an immediate Procore reconnect.
    }
  }

  return null;
}

function normalizeStoredProcoreIntegrationToken(value: Record<string, unknown>) {
  const accessToken = readString(value.accessToken);
  const connectedAt = readString(value.connectedAt);
  const connectedBy = readOptionalString(value.connectedBy);
  const expiresAt = typeof value.expiresAt === "number" ? value.expiresAt : Number(value.expiresAt);
  const refreshToken = readOptionalString(value.refreshToken);
  const tokenType = readString(value.tokenType);

  if (!accessToken || !Number.isFinite(expiresAt) || !tokenType) {
    return null;
  }

  return {
    accessToken,
    connectedAt: connectedAt || new Date(0).toISOString(),
    ...(connectedBy ? { connectedBy } : {}),
    expiresAt,
    ...(refreshToken ? { refreshToken } : {}),
    tokenType
  } satisfies StoredProcoreIntegrationToken;
}

function isEncryptedProcoreIntegrationToken(value: unknown): value is EncryptedProcoreIntegrationToken {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.encrypted === true &&
    value.algorithm === PROCORE_TOKEN_ENCRYPTION_ALGORITHM &&
    value.version === PROCORE_TOKEN_ENCRYPTION_VERSION &&
    typeof value.authTag === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.iv === "string"
  );
}

function getProcoreTokenEncryptionKey() {
  const secret = readOptionalString(process.env.PROCORE_TOKEN_ENCRYPTION_KEY) ?? readOptionalString(process.env.PROCORE_CLIENT_SECRET);

  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function getProcoreTokenDecryptionKeys() {
  return Array.from(
    new Set([
      readOptionalString(process.env.PROCORE_TOKEN_ENCRYPTION_KEY),
      readOptionalString(process.env.PROCORE_CLIENT_SECRET)
    ].filter((secret): secret is string => Boolean(secret)))
  ).map((secret) => createHash("sha256").update(secret).digest());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const normalizedValue = readString(value);
  return normalizedValue || undefined;
}

function getProcoreIntegrationTokenPath() {
  return process.env.PROCORE_INTEGRATION_TOKEN_PATH ?? path.join(process.cwd(), ".data", "procore-integration-token.json");
}
