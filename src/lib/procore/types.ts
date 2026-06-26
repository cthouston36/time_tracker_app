export type PayItem = {
  id: string;
  code: string;
  name: string;
  budgetedQuantity: number;
  unitOfMeasure: string;
};

export type Project = {
  id: string;
  name: string;
  payItems: PayItem[];
};

export type CrewAllocation = {
  crewMemberId: string;
  crewMemberName: string;
  jobTitle: string;
  hours: number;
};

export type AllocationEntry = {
  id: string;
  projectId: string;
  projectName?: string;
  date: string;
  payItemId: string;
  payItemCode: string;
  payItemName: string;
  payItemBudgetedQuantity?: number;
  payItemUnitOfMeasure?: string;
  hours: number;
  quantityCompleted: number;
  crewAllocations?: CrewAllocation[];
  savedByUserId?: string;
  savedByName?: string;
  savedAt?: string;
};
