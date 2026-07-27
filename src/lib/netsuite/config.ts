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

export function getNetSuiteConfig(): NetSuiteConfig {
  const accountId = getRequiredEnv("NETSUITE_ACCOUNT_ID");
  const restBaseUrl =
    process.env.NETSUITE_REST_BASE_URL?.replace(/\/$/, "") ??
    `https://${accountId}.suitetalk.api.netsuite.com/services/rest`;

  return {
    accountId,
    certificateId: getRequiredEnv("NETSUITE_CERTIFICATE_ID"),
    clientId: getRequiredEnv("NETSUITE_CLIENT_ID"),
    privateKey: normalizePrivateKey(getRequiredEnv("NETSUITE_PRIVATE_KEY")),
    restBaseUrl,
    scopes: readScopes(process.env.NETSUITE_SCOPE),
    tokenEndpoint:
      process.env.NETSUITE_TOKEN_ENDPOINT ??
      `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
  };
}

function readScopes(value: string | undefined) {
  const scopes = (value ?? DEFAULT_NETSUITE_SCOPE)
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0 ? scopes : [DEFAULT_NETSUITE_SCOPE];
}

function normalizePrivateKey(value: string) {
  return value.trim().replace(/\\n/g, "\n");
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
