import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { refreshProcoreToken, type ProcoreTokenResponse } from "@/lib/procore/oauth";

const ACCESS_TOKEN_COOKIE = "procore_access_token";
const REFRESH_TOKEN_COOKIE = "procore_refresh_token";
const OAUTH_STATE_COOKIE = "procore_oauth_state";
const PROCORE_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

type StoredProcoreIntegrationToken = {
  accessToken: string;
  connectedAt: string;
  connectedBy?: string;
  expiresAt: number;
  refreshToken?: string;
  tokenType: string;
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
  try {
    const file = await readFile(getProcoreIntegrationTokenPath(), "utf8");
    return JSON.parse(file) as StoredProcoreIntegrationToken;
  } catch {
    return null;
  }
}

async function writeProcoreIntegrationToken(token: StoredProcoreIntegrationToken) {
  const filePath = getProcoreIntegrationTokenPath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(token, null, 2), "utf8");
}

function getProcoreIntegrationTokenPath() {
  return process.env.PROCORE_INTEGRATION_TOKEN_PATH ?? path.join(process.cwd(), ".data", "procore-integration-token.json");
}
