import type { NetSuiteVendor, VendorBlacklistById } from "@/features/time-allocation/types";
import { readApiJson } from "@/features/time-allocation/lib/api-utils";

type NetSuiteVendorsResponse = {
  allVendors?: NetSuiteVendor[];
  databaseConfigured?: boolean;
  error?: string;
  ok?: boolean;
  syncedAt?: string | null;
  vendorBlacklistById?: VendorBlacklistById;
  vendors?: NetSuiteVendor[];
};

export async function loadDatabaseNetSuiteVendors() {
  try {
    const response = await fetch("/api/netsuite/vendors", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return buildNetSuiteVendorResult(data);
  } catch {
    return null;
  }
}

export async function syncDatabaseNetSuiteVendors() {
  const response = await fetch("/api/netsuite/vendors", {
    method: "POST"
  });
  const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to sync NetSuite vendors.");
  }

  return buildNetSuiteVendorResult(data);
}

export async function saveDatabaseNetSuiteVendorBlacklist(vendorId: string, blacklisted: boolean) {
  const response = await fetch("/api/netsuite/vendors", {
    body: JSON.stringify({
      blacklisted,
      vendorId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as NetSuiteVendorsResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save NetSuite vendor blacklist.");
  }

  return data.databaseConfigured === false ? null : buildNetSuiteVendorResult(data);
}

function buildNetSuiteVendorResult(data: NetSuiteVendorsResponse) {
  return {
    allVendors: data.allVendors ?? data.vendors ?? [],
    syncedAt: data.syncedAt ?? null,
    vendorBlacklistById: data.vendorBlacklistById ?? {},
    vendors: data.vendors ?? []
  };
}
