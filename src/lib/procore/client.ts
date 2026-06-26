type ProcoreClientOptions = {
  accessToken?: string;
  baseUrl?: string;
};

export class ProcoreClient {
  private readonly accessToken?: string;
  private readonly baseUrl: string;

  constructor(options: ProcoreClientOptions = {}) {
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl ?? process.env.PROCORE_BASE_URL ?? "https://api.procore.com";
  }

  async get<TResponse>(path: string, params?: URLSearchParams) {
    if (!this.accessToken) {
      throw new Error("Procore access token is required before calling the API.");
    }

    const url = new URL(path, this.baseUrl);

    if (params) {
      params.forEach((value, key) => url.searchParams.set(key, value));
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const retryMessage = retryAfter ? ` Try again after ${formatRetryAfter(retryAfter)}.` : "";

        throw new Error(`Procore rate limit reached.${retryMessage}`);
      }

      const details = await response.text();
      const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;
      throw new Error(`Procore request failed: ${message}`);
    }

    return (await response.json()) as TResponse;
  }
}

function formatRetryAfter(value: string) {
  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return new Date(Date.now() + seconds * 1000).toLocaleTimeString();
  }

  return value;
}
