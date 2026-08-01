import type { Project } from "@/lib/domain/types";

export type DailyReportTemplate = "standard" | "two-series";

export type TwoSeriesProductionCode = {
  code: string;
  description: string;
};

export const TWO_SERIES_PRODUCTION_CODES: TwoSeriesProductionCode[] = [
  { code: "F", description: "Fixtures" },
  { code: "G", description: "Gear" },
  { code: "W", description: "Wire & Terminations" },
  { code: "I", description: "Instrument & Controls" },
  { code: "U", description: "Underground" },
  { code: "O", description: "Overhead" },
  { code: "T", description: "Time & Material" },
  { code: "S", description: "Shop" },
  { code: "N", description: "Non-Productive" },
  { code: "SL", description: "Slab Rough-In" },
  { code: "R", description: "Equipment Racks" },
  { code: "DR", description: "Drive Time" }
];

export function getDailyReportTemplateForProject(project: Pick<Project, "name"> | null | undefined): DailyReportTemplate {
  return isTwoSeriesProject(project) ? "two-series" : "standard";
}

export function isTwoSeriesProject(project: Pick<Project, "name"> | null | undefined) {
  return projectNameStartsWithTwo(project?.name ?? "");
}

export function projectNameStartsWithTwo(projectName: string) {
  return projectName.trimStart().startsWith("2");
}

export function formatTwoSeriesProductionCodeLabel(productionCode: TwoSeriesProductionCode) {
  return `${productionCode.code} - ${productionCode.description}`;
}
