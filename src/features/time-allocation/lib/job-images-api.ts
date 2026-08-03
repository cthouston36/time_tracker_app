import type { JobImageUpload } from "@/features/time-allocation/types";
import { readApiJson } from "@/features/time-allocation/lib/api-utils";

type JobImagesResponse = {
  databaseConfigured?: boolean;
  error?: string;
  uploads?: JobImageUpload[];
};

export async function loadDatabaseJobImageUploads(projectId: string, date: string) {
  try {
    const response = await fetch(
      `/api/job-images?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
      {
        cache: "no-store"
      }
    );
    const data = (await readApiJson(response)) as JobImagesResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return data.uploads ?? [];
  } catch {
    return null;
  }
}
