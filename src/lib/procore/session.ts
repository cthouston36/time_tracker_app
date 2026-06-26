import { cookies } from "next/headers";
import type { ProcoreTokenResponse } from "@/lib/procore/oauth";

const ACCESS_TOKEN_COOKIE = "procore_access_token";
const REFRESH_TOKEN_COOKIE = "procore_refresh_token";
const OAUTH_STATE_COOKIE = "procore_oauth_state";

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
