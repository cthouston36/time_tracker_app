import { getNetSuiteAccessToken } from "@/lib/netsuite/auth";
import { getNetSuiteConfig } from "@/lib/netsuite/config";

export type SuiteQLResponse<TRow> = {
  count?: number;
  items?: TRow[];
  offset?: number;
  totalResults?: number;
};

const DEFAULT_SUITEQL_PAGE_SIZE = 1000;

export async function runSuiteQL<TRow>(query: string, options: { limit?: number; offset?: number } = {}) {
  const limit = clampPageSize(options.limit ?? DEFAULT_SUITEQL_PAGE_SIZE);
  const offset = Math.max(0, options.offset ?? 0);

  return netSuiteJsonRequest<SuiteQLResponse<TRow>>({
    body: JSON.stringify({ q: query }),
    method: "POST",
    path: `/query/v1/suiteql?limit=${limit}&offset=${offset}`,
    preferTransient: true,
    stage: "NetSuite SuiteQL request"
  });
}

export async function runSuiteQLAll<TRow>(query: string, options: { pageSize?: number } = {}) {
  const pageSize = clampPageSize(options.pageSize ?? DEFAULT_SUITEQL_PAGE_SIZE);
  const rows: TRow[] = [];
  let offset = 0;

  for (;;) {
    const response = await runSuiteQL<TRow>(query, { limit: pageSize, offset });
    const pageRows = response.items ?? [];

    rows.push(...pageRows);

    const count = response.count ?? pageRows.length;
    const totalResults = response.totalResults;

    if (count === 0 || pageRows.length === 0 || (typeof totalResults === "number" && rows.length >= totalResults)) {
      break;
    }

    offset += count;
  }

  return rows;
}

async function netSuiteJsonRequest<TResponse>({
  body,
  method = "GET",
  path,
  preferTransient = false,
  stage
}: {
  body?: BodyInit;
  method?: "GET" | "POST";
  path: string;
  preferTransient?: boolean;
  stage: string;
}) {
  const config = getNetSuiteConfig();
  const accessToken = await getNetSuiteAccessToken();
  const url = new URL(`${config.restBaseUrl}/${path.replace(/^\//, "")}`);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  });

  if (preferTransient) {
    headers.set("Prefer", "transient");
  }

  const response = await fetch(url, {
    body,
    headers,
    method
  });

  if (!response.ok) {
    const details = await response.text();
    const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;

    throw new Error(`${stage} failed: ${message}`);
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  const text = await response.text();

  if (!text) {
    return {} as TResponse;
  }

  return JSON.parse(text) as TResponse;
}

function clampPageSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SUITEQL_PAGE_SIZE;
  }

  return Math.min(1000, Math.max(1, Math.floor(value)));
}
