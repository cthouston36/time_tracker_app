"use client";

import { ListChecks } from "lucide-react";
import { isTwoSeriesProject } from "@/lib/daily-report-templates";
import type { Project } from "@/lib/domain/types";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import type {
  CrewMember,
  CrewMembersByProject,
  ManagedAppUser,
  NetSuiteVendor,
  ProjectArchiveById,
  ProjectBlacklistById,
  VendorBlacklistById
} from "@/features/time-allocation/types";

type DataQualityIssue = {
  detail: string;
  id: string;
  severity: "error" | "info" | "warning";
  title: string;
};

export function AdminDataQualityPanel({
  crewDirectory,
  crewMembersByProject,
  projectArchiveById,
  projectBlacklistById,
  projects,
  users,
  vendorBlacklistById,
  vendors
}: {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
  users: ManagedAppUser[];
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const issues = buildDataQualityIssues({
    crewDirectory,
    crewMembersByProject,
    projectArchiveById,
    projectBlacklistById,
    projects,
    users,
    vendorBlacklistById,
    vendors
  });
  const archivedProjectCount = projects.filter((project) => projectArchiveById[project.id]).length;
  const blacklistedProjectCount = projects.filter((project) => projectBlacklistById[project.id]).length;
  const visibleProjectCount = projects.length - archivedProjectCount - blacklistedProjectCount;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <details className="data-quality-panel" open>
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Data Quality ({errorCount} critical, {warningCount} review)
      </summary>
      <div className="data-quality-body">
        <div className="data-quality-metrics">
          <div>
            <span>Visible jobs</span>
            <strong>{visibleProjectCount}</strong>
          </div>
          <div>
            <span>Archived</span>
            <strong>{archivedProjectCount}</strong>
          </div>
          <div>
            <span>Blacklisted</span>
            <strong>{blacklistedProjectCount}</strong>
          </div>
          <div>
            <span>Crew records</span>
            <strong>{crewDirectory.length}</strong>
          </div>
        </div>
        {issues.length === 0 ? (
          <div className="success-alert">No data quality issues found in the cached app data.</div>
        ) : (
          <div className="data-quality-list">
            {issues.map((issue) => (
              <div className={`data-quality-issue ${issue.severity}`} key={issue.id}>
                <strong>{issue.title}</strong>
                <span>{issue.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function buildDataQualityIssues({
  crewDirectory,
  projectArchiveById,
  projectBlacklistById,
  projects,
  users
}: {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
  users: ManagedAppUser[];
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const issues: DataQualityIssue[] = [];
  const visibleProjects = projects.filter((project) => !projectArchiveById[project.id] && !projectBlacklistById[project.id]);
  const duplicateProjectNames = findDuplicateValues(visibleProjects.map((project) => project.name));
  const noPayItemProjects = visibleProjects.filter((project) => !isTwoSeriesProject(project) && project.payItems.length === 0);
  const missingProjectManagerProjects = visibleProjects.filter((project) => !project.netSuiteProjectManagerId);
  const duplicatePayItemProjects = visibleProjects.flatMap((project) => {
    const duplicateCodes = findDuplicateValues(project.payItems.map((payItem) => payItem.code));

    return duplicateCodes.map((code) => `${project.name}: ${code}`);
  });
  const duplicateCrewNames = findDuplicateValues(
    crewDirectory.map((member) =>
      member.laborType === "subcontractor" ? `Subcontractor: ${getCrewDisplayName(member)}` : member.name
    )
  );
  const subcontractorsMissingVendor = crewDirectory.filter(
    (member) => member.laborType === "subcontractor" && !member.netSuiteVendorId
  );
  const pmUsersWithoutMapping = users.filter(
    (user) => user.role === "project_manager" && user.active !== false && !user.netSuiteProjectManagerId
  );

  if (noPayItemProjects.length > 0) {
    issues.push({
      detail: `${noPayItemProjects.length} Signal project${noPayItemProjects.length === 1 ? "" : "s"} have no pay items. Examples: ${formatDataQualitySamples(noPayItemProjects.map((project) => project.name))}.`,
      id: "projects-without-pay-items",
      severity: "error",
      title: "Projects without pay items"
    });
  }

  if (duplicateProjectNames.length > 0) {
    issues.push({
      detail: `Duplicate visible project names can make reporting hard to interpret. Examples: ${formatDataQualitySamples(duplicateProjectNames)}.`,
      id: "duplicate-project-names",
      severity: "warning",
      title: "Duplicate project names"
    });
  }

  if (missingProjectManagerProjects.length > 0) {
    issues.push({
      detail: `${missingProjectManagerProjects.length} visible project${missingProjectManagerProjects.length === 1 ? "" : "s"} are missing a NetSuite Project Manager value. Examples: ${formatDataQualitySamples(missingProjectManagerProjects.map((project) => project.name))}.`,
      id: "missing-project-manager",
      severity: "warning",
      title: "Missing PM mapping on projects"
    });
  }

  if (duplicatePayItemProjects.length > 0) {
    issues.push({
      detail: `Duplicate pay item codes were found after sync. Examples: ${formatDataQualitySamples(duplicatePayItemProjects)}.`,
      id: "duplicate-pay-items",
      severity: "warning",
      title: "Duplicate pay item codes"
    });
  }

  if (duplicateCrewNames.length > 0) {
    issues.push({
      detail: `Duplicate crew/subcontractor names can split reporting. Examples: ${formatDataQualitySamples(duplicateCrewNames)}.`,
      id: "duplicate-crew-names",
      severity: "warning",
      title: "Possible duplicate crew records"
    });
  }

  if (subcontractorsMissingVendor.length > 0) {
    issues.push({
      detail: `${subcontractorsMissingVendor.length} subcontractor record${subcontractorsMissingVendor.length === 1 ? "" : "s"} were not tied to a NetSuite vendor. Examples: ${formatDataQualitySamples(subcontractorsMissingVendor.map(getCrewDisplayName))}.`,
      id: "subcontractors-missing-vendor",
      severity: "warning",
      title: "Subcontractors not tied to NetSuite vendors"
    });
  }

  if (pmUsersWithoutMapping.length > 0) {
    issues.push({
      detail: `${pmUsersWithoutMapping.length} active PM user${pmUsersWithoutMapping.length === 1 ? "" : "s"} do not have a NetSuite Project Manager connection. Examples: ${formatDataQualitySamples(pmUsersWithoutMapping.map(formatUserName))}.`,
      id: "pm-users-without-mapping",
      severity: "warning",
      title: "PM users missing NetSuite PM connection"
    });
  }

  if (projects.length === 0) {
    issues.push({
      detail: "No project catalog jobs are available. Run Sync New Projects, Sync All Projects, or Add/Update Project.",
      id: "no-cached-projects",
      severity: "info",
      title: "No project catalog jobs"
    });
  }

  return issues;
}

function findDuplicateValues(values: string[]) {
  const counts = new Map<string, { count: number; label: string }>();

  for (const value of values) {
    const label = value.trim();
    const key = normalizeCrewName(label);

    if (!key) {
      continue;
    }

    const current = counts.get(key);

    counts.set(key, {
      count: (current?.count ?? 0) + 1,
      label: current?.label ?? label
    });
  }

  return Array.from(counts.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.label)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

function formatDataQualitySamples(values: string[], maxItems = 4) {
  const samples = values.slice(0, maxItems);
  const remainingCount = values.length - samples.length;

  return `${samples.join(", ")}${remainingCount > 0 ? `, +${remainingCount} more` : ""}`;
}

function getCrewDisplayName(member: CrewMember) {
  return member.laborType === "subcontractor" ? member.subcontractorCompany || member.name : member.name;
}

function normalizeCrewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
