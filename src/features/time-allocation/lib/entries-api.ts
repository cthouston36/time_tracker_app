import type { AllocationEntry } from "@/lib/domain/types";
import { readApiJson, type OkResponse } from "@/features/time-allocation/lib/api-utils";

type EntriesResponse = {
  databaseConfigured?: boolean;
  entries?: AllocationEntry[];
  error?: string;
};

export async function loadDatabaseEntries() {
  try {
    const response = await fetch("/api/entries", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as EntriesResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return data.entries ?? [];
  } catch {
    return null;
  }
}

export async function saveDatabaseEntries(entries: AllocationEntry[]) {
  const response = await fetch("/api/entries", {
    body: JSON.stringify({ entries }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to save entries.");
  }
}

export async function deleteDatabaseEntry(entryId: string) {
  const response = await fetch(`/api/entries?entryId=${encodeURIComponent(entryId)}`, {
    method: "DELETE"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete entry.");
  }
}

export async function deleteDatabaseDayEntries(projectId: string, date: string) {
  const response = await fetch(
    `/api/entries?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to delete day entries.");
  }
}
