import type { AllocationEntry, PayItem, Project } from "@/lib/domain/types";

export function buildRemainingQuantitiesByPayItem(
  payItems: Project["payItems"],
  projectEntries: AllocationEntry[],
  selectedDate: string
) {
  const previousQuantitiesByPayItem: Record<string, number> = {};

  for (const entry of projectEntries) {
    if (entry.date >= selectedDate) {
      continue;
    }

    previousQuantitiesByPayItem[entry.payItemId] =
      (previousQuantitiesByPayItem[entry.payItemId] ?? 0) + entry.quantityCompleted;
  }

  return payItems.reduce<Record<string, number>>((remainingQuantities, payItem) => {
    remainingQuantities[payItem.id] = payItem.budgetedQuantity - (previousQuantitiesByPayItem[payItem.id] ?? 0);

    return remainingQuantities;
  }, {});
}

export function formatPayItemQuantity(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

export function formatPayItemUnitOfMeasure(payItem: Pick<PayItem, "unitOfMeasure"> | null | undefined) {
  return typeof payItem?.unitOfMeasure === "string" ? payItem.unitOfMeasure.toUpperCase() : "";
}
