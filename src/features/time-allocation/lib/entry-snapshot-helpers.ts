import type { AllocationEntry, Project } from "@/lib/domain/types";
import { formatPayItemUnitOfMeasure } from "@/features/time-allocation/lib/pay-item-helpers";

export function populateEntryProjectSnapshots(entries: AllocationEntry[], projects: Project[]) {
  const projectSnapshotsById = new Map(
    projects.map((project) => [
      project.id,
      {
        name: project.name,
        payItemsById: new Map(project.payItems.map((payItem) => [payItem.id, payItem]))
      }
    ])
  );
  let changed = false;

  const entriesWithSnapshots = entries.map((entry) => {
    const projectSnapshot = projectSnapshotsById.get(entry.projectId);
    const payItemSnapshot = projectSnapshot?.payItemsById.get(entry.payItemId);

    if (entry.projectName && entry.payItemBudgetedQuantity !== undefined && entry.payItemUnitOfMeasure) {
      return entry;
    }

    const nextProjectName = entry.projectName ?? projectSnapshot?.name;
    const nextPayItemBudgetedQuantity = entry.payItemBudgetedQuantity ?? payItemSnapshot?.budgetedQuantity;
    const nextPayItemUnitOfMeasure = entry.payItemUnitOfMeasure ?? formatPayItemUnitOfMeasure(payItemSnapshot);

    if (
      nextProjectName === entry.projectName &&
      nextPayItemBudgetedQuantity === entry.payItemBudgetedQuantity &&
      nextPayItemUnitOfMeasure === entry.payItemUnitOfMeasure
    ) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      projectName: nextProjectName,
      payItemBudgetedQuantity: nextPayItemBudgetedQuantity,
      payItemUnitOfMeasure: nextPayItemUnitOfMeasure
    };
  });

  return {
    changed,
    entries: entriesWithSnapshots
  };
}
