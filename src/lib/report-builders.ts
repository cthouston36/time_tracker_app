import type { AllocationEntry, CrewLaborType, Project } from "@/lib/procore/types";

export type ReportMode = "summary" | "detail" | "crew";
export type DetailGrouping = "crew_day" | "crew_project" | "job_day";
export type DetailSort = "worst_average" | "best_average" | "most_hours" | "most_quantity";
export type ReportMetric = "mean" | "median";

export type ReportOptions = {
  excludeOutliers?: boolean;
  metric?: ReportMetric;
};

export type ReportPagination = {
  page: number;
  pageSize: number;
  totalRows: number;
};

export type PayItemJobRollupRow = {
  id: string;
  projectName: string;
  entryCount: number;
  excludedEntryCount: number;
  sampleSize: number;
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
  excludedEntryCount: number;
  sampleSize: number;
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
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  hours: number;
  quantityCompleted: number;
  hoursPerUnit: number;
  isOutlier?: boolean;
  savedByName?: string;
};

export type PayItemDetailAnalysisRow = {
  id: string;
  payItemLabel: string;
  date?: string;
  projectName: string;
  crewMemberName?: string;
  jobTitle?: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  entryCount: number;
  excludedEntryCount: number;
  sampleSize: number;
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
  excludedEntryCount: number;
  sampleSize: number;
  jobCount: number;
};

export type CrewPerformanceRow = {
  id: string;
  crewMemberName: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  totalHours: number;
  totalQuantity: number;
  entryCount: number;
  excludedEntryCount: number;
  sampleSize: number;
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

const ALL_CREW_LABOR_TYPES: CrewLaborType[] = ["chinchor_employee", "temp_employee", "subcontractor"];
const DEFAULT_CREW_LABOR_TYPE: CrewLaborType = "chinchor_employee";

export function filterEntriesByCrewLaborTypes(entries: AllocationEntry[], laborTypes: CrewLaborType[]) {
  const selectedLaborTypes = normalizeCrewLaborTypes(laborTypes);

  if (selectedLaborTypes.length === ALL_CREW_LABOR_TYPES.length) {
    return entries;
  }

  if (selectedLaborTypes.length === 0) {
    return [];
  }

  const selectedLaborTypeSet = new Set(selectedLaborTypes);

  return entries.flatMap((entry) => {
    if (!entry.crewAllocations?.length || entry.hours <= 0) {
      return [];
    }

    const includedAllocations = entry.crewAllocations.filter((allocation) =>
      selectedLaborTypeSet.has(normalizeCrewLaborType(allocation.laborType))
    );

    if (includedAllocations.length === 0) {
      return [];
    }

    const includedHours = includedAllocations.reduce((total, allocation) => total + allocation.hours, 0);

    if (includedHours <= 0) {
      return [];
    }

    const quantityCompleted = entry.quantityCompleted * (includedHours / entry.hours);

    return [
      {
        ...entry,
        crewAllocations: includedAllocations,
        hours: includedHours,
        quantityCompleted
      }
    ];
  });
}

export function buildPayItemReport(entries: AllocationEntry[], projects: Project[], options?: ReportOptions): PayItemReportRow[] {
  const resolvedOptions = resolveReportOptions(options);
  const samples = applyOutlierFlags(
    entries.map((entry) => ({
      entry,
      hours: entry.hours,
      hoursPerUnit: entry.quantityCompleted > 0 ? entry.hours / entry.quantityCompleted : 0,
      payItemKey: getPayItemReportKey(entry),
      quantityCompleted: entry.quantityCompleted
    })),
    resolvedOptions
  );
  const rows = new Map<string, PayItemReportRow & { rateSamples: RateSample[] }>();

  for (const sample of samples.filter((row) => !row.isOutlier)) {
    const current = rows.get(sample.payItemKey) ?? {
      key: sample.payItemKey,
      code: sample.entry.payItemCode,
      name: sample.entry.payItemName,
      totalHours: 0,
      totalQuantity: 0,
      hoursPerUnit: 0,
      entryCount: 0,
      excludedEntryCount: 0,
      sampleSize: 0,
      jobRollupRows: [],
      rateSamples: []
    };

    current.totalHours += sample.hours;
    current.totalQuantity += sample.quantityCompleted;
    current.entryCount += 1;
    current.rateSamples.push(sample);
    current.hoursPerUnit = calculateHoursPerUnit(current.rateSamples, resolvedOptions.metric);
    rows.set(sample.payItemKey, current);
  }

  for (const sample of samples) {
    const current = rows.get(sample.payItemKey);

    if (current) {
      current.sampleSize += 1;
      current.excludedEntryCount += sample.isOutlier ? 1 : 0;
    }
  }

  return Array.from(rows.values())
    .map((rowWithSamples) => {
      const row = omitRateSamples(rowWithSamples);

      return {
        ...row,
        jobRollupRows: buildPayItemJobRollupRows(
          samples.filter((sample) => sample.payItemKey === row.key),
          projects,
          resolvedOptions.metric
        )
      };
    })
    .sort((a, b) => b.hoursPerUnit - a.hoursPerUnit);
}

function buildPayItemJobRollupRows(
  samples: Array<OutlierEvaluatedRow<EntryRateSample>>,
  projects: Project[],
  metric: ReportMetric
): PayItemJobRollupRow[] {
  const rows = new Map<string, PayItemJobRollupRow & { rateSamples: RateSample[] }>();

  for (const sample of samples.filter((row) => !row.isOutlier)) {
    const current = rows.get(sample.entry.projectId) ?? {
      id: sample.entry.projectId,
      projectName: getEntryProjectName(sample.entry, projects),
      entryCount: 0,
      excludedEntryCount: 0,
      sampleSize: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0,
      rateSamples: []
    };

    current.entryCount += 1;
    current.hours += sample.hours;
    current.quantityCompleted += sample.quantityCompleted;
    current.rateSamples.push(sample);
    current.hoursPerUnit = calculateHoursPerUnit(current.rateSamples, metric);
    rows.set(sample.entry.projectId, current);
  }

  for (const sample of samples) {
    const current = rows.get(sample.entry.projectId);

    if (current) {
      current.sampleSize += 1;
      current.excludedEntryCount += sample.isOutlier ? 1 : 0;
    }
  }

  return Array.from(rows.values())
    .map(omitRateSamples)
    .sort((a, b) => a.projectName.localeCompare(b.projectName));
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
      const laborType = normalizeCrewLaborType(allocation.laborType);
      const crewMemberName =
        laborType === "subcontractor"
          ? allocation.subcontractorCompany || allocation.crewMemberName
          : allocation.crewMemberName;

      return {
        id: `${entry.id}-${allocation.crewMemberId}`,
        date: entry.date,
        payItemKey,
        payItemLabel,
        projectName,
        crewMemberId: allocation.crewMemberId,
        crewMemberName,
        jobTitle: laborType === "subcontractor" ? "Subcontractor" : allocation.jobTitle,
        laborType,
        subcontractorCompany: allocation.subcontractorCompany,
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
  sort: DetailSort,
  options?: ReportOptions
): PayItemDetailAnalysisRow[] {
  const resolvedOptions = resolveReportOptions(options);
  const detailRows = applyOutlierFlags(buildPayItemReportDetailRows(entries, projects), resolvedOptions);
  const rows = new Map<string, PayItemDetailAnalysisRow & { rateSamples: RateSample[] }>();

  for (const detailRow of detailRows.filter((row) => !row.isOutlier)) {
    const key = getDetailAnalysisKey(detailRow, grouping);
    const current = rows.get(key) ?? {
      id: key,
      payItemLabel: detailRow.payItemLabel,
      date: grouping === "crew_day" || grouping === "job_day" ? detailRow.date : undefined,
      projectName: detailRow.projectName,
      crewMemberName: grouping === "crew_day" || grouping === "crew_project" ? detailRow.crewMemberName : undefined,
      jobTitle: grouping === "crew_day" || grouping === "crew_project" ? detailRow.jobTitle : undefined,
      laborType: grouping === "crew_day" || grouping === "crew_project" ? detailRow.laborType : undefined,
      subcontractorCompany:
        grouping === "crew_day" || grouping === "crew_project" ? detailRow.subcontractorCompany : undefined,
      entryCount: 0,
      excludedEntryCount: 0,
      sampleSize: 0,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0,
      rateSamples: []
    };

    current.entryCount += 1;
    current.hours += detailRow.hours;
    current.quantityCompleted += detailRow.quantityCompleted;
    current.rateSamples.push(detailRow);
    current.hoursPerUnit = calculateHoursPerUnit(current.rateSamples, resolvedOptions.metric);
    rows.set(key, current);
  }

  for (const detailRow of detailRows) {
    const current = rows.get(getDetailAnalysisKey(detailRow, grouping));

    if (current) {
      current.sampleSize += 1;
      current.excludedEntryCount += detailRow.isOutlier ? 1 : 0;
    }
  }

  return sortDetailAnalysisRows(Array.from(rows.values()).map(omitRateSamples), sort);
}

export function buildCrewPerformanceRows(entries: AllocationEntry[], projects: Project[], options?: ReportOptions): CrewPerformanceRow[] {
  const resolvedOptions = resolveReportOptions(options);
  const detailRows = applyOutlierFlags(
    buildPayItemReportDetailRows(entries, projects).filter(
      (row) => row.crewMemberId !== "unassigned" && row.quantityCompleted > 0 && row.hours > 0
    ),
    resolvedOptions
  );
  const includedDetailRows = detailRows.filter((row) => !row.isOutlier);
  const companyPayItemStats = new Map<string, { hours: number; quantity: number; hoursPerUnit: number; rateSamples: RateSample[] }>();

  for (const row of includedDetailRows) {
    const current = companyPayItemStats.get(row.payItemKey) ?? {
      hours: 0,
      quantity: 0,
      hoursPerUnit: 0,
      rateSamples: []
    };

    current.hours += row.hours;
    current.quantity += row.quantityCompleted;
    current.rateSamples.push(row);
    current.hoursPerUnit = calculateHoursPerUnit(current.rateSamples, resolvedOptions.metric);
    companyPayItemStats.set(row.payItemKey, current);
  }

  const crewPayItemRows = new Map<
    string,
    CrewPerformancePayItemRow & {
      crewMemberName: string;
      crewMemberId: string;
      jobTitle: string;
      laborType?: CrewLaborType;
      subcontractorCompany?: string;
      jobIds: Set<string>;
      rateSamples: RateSample[];
    }
  >();

  for (const row of includedDetailRows) {
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
      laborType: row.laborType,
      subcontractorCompany: row.subcontractorCompany,
      payItemLabel: row.payItemLabel,
      hours: 0,
      quantityCompleted: 0,
      hoursPerUnit: 0,
      companyHoursPerUnit: companyStats.hoursPerUnit,
      variance: 0,
      entryCount: 0,
      excludedEntryCount: 0,
      sampleSize: 0,
      jobCount: 0,
      jobIds: new Set<string>(),
      rateSamples: [] as RateSample[]
    };

    current.hours += row.hours;
    current.quantityCompleted += row.quantityCompleted;
    current.entryCount += 1;
    current.jobIds.add(row.projectName);
    current.jobCount = current.jobIds.size;
    current.rateSamples.push(row);
    current.hoursPerUnit = calculateHoursPerUnit(current.rateSamples, resolvedOptions.metric);
    current.companyHoursPerUnit = companyStats.hoursPerUnit;
    current.variance =
      current.companyHoursPerUnit > 0
        ? (current.hoursPerUnit - current.companyHoursPerUnit) / current.companyHoursPerUnit
        : 0;
    crewPayItemRows.set(key, current);
  }

  for (const row of detailRows) {
    const current = crewPayItemRows.get(`${row.crewMemberId}|${row.payItemKey}`);

    if (current) {
      current.sampleSize += 1;
      current.excludedEntryCount += row.isOutlier ? 1 : 0;
    }
  }

  const crewRows = new Map<string, CrewPerformanceRow & { jobIds: Set<string> }>();

  for (const payItemRow of crewPayItemRows.values()) {
    const current = crewRows.get(payItemRow.crewMemberId) ?? {
      id: payItemRow.crewMemberId,
      crewMemberName: payItemRow.crewMemberName,
      jobTitle: payItemRow.jobTitle,
      laborType: payItemRow.laborType,
      subcontractorCompany: payItemRow.subcontractorCompany,
      totalHours: 0,
      totalQuantity: 0,
      entryCount: 0,
      excludedEntryCount: 0,
      sampleSize: 0,
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
    current.excludedEntryCount += payItemRow.excludedEntryCount;
    current.sampleSize += payItemRow.sampleSize;
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
      excludedEntryCount: payItemRow.excludedEntryCount,
      sampleSize: payItemRow.sampleSize,
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
      laborType: row.laborType,
      subcontractorCompany: row.subcontractorCompany,
      totalHours: row.totalHours,
      totalQuantity: row.totalQuantity,
      entryCount: row.entryCount,
      excludedEntryCount: row.excludedEntryCount,
      sampleSize: row.sampleSize,
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
        label: `${entry.payItemCode} - ${entry.payItemName}${entry.payItemUnitOfMeasure ? ` (${entry.payItemUnitOfMeasure})` : ""}`,
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

const DEFAULT_REPORT_OPTIONS: Required<ReportOptions> = {
  excludeOutliers: false,
  metric: "median"
};
const OUTLIER_MIN_SAMPLE_SIZE = 5;
const OUTLIER_IQR_MULTIPLIER = 1.5;

type RateSample = {
  hours: number;
  hoursPerUnit: number;
  payItemKey: string;
  quantityCompleted: number;
};

type EntryRateSample = RateSample & {
  entry: AllocationEntry;
};

type OutlierEvaluatedRow<TRow> = TRow & {
  isOutlier: boolean;
};

function omitRateSamples<TRow>(row: TRow & { rateSamples: RateSample[] }) {
  const { rateSamples, ...reportRow } = row;

  void rateSamples;

  return reportRow;
}

function resolveReportOptions(options: ReportOptions | undefined): Required<ReportOptions> {
  return {
    excludeOutliers: options?.excludeOutliers ?? DEFAULT_REPORT_OPTIONS.excludeOutliers,
    metric: options?.metric ?? DEFAULT_REPORT_OPTIONS.metric
  };
}

function applyOutlierFlags<TRow extends RateSample>(
  rows: TRow[],
  options: Required<ReportOptions>
): Array<OutlierEvaluatedRow<TRow>> {
  const rowsWithFlags = rows.map((row) => ({
    ...row,
    isOutlier: false
  }));

  if (!options.excludeOutliers) {
    return rowsWithFlags;
  }

  const rowsByPayItemKey = new Map<string, Array<OutlierEvaluatedRow<TRow>>>();

  for (const row of rowsWithFlags) {
    if (!isUsableRateSample(row)) {
      continue;
    }

    rowsByPayItemKey.set(row.payItemKey, [...(rowsByPayItemKey.get(row.payItemKey) ?? []), row]);
  }

  for (const rowsInGroup of rowsByPayItemKey.values()) {
    if (rowsInGroup.length < OUTLIER_MIN_SAMPLE_SIZE) {
      continue;
    }

    const rates = rowsInGroup.map((row) => row.hoursPerUnit).sort((a, b) => a - b);
    const q1 = getQuantile(rates, 0.25);
    const q3 = getQuantile(rates, 0.75);
    const iqr = q3 - q1;

    if (!Number.isFinite(iqr) || iqr <= 0) {
      continue;
    }

    const lowerBound = q1 - OUTLIER_IQR_MULTIPLIER * iqr;
    const upperBound = q3 + OUTLIER_IQR_MULTIPLIER * iqr;

    for (const row of rowsInGroup) {
      row.isOutlier = row.hoursPerUnit < lowerBound || row.hoursPerUnit > upperBound;
    }
  }

  return rowsWithFlags;
}

function calculateHoursPerUnit(rows: RateSample[], metric: ReportMetric) {
  if (metric === "median") {
    const rates = rows
      .filter(isUsableRateSample)
      .map((row) => row.hoursPerUnit)
      .sort((a, b) => a - b);

    return getMedian(rates);
  }

  const totalHours = rows.reduce((total, row) => total + row.hours, 0);
  const totalQuantity = rows.reduce((total, row) => total + row.quantityCompleted, 0);

  return totalQuantity > 0 ? totalHours / totalQuantity : 0;
}

function isUsableRateSample(row: RateSample) {
  return row.hours > 0 && row.quantityCompleted > 0 && Number.isFinite(row.hoursPerUnit) && row.hoursPerUnit > 0;
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);

  return values.length % 2 === 0 ? (values[midpoint - 1] + values[midpoint]) / 2 : values[midpoint];
}

function getQuantile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;

  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
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
  const crewKey = `${row.crewMemberName}|${row.jobTitle}|${row.laborType ?? ""}|${row.subcontractorCompany ?? ""}`;

  if (grouping === "crew_project") {
    return `${row.payItemKey}|${row.projectName}|${crewKey}`;
  }

  if (grouping === "job_day") {
    return `${row.payItemKey}|${row.date}|${row.projectName}`;
  }

  return `${row.payItemKey}|${row.date}|${row.projectName}|${crewKey}`;
}

function normalizeCrewLaborTypes(values: CrewLaborType[]) {
  return Array.from(new Set(values.map(normalizeCrewLaborType))).filter((value) =>
    ALL_CREW_LABOR_TYPES.includes(value)
  );
}

function normalizeCrewLaborType(value: unknown): CrewLaborType {
  if (value === "subcontractor" || value === "temp_employee" || value === "chinchor_employee") {
    return value;
  }

  return DEFAULT_CREW_LABOR_TYPE;
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
  return `${entry.payItemCode}-${entry.payItemName}-${entry.payItemUnitOfMeasure ?? ""}`;
}

function getEntryProjectName(entry: AllocationEntry, projects: Project[]) {
  return entry.projectName ?? projects.find((project) => project.id === entry.projectId)?.name ?? `Unknown job (${entry.projectId})`;
}
