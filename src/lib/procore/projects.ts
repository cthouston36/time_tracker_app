import { mockProjects } from "@/lib/data/mock-projects";
import type { Project } from "@/lib/procore/types";

export async function getProjects(): Promise<Project[]> {
  // Replace this with ProcoreClient calls once OAuth token storage is in place.
  return mockProjects;
}
