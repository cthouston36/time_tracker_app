import type { AllocationEntry, Project } from "@/lib/procore/types";

export type ReportMode = "summary" | "detail" | "crew";
export type DetailGrouping = "crew_day" | "crew_project" | "job_day";
export type DetailSort = "worst_average" | "best_average" | "most_hours" | "most_quantity";

export type ReportPagination = {
  page: number;
  pageSize: number;
  totalRows: number;
};

export type PayItemJobRollupRow = {
  id: string;
  projectName: string;
  entryCount: number;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
};

export type PayItemReportRow = {
  key: string;
  code: string;
  name: string;
  totalHours: number;
  totalQuantity: number;
  hoursPerUnit: number;
  entryCount: number;
  jobRollupRows: PayItemJobRollupRow[];
};

export type PayItemReportDetailRow = {
  id: string;
  date: string;
  payItemKey: string;
  payItemLabel: string;
  projectName: string;
  crewMemberId: string;
  crewMemberName: string;
  jobTitle: string;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
  savedByName?: string;
};

export type PayItemDetailAnalysisRow = {
  id: string;
  payItemLabel: string;
  date?: string;
  projectName: string;
  crewMemberName?: string;
  jobTitle?: string;
  entryCount: number;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
};

export type CrewPerformancePayItemRow = {
  id: string;
  payItemLabel: string;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
  companyHoursPerUnit: number;
  variance: number;
  entryCount: number;
  jobCount: number;
};

export type CrewPerformanceRow = {
  id: string;
  crewMemberName: string;
  jobTitle: string;
  totalHours: number;
  totalQuantity: number;
  entryCount: number;
  jobCount: number;
  payItemCount: number;
  weightedVariance: number;
  status: "strong" | "average" | "review" | "limited";
  payItems: CrewPerformancePayItemRow[];
};

export type ReportPayItemOption = {
  key: string;
  label: string;
  query: string;
};

export function buildPayItemReport(entries: AllocationEntry[], projects: Project[]): PayItemReportRow[] {
  const rows = new Map<string, Omit<PayItemReportRow, "jobRollupRows">>();

  for (const entry of entries) {
    const key = getPayItemReportKey(entry);
    const current = rows.get(key) ?? {
      key,
      code: entry.payItemCode,
      name: entry.payItemName,
      totalHours: 0,
      totalQuantity: 0,
      hoursPerUnit: 0,
      entryCount: 0
    };

    current.totalHours += entry.hours;
    current.totalQuantity += entry.quantityCompleted;
    current.entryCount += 1;
    current.hoursPerUnit = current.totalQuantity > 0 ? current.totalHours / current.totalQuantity : 0;
    rows.set(key, current);
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      jobRollupRows: buildPayItemJobRollupRows(
        entries.filter((entry) => getPayItemReportKey(entry) === row.key),
        projects
      )
    }))
    .sort((a, b) => b.hoursPerUnit - a.hoursPerUnit);
}

export function buildPayItemJobRollupRows(entries: AllocationEntry[], projects: Project[]): PayItemJobRollupRow[] {
  const rows = new Map<string, PayItemJobRollupRow>();

  for (const entry of entries) {
    const current = rows.get(entry.projectId) ?? {
      id: entry.projectId,
      projectName: getEntryProjectName(entry, projects),
      entryCount: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0
    };

    current.entryCount += 1;
    current.hours += entry.hours;
    current.quantityCompleted += entry.quantityCompleted;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    rows.set(entry.projectId, current);
  }

  return Array.from(rows.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export function buildPayItemReportDetailRows(entries: AllocationEntry[], projects: Project[]): PayItemReportDetailRow[] {
  return entries.flatMap((entry) => {
    const projectName = getEntryProjectName(entry, projects);
    const payItemKey = getPayItemReportKey(entry);
    const payItemLabel = `${entry.payItemCode} - ${entry.payItemName}`;

    if (!entry.crewAllocations?.length || entry.hours <= 0) {
      return [
        {
          id: `${entry.id}-unassigned`,
          date: entry.date,
          payItemKey,
          payItemLabel,
          projectName,
          crewMemberId: "unassigned",
          crewMemberName: "Unassigned",
          jobTitle: "-",
          hours: entry.hours,
          quantityCompleted: entry.quantityCompleted,
          hoursPerUnit: entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : 0,
          savedByName: entry.savedByName
        }
      ];
    }

    return entry.crewAllocations.map((allocation) => {
      const hourShare = entry.hours > 0 ? allocation.hours / entry.hours : 0;
      const allocatedQuantity = entry.quantityCompleted * hourShare;

      return {
        id: `${entry.id}-${allocation.crewMemberId}`,
        date: entry.date,
        payItemKey,
        payItemLabel,
        projectName,
        crewMemberId: allocation.crewMemberId,
        crewMemberName: allocation.crewMemberName,
        jobTitle: allocation.jobTitle,
        hours: allocation.hours,
        quantityCompleted: allocatedQuantity,
        hoursPerUnit: allocatedQuantity > 0 ? allocation.hours / allocatedQuantity : 0,
        savedByName: entry.savedByName
      };
    });
  });
}

export function buildPayItemDetailAnalysisRows(
  entries: AllocationEntry[],
  projects: Project[],
  grouping: DetailGrouping,
  sort: DetailSort
): PayItemDetailAnalysisRow[] {
  const detailRows = buildPayItemReportDetailRows(entries, projects);
  const rows = new Map<string, PayItemDetailAnalysisRow>();

  for (const detailRow of detailRows) {
    const key = getDetailAnalysisKey(detailRow, grouping);
    const current = rows.get(key) ?? {
      id: key,
      payItemLabel: detailRow.payItemLabel,
      date: grouping === "crew_day" || grouping === "job_day" ? detailRow.date : undefined,
      projectName: detailRow.projectName,
      crewMemberName: grouping === "crew_day" || grouping === "crew_project" ? detailRow.crewMemberName : undefined,
      jobTitle: grouping === "crew_day" || grouping === "crew_project" ? detailRow.jobTitle : undefined,
      entryCount: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0
    };

    current.entryCount += 1;
    current.hours += detailRow.hours;
    current.quantityCompleted += detailRow.quantityCompleted;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    rows.set(key, current);
  }

  return sortDetailAnalysisRows(Array.from(rows.values()), sort);
}

export function buildCrewPerformanceRows(entries: AllocationEntry[], projects: Project[]): CrewPerformanceRow[] {
  const detailRows = buildPayItemReportDetailRows(entries, projects).filter(
    (row) => row.crewMemberId !== "unassigned" && row.quantityCompleted > 0 && row.hours > 0
  );
  const companyPayItemStats = new Map<string, { hours: number; quantity: number; hoursPerUnit: number }>();

  for (const row of detailRows) {
    const current = companyPayItemStats.get(row.payItemKey) ?? {
      hours: 0,
      quantity: 0,
      hoursPerUnit: 0
    };

    current.hours += row.hours;
    current.quantity += row.quantityCompleted;
    current.hoursPerUnit = current.quantity > 0 ? current.hours / current.quantity : 0;
    companyPayItemStats.set(row.payItemKey, current);
  }

  const crewPayItemRows = new Map<
    string,
    CrewPerformancePayItemRow & { crewMemberName: string; crewMemberId: string; jobTitle: string; jobIds: Set<string> }
  >();

  for (const row of detailRows) {
    const companyStats = companyPayItemStats.get(row.payItemKey);

    if (!companyStats || companyStats.hoursPerUnit <= 0) {
      continue;
    }

    const key = `${row.crewMemberId}|${row.payItemKey}`;
    const current = crewPayItemRows.get(key) ?? {
      id: key,
      crewMemberId: row.crewMemberId,
      crewMemberName: row.crewMemberName,
      jobTitle: row.jobTitle,
      payItemLabel: row.payItemLabel,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0,
      companyHoursPerUnit: companyStats.hoursPerUnit,
      variance: 0,
      entryCount: 0,
      jobCount: 0,
      jobIds: new Set<string>()
    };

    current.hours += row.hours;
    current.quantityCompleted += row.quantityCompleted;
    current.entryCount += 1;
    current.jobIds.add(row.projectName);
    current.jobCount = current.jobIds.size;
    current.hoursPerUnit = current.quantityCompleted > 0 ? current.hours / current.quantityCompleted : 0;
    current.companyHoursPerUnit = companyStats.hoursPerUnit;
    current.variance =
      current.companyHoursPerUnit > 0
        ? (current.hoursPerUnit - current.companyHoursPerUnit) / current.companyHoursPerUnit
        : 0;
    crewPayItemRows.set(key, current);
  }

  const crewRows = new Map<string, CrewPerformanceRow & { jobIds: Set<string> }>();

  for (const payItemRow of crewPayItemRows.values()) {
    const current = crewRows.get(payItemRow.crewMemberId) ?? {
      id: payItemRow.crewMemberId,
      crewMemberName: payItemRow.crewMemberName,
      jobTitle: payItemRow.jobTitle,
      totalHours: 0,
      totalQuantity: 0,
      entryCount: 0,
      jobCount: 0,
      payItemCount: 0,
      weightedVariance: 0,
      status: "average",
      payItems: [],
      jobIds: new Set<string>()
    };

    current.totalHours += payItemRow.hours;
    current.totalQuantity += payItemRow.quantityCompleted;
    current.entryCount += payItemRow.entryCount;
    for (const jobId of payItemRow.jobIds) {
      current.jobIds.add(jobId);
    }
    current.payItems.push({
      id: payItemRow.id,
      payItemLabel: payItemRow.payItemLabel,
      hours: payItemRow.hours,
      quantityCompleted: payItemRow.quantityCompleted,
      hoursPerUnit: payItemRow.hoursPerUnit,
      companyHoursPerUnit: payItemRow.companyHoursPerUnit,
      variance: payItemRow.variance,
      entryCount: payItemRow.entryCount,
      jobCount: payItemRow.jobCount
    });
    current.jobCount = current.jobIds.size;
    current.payItemCount = current.payItems.length;
    current.weightedVariance = getWeightedVariance(current.payItems);
    current.status = getCrewPerformanceStatus(current);
    crewRows.set(payItemRow.crewMemberId, current);
  }

  return Array.from(crewRows.values())
    .map((row) => ({
      id: row.id,
      crewMemberName: row.crewMemberName,
      jobTitle: row.jobTitle,
      totalHours: row.totalHours,
      totalQuantity: row.totalQuantity,
      entryCount: row.entryCount,
      jobCount: row.jobCount,
      payItemCount: row.payItemCount,
      weightedVariance: row.weightedVariance,
      status: row.status,
      payItems: [...row.payItems].sort((a, b) => b.hours - a.hours)
    }))
    .sort((a, b) => b.weightedVariance - a.weightedVariance);
}

export function buildReportPayItemOptions(entries: AllocationEntry[]) {
  const payItemOptions = new Map<string, ReportPayItemOption>();

  for (const entry of entries) {
    const key = getPayItemReportKey(entry);

    if (!payItemOptions.has(key)) {
      payItemOptions.set(key, {
        key,
        label: `${entry.payItemCode} - ${entry.payItemName}`,
        query: entry.payItemCode
      });
    }
  }

  return Array.from(payItemOptions.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

export function paginateRows<TRow>(rows: TRow[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    page: safePage,
    pageSize: safePageSize,
    rows: rows.slice(start, start + safePageSize),
    totalRows
  };
}

function getWeightedVariance(payItems: CrewPerformancePayItemRow[]) {
  const totalWeight = payItems.reduce((total, row) => total + row.hours, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  return payItems.reduce((total, row) => total + row.variance * row.hours, 0) / totalWeight;
}

function getCrewPerformanceStatus(row: Pick<CrewPerformanceRow, "entryCount" | "totalHours" | "weightedVariance">) {
  if (row.totalHours < 20 || row.entryCount < 3) {
    return "limited";
  }

  if (row.weightedVariance <= -0.15) {
    return "strong";
  }

  if (row.weightedVariance >= 0.25) {
    return "review";
  }

  return "average";
}

function getDetailAnalysisKey(row: PayItemReportDetailRow, grouping: DetailGrouping) {
  if (grouping === "crew_project") {
    return `${row.payItemKey}|${row.projectName}|${row.crewMemberName}|${row.jobTitle}`;
  }

  if (grouping === "job_day") {
    return `${row.payItemKey}|${row.date}|${row.projectName}`;
  }

  return `${row.payItemKey}|${row.date}|${row.projectName}|${row.crewMemberName}|${row.jobTitle}`;
}

function sortDetailAnalysisRows(rows: PayItemDetailAnalysisRow[], sort: DetailSort) {
  return [...rows].sort((a, b) => {
    if (sort === "best_average") {
      return a.hoursPerUnit - b.hoursPerUnit;
    }

    if (sort === "most_hours") {
      return b.hours - a.hours;
    }

    if (sort === "most_quantity") {
      return b.quantityCompleted - a.quantityCompleted;
    }

    return b.hoursPerUnit - a.hoursPerUnit;
  });
}

function getPayItemReportKey(entry: AllocationEntry) {
  return `${entry.payItemCode}-${entry.payItemName}`;
}

function getEntryProjectName(entry: AllocationEntry, projects: Project[]) {
  return entry.projectName ?? projects.find((project) => project.id === entry.projectId)?.name ?? `Unknown job (${entry.projectId})`;
}
