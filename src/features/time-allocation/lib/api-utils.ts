export type OkResponse = {
  error?: string;
  ok?: boolean;
};

export async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const data = (await readApiJson(response)) as { error?: string };

    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function readApiJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    if (response.ok) {
      return {};
    }

    throw new Error(`${response.status} ${response.statusText || "Request failed"}`.trim());
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) {
      throw new Error("The server returned an unreadable response.");
    }

    throw new Error(text.slice(0, 300) || `${response.status} ${response.statusText || "Request failed"}`.trim());
  }
}

export function readDownloadFileName(headers: Headers) {
  const contentDisposition = headers.get("content-disposition") ?? "";
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);

  if (encodedMatch) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return quotedMatch?.[1] ?? plainMatch?.[1]?.trim();
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
