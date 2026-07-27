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
  netSuiteProjectId?: string;
  payItems: PayItem[];
  procoreProjectId?: string;
  sourceSystem?: "procore" | "netsuite";
};

export const CREW_LABOR_TYPES = ["chinchor_employee", "temp_employee", "subcontractor"] as const;

export type CrewLaborType = (typeof CREW_LABOR_TYPES)[number];

export type CrewAllocation = {
  crewMemberId: string;
  crewMemberName: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
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
