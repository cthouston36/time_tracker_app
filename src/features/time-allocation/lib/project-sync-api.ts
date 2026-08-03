import type { ProjectsResponse } from "@/features/time-allocation/types";
import { isAbortError, readApiJson } from "@/features/time-allocation/lib/api-utils";

const PROJECT_SYNC_REQUEST_TIMEOUT_MS = 55_000;

export async function postProjectsWithTimeout(path: string, timeoutMessage: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROJECT_SYNC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      signal: controller.signal
    });
    const data = (await readApiJson(response)) as ProjectsResponse;

    return { data, response };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
