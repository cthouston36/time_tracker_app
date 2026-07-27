import { constants, randomUUID, sign as signJwt } from "node:crypto";
import { getNetSuiteConfig } from "@/lib/netsuite/config";

const CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const TOKEN_EXPIRY_SECONDS = 300;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type CachedToken = {
  accessToken: string;
  cacheKey: string;
  expiresAtMs: number;
};

type NetSuiteTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

let cachedToken: CachedToken | null = null;

export async function getNetSuiteAccessToken() {
  const config = getNetSuiteConfig();
  const cacheKey = [config.accountId, config.clientId, config.certificateId, config.scopes.join(",")].join("|");

  if (cachedToken && cachedToken.cacheKey === cacheKey && cachedToken.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return cachedToken.accessToken;
  }

  const clientAssertion = createClientAssertion({
    audience: config.tokenEndpoint,
    certificateId: config.certificateId,
    clientId: config.clientId,
    privateKey: config.privateKey,
    scopes: config.scopes
  });
  const body = new URLSearchParams({
    client_assertion: clientAssertion,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    grant_type: "client_credentials"
  });
  const response = await fetch(config.tokenEndpoint, {
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    const details = await response.text();
    const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;

    throw new Error(`NetSuite token request failed: ${message}`);
  }

  const tokenResponse = (await response.json()) as NetSuiteTokenResponse;

  if (!tokenResponse.access_token) {
    throw new Error("NetSuite token response did not include an access token.");
  }

  cachedToken = {
    accessToken: tokenResponse.access_token,
    cacheKey,
    expiresAtMs: Date.now() + Math.max(60, tokenResponse.expires_in ?? 3600) * 1000
  };

  return tokenResponse.access_token;
}

function createClientAssertion({
  audience,
  certificateId,
  clientId,
  privateKey,
  scopes
}: {
  audience: string;
  certificateId: string;
  clientId: string;
  privateKey: string;
  scopes: string[];
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "PS256",
    kid: certificateId,
    typ: "JWT"
  };
  const payload = {
    aud: audience,
    exp: now + TOKEN_EXPIRY_SECONDS,
    iat: now,
    iss: clientId,
    jti: randomUUID(),
    scope: scopes
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

  let signature: Buffer;

  try {
    signature = signJwt("sha256", Buffer.from(signingInput), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown private key parse error.";

    throw new Error(
      [
        "NetSuite private key could not be parsed.",
        "Use the full unencrypted PEM private key, or set NETSUITE_PRIVATE_KEY_B64 to the base64-encoded PEM contents.",
        detail
      ].join(" ")
    );
  }

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}
