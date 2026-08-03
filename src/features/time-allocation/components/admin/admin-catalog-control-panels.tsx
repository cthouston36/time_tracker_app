"use client";

import { useState } from "react";
import { Archive, ListChecks } from "lucide-react";
import type { Project } from "@/lib/domain/types";
import { sortProjectsByName } from "@/features/time-allocation/lib/selectors";
import type { NetSuiteVendor, ProjectArchiveById, ProjectBlacklistById, VendorBlacklistById } from "@/features/time-allocation/types";

export function ProjectBlacklistPanel({
  onToggleProject,
  projectBlacklistById,
  projects
}: {
  onToggleProject: (projectId: string, blacklisted: boolean) => void;
  projectBlacklistById: ProjectBlacklistById;
  projects: Project[];
}) {
  const sortedProjects = sortProjectsByName(projects);
  const blacklistedProjectCount = sortedProjects.filter((project) => projectBlacklistById[project.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Project Blacklist ({blacklistedProjectCount})
      </summary>
      {sortedProjects.length === 0 ? (
        <div className="field-note">No project catalog jobs are available to blacklist yet.</div>
      ) : (
        <>
          <div className="field-note">Blacklisted projects stay cached, but are hidden from entry screens and reports.</div>
          <div className="project-blacklist-list">
            {sortedProjects.map((project) => (
              <label className="project-blacklist-row" key={project.id}>
                <input
                  checked={Boolean(projectBlacklistById[project.id])}
                  onChange={(event) => onToggleProject(project.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

export function ProjectArchivePanel({
  onToggleProject,
  projectArchiveById,
  projects
}: {
  onToggleProject: (projectId: string, archived: boolean) => void;
  projectArchiveById: ProjectArchiveById;
  projects: Project[];
}) {
  const sortedProjects = sortProjectsByName(projects);
  const archivedProjectCount = sortedProjects.filter((project) => projectArchiveById[project.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <Archive aria-hidden="true" size={16} />
        Project Archive ({archivedProjectCount})
      </summary>
      {sortedProjects.length === 0 ? (
        <div className="field-note">No project catalog jobs are available to archive yet.</div>
      ) : (
        <>
          <div className="field-note">
            Archived projects stay cached and keep their history, but are hidden from normal entry screens and reports.
          </div>
          <div className="project-blacklist-list">
            {sortedProjects.map((project) => (
              <label className="project-blacklist-row" key={project.id}>
                <input
                  checked={Boolean(projectArchiveById[project.id])}
                  onChange={(event) => onToggleProject(project.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

export function VendorBlacklistPanel({
  onToggleVendor,
  vendorBlacklistById,
  vendors
}: {
  onToggleVendor: (vendorId: string, blacklisted: boolean) => void;
  vendorBlacklistById: VendorBlacklistById;
  vendors: NetSuiteVendor[];
}) {
  const [searchText, setSearchText] = useState("");
  const sortedVendors = sortNetSuiteVendors(vendors);
  const visibleVendors = filterNetSuiteVendors(sortedVendors, searchText);
  const blacklistedVendorCount = sortedVendors.filter((vendor) => vendorBlacklistById[vendor.id]).length;

  return (
    <details className="project-blacklist">
      <summary>
        <ListChecks aria-hidden="true" size={16} />
        Vendor Blacklist ({blacklistedVendorCount})
      </summary>
      {sortedVendors.length === 0 ? (
        <div className="field-note">No cached NetSuite vendors are available to blacklist yet.</div>
      ) : (
        <>
          <div className="field-note">Blacklisted vendors stay cached, but are hidden from subcontractor assignment.</div>
          <input
            className="compact-search-input"
            placeholder="Search vendors"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="project-blacklist-list">
            {visibleVendors.length === 0 ? (
              <div className="field-note">No vendors match that search.</div>
            ) : (
              visibleVendors.map((vendor) => (
                <label className="project-blacklist-row" key={vendor.id}>
                  <input
                    checked={Boolean(vendorBlacklistById[vendor.id])}
                    onChange={(event) => onToggleVendor(vendor.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{formatNetSuiteVendorOption(vendor)}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </details>
  );
}

function filterNetSuiteVendors(vendors: NetSuiteVendor[], searchText: string) {
  const normalizedSearchText = normalizeVendorSearchText(searchText);

  if (!normalizedSearchText) {
    return sortNetSuiteVendors(vendors);
  }

  return sortNetSuiteVendors(
    vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.entityId ?? "",
        vendor.companyName ?? "",
        vendor.defaultAddress,
        formatNetSuiteVendorOption(vendor)
      ].some((value) => normalizeVendorSearchText(value).includes(normalizedSearchText))
    )
  );
}

function sortNetSuiteVendors(vendors: NetSuiteVendor[]) {
  return [...vendors].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
      (left.entityId ?? "").localeCompare(right.entityId ?? "", undefined, { numeric: true, sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
  );
}

function formatNetSuiteVendorOption(vendor: NetSuiteVendor) {
  return vendor.entityId && vendor.entityId !== vendor.name ? `${vendor.name} (${vendor.entityId})` : vendor.name;
}

function normalizeVendorSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
