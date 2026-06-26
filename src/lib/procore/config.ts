export type ProcoreConfig = {
  clientId: string;
  clientSecret: string;
  companyId: string;
  redirectUri: string;
  baseUrl: string;
  authUrl: string;
  appUrl: string;
};

export function getProcoreConfig(): ProcoreConfig {
  return {
    clientId: getRequiredEnv("PROCORE_CLIENT_ID"),
    clientSecret: getRequiredEnv("PROCORE_CLIENT_SECRET"),
    companyId: getRequiredEnv("PROCORE_COMPANY_ID"),
    redirectUri: getRequiredEnv("PROCORE_REDIRECT_URI"),
    baseUrl: process.env.PROCORE_BASE_URL ?? "https://api.procore.com",
    authUrl: process.env.PROCORE_AUTH_URL ?? "https://login.procore.com",
    appUrl: process.env.APP_URL ?? "http://localhost:3000"
  };
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
