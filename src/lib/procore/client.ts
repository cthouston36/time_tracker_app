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

  async get<TResponse>(path: string) {
    if (!this.accessToken) {
      throw new Error("Procore access token is required before calling the API.");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Procore request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as TResponse;
  }
}
