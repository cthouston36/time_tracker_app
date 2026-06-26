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

export type CrewMember = {
  id: string;
  name: string;
};

export type AllocationEntry = {
  id: string;
  projectId: string;
  date: string;
  payItemId: string;
  payItemCode: string;
  payItemName: string;
  hours: number;
  quantityCompleted: number;
};
