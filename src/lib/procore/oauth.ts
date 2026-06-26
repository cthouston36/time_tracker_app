import { getProcoreConfig } from "@/lib/procore/config";

export type ProcoreTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  created_at?: number;
};

export function buildProcoreAuthorizationUrl(state: string) {
  const config = getProcoreConfig();
  const url = new URL("/oauth/authorize", config.authUrl);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return url;
}

export async function exchangeCodeForToken(code: string) {
  const config = getProcoreConfig();
  const response = await fetch(new URL("/oauth/token", config.authUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`Procore token exchange failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ProcoreTokenResponse;
}
