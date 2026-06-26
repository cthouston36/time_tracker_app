import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Project } from "@/lib/procore/types";

const CACHE_FILE = join(process.cwd(), ".data", "procore-cache.json");

export type ProcoreCache = {
  syncedAt: string;
  projects: Project[];
};

export async function readProcoreCache() {
  try {
    const contents = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(contents) as ProcoreCache;
  } catch {
    return null;
  }
}

export async function writeProcoreCache(projects: Project[]) {
  const cache: ProcoreCache = {
    syncedAt: new Date().toISOString(),
    projects
  };

  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));

  return cache;
}

export async function updateProcoreCache(updater: (currentProjects: Project[]) => Project[]) {
  const currentCache = await readProcoreCache();
  return writeProcoreCache(updater(currentCache?.projects ?? []));
}
