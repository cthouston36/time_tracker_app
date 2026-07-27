export type NetSuiteConfig = {
  accountId: string;
  certificateId: string;
  clientId: string;
  privateKey: string;
  restBaseUrl: string;
  scopes: string[];
  tokenEndpoint: string;
};

const DEFAULT_NETSUITE_SCOPE = "rest_webservices";
const NETSUITE_CONFIG_MARKER = "netsuite-config-v2";

export function getNetSuiteConfig(): NetSuiteConfig {
  const accountId = getRequiredEnv("NETSUITE_ACCOUNT_ID");
  const restBaseUrl =
    process.env.NETSUITE_REST_BASE_URL?.replace(/\/$/, "") ??
    `https://${accountId}.suitetalk.api.netsuite.com/services/rest`;

  return {
    accountId,
    certificateId: getRequiredEnv("NETSUITE_CERTIFICATE_ID"),
    clientId: getRequiredEnv("NETSUITE_CLIENT_ID"),
    privateKey: getPrivateKey(),
    restBaseUrl,
    scopes: readScopes(process.env.NETSUITE_SCOPE),
    tokenEndpoint:
      process.env.NETSUITE_TOKEN_ENDPOINT ??
      `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
  };
}

export function getNetSuiteEnvironmentDiagnostics() {
  const rawPrivateKey = process.env.NETSUITE_PRIVATE_KEY;
  const rawPrivateKeyBase64 = process.env.NETSUITE_PRIVATE_KEY_B64 ?? process.env.NETSUITE_PRIVATE_KEY_BASE64;
  const privateKeySource = rawPrivateKeyBase64
    ? "NETSUITE_PRIVATE_KEY_B64"
    : rawPrivateKey
      ? "NETSUITE_PRIVATE_KEY"
      : "missing";
  const normalizedPrivateKey = rawPrivateKeyBase64
    ? normalizePrivateKey(Buffer.from(rawPrivateKeyBase64.trim(), "base64").toString("utf8"))
    : rawPrivateKey
      ? normalizePrivateKey(rawPrivateKey)
      : "";

  return {
    accountIdConfigured: Boolean(process.env.NETSUITE_ACCOUNT_ID),
    certificateIdConfigured: Boolean(process.env.NETSUITE_CERTIFICATE_ID),
    clientIdConfigured: Boolean(process.env.NETSUITE_CLIENT_ID),
    hasPrivateKeyFooter: normalizedPrivateKey.includes("-----END"),
    hasPrivateKeyHeader: normalizedPrivateKey.includes("-----BEGIN"),
    marker: NETSUITE_CONFIG_MARKER,
    privateKeyLength: normalizedPrivateKey.length,
    privateKeySource,
    restBaseUrlConfigured: Boolean(process.env.NETSUITE_REST_BASE_URL),
    scope: process.env.NETSUITE_SCOPE ?? DEFAULT_NETSUITE_SCOPE
  };
}

function readScopes(value: string | undefined) {
  const scopes = (value ?? DEFAULT_NETSUITE_SCOPE)
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0 ? scopes : [DEFAULT_NETSUITE_SCOPE];
}

function getPrivateKey() {
  const base64PrivateKey = process.env.NETSUITE_PRIVATE_KEY_B64 ?? process.env.NETSUITE_PRIVATE_KEY_BASE64;

  if (base64PrivateKey) {
    return normalizePrivateKey(Buffer.from(base64PrivateKey.trim(), "base64").toString("utf8"));
  }

  const privateKey = process.env.NETSUITE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing required environment variable: NETSUITE_PRIVATE_KEY_B64 or NETSUITE_PRIVATE_KEY");
  }

  return normalizePrivateKey(privateKey);
}

function normalizePrivateKey(value: string) {
  const trimmedValue = value.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  if (trimmedValue.includes("-----BEGIN") && trimmedValue.includes("-----END")) {
    return trimmedValue;
  }

  try {
    const decodedValue = Buffer.from(trimmedValue, "base64").toString("utf8").trim();

    if (decodedValue.includes("-----BEGIN") && decodedValue.includes("-----END")) {
      return decodedValue;
    }
  } catch {
    // The signer will return a clearer configuration error if this is not usable PEM.
  }

  return trimmedValue;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
