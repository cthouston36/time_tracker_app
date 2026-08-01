import {
  readProjectCatalog,
  type ProjectCatalog,
  type ProjectCatalogReadOptions
} from "@/lib/project-catalog/cache";
import type { PayItem, Project } from "@/lib/domain/types";

export async function getProjects(options: ProjectCatalogReadOptions = {}): Promise<Project[]> {
  return (await getProjectCatalog(options))?.projects ?? [];
}

export async function getProjectCatalog(options: ProjectCatalogReadOptions = {}): Promise<ProjectCatalog | null> {
  const catalog = await readProjectCatalog(options);

  if (!catalog) {
    return null;
  }

  return {
    ...catalog,
    projects: catalog.projects.map((project) => ({
      ...project,
      payItems: dedupePayItems(project.payItems)
    }))
  };
}

export async function getCachedProjectPayItems(projectId: string): Promise<PayItem[]> {
  const catalog = await readProjectCatalog();
  const payItems = catalog?.projects.find((project) => project.id === projectId)?.payItems ?? [];
  return dedupePayItems(payItems);
}

export function dedupePayItems(payItems: PayItem[]) {
  const payItemsByKey = new Map<string, PayItem>();

  for (const payItem of payItems) {
    const key = buildPayItemDedupeKey(payItem);
    const existingPayItem = payItemsByKey.get(key);

    if (!existingPayItem) {
      payItemsByKey.set(key, {
        ...payItem,
        id: key,
        unitOfMeasure: normalizeUnitOfMeasure(payItem.unitOfMeasure)
      });
      continue;
    }

    payItemsByKey.set(key, {
      ...existingPayItem,
      name: existingPayItem.name || payItem.name,
      unitOfMeasure: normalizeUnitOfMeasure(existingPayItem.unitOfMeasure || payItem.unitOfMeasure)
    });
  }

  return Array.from(payItemsByKey.values());
}

function buildPayItemDedupeKey(payItem: PayItem) {
  return [
    payItem.code.trim().toLowerCase(),
    String(payItem.budgetedQuantity),
    payItem.unitOfMeasure.trim().toLowerCase()
  ].join("|");
}

function normalizeUnitOfMeasure(unitOfMeasure: string) {
  return unitOfMeasure.trim().toUpperCase();
}
