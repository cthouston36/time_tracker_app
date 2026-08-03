import type { ProjectsResponse } from "@/features/time-allocation/types";
import type {
  AuthResponse,
  ProcoreStatusResponse
} from "@/features/time-allocation/lib/workspace-api-types";
import { readApiJson } from "@/features/time-allocation/lib/api-utils";

export async function loadCurrentUserSession() {
  const response = await fetch("/api/auth/me");

  return (await readApiJson(response)) as AuthResponse;
}

export async function logoutCurrentUserSession() {
  await fetch("/api/auth/logout", {
    method: "POST"
  });
}

export async function loadProcoreUploadStatus() {
  const response = await fetch("/api/procore/status");

  return (await readApiJson(response)) as ProcoreStatusResponse;
}

export async function loadProjectCatalog() {
  const response = await fetch("/api/project-catalog/projects");
  const data = (await readApiJson(response)) as ProjectsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load projects.");
  }

  return data;
}
