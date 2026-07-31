import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import {
  loadDatabaseNetSuiteVendors,
  saveDatabaseNetSuiteVendorBlacklist,
  syncDatabaseNetSuiteVendors
} from "@/features/time-allocation/lib/api-client";
import {
  filterNetSuiteVendors,
  formatNetSuiteVendorOption,
  normalizeVendorSearchText
} from "@/features/time-allocation/lib/crew-entry-helpers";
import type {
  NetSuiteVendor,
  SyncLogEntry,
  VendorBlacklistById
} from "@/features/time-allocation/types";

type AdminMaintenanceNotice = { message: string; status: "success" | "error" } | null;

type NetSuiteVendorData = {
  allVendors?: NetSuiteVendor[];
  syncedAt?: string | null;
  vendorBlacklistById?: VendorBlacklistById;
  vendors: NetSuiteVendor[];
};

export function useNetSuiteVendors({
  currentUser,
  onAdminMaintenanceNotice,
  onSyncLog,
  userIsOffline
}: {
  currentUser: AuthUser | null;
  onAdminMaintenanceNotice: (notice: AdminMaintenanceNotice) => void;
  onSyncLog: (entry: Omit<SyncLogEntry, "id" | "createdAt">) => void;
  userIsOffline: boolean;
}) {
  const [netSuiteVendors, setNetSuiteVendors] = useState<NetSuiteVendor[]>([]);
  const [allNetSuiteVendors, setAllNetSuiteVendors] = useState<NetSuiteVendor[]>([]);
  const [netSuiteVendorBlacklistById, setNetSuiteVendorBlacklistById] = useState<VendorBlacklistById>({});
  const [netSuiteVendorsSyncedAt, setNetSuiteVendorsSyncedAt] = useState<string | null>(null);
  const [loadingNetSuiteVendors, setLoadingNetSuiteVendors] = useState(false);
  const [syncingNetSuiteVendors, setSyncingNetSuiteVendors] = useState(false);
  const [subcontractorVendorSearch, setSubcontractorVendorSearch] = useState("");
  const [selectedSubcontractorVendorId, setSelectedSubcontractorVendorId] = useState("");

  const applyNetSuiteVendorData = useCallback((data: NetSuiteVendorData) => {
    const visibleVendors = data.vendors;
    const allVendors = data.allVendors ?? visibleVendors;
    const vendorIds = new Set(visibleVendors.map((vendor) => vendor.id));

    setNetSuiteVendors(visibleVendors);
    setAllNetSuiteVendors(allVendors);
    setNetSuiteVendorBlacklistById(data.vendorBlacklistById ?? {});
    setNetSuiteVendorsSyncedAt(data.syncedAt ?? null);
    setSelectedSubcontractorVendorId((currentVendorId) => {
      const nextVendorId = vendorIds.has(currentVendorId) ? currentVendorId : "";
      const selectedVendor = visibleVendors.find((vendor) => vendor.id === nextVendorId);

      setSubcontractorVendorSearch((currentSearch) =>
        selectedVendor ? formatNetSuiteVendorOption(selectedVendor) : currentVendorId ? "" : currentSearch
      );

      return nextVendorId;
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNetSuiteVendors([]);
      setAllNetSuiteVendors([]);
      setNetSuiteVendorBlacklistById({});
      setNetSuiteVendorsSyncedAt(null);
      setSubcontractorVendorSearch("");
      setSelectedSubcontractorVendorId("");
      return;
    }

    let cancelled = false;

    async function loadVendors() {
      setLoadingNetSuiteVendors(true);

      try {
        const data = await loadDatabaseNetSuiteVendors();

        if (!cancelled && data) {
          applyNetSuiteVendorData(data);
        }
      } finally {
        if (!cancelled) {
          setLoadingNetSuiteVendors(false);
        }
      }
    }

    void loadVendors();

    return () => {
      cancelled = true;
    };
  }, [applyNetSuiteVendorData, currentUser]);

  const selectedSubcontractorVendor = useMemo(
    () => netSuiteVendors.find((vendor) => vendor.id === selectedSubcontractorVendorId) ?? null,
    [netSuiteVendors, selectedSubcontractorVendorId]
  );
  const filteredSubcontractorVendors = useMemo(
    () => filterNetSuiteVendors(netSuiteVendors, subcontractorVendorSearch).slice(0, 20),
    [netSuiteVendors, subcontractorVendorSearch]
  );

  async function syncNetSuiteVendorDirectory() {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (userIsOffline) {
      onAdminMaintenanceNotice({
        message: "You appear to be offline. Reconnect before saving, syncing, or uploading.",
        status: "error"
      });
      return;
    }

    setSyncingNetSuiteVendors(true);
    onAdminMaintenanceNotice(null);

    try {
      const data = await syncDatabaseNetSuiteVendors();

      applyNetSuiteVendorData(data);
      onAdminMaintenanceNotice({
        message: `Loaded ${data.vendors.length} NetSuite vendor${data.vendors.length === 1 ? "" : "s"} with default addresses.`,
        status: "success"
      });
      onSyncLog({
        action: "Get Vendors",
        status: "success",
        message: `Loaded ${data.vendors.length} NetSuite vendor${data.vendors.length === 1 ? "" : "s"}.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync NetSuite vendors.";

      onAdminMaintenanceNotice({
        message,
        status: "error"
      });
      onSyncLog({
        action: "Get Vendors",
        status: "error",
        message
      });
    } finally {
      setSyncingNetSuiteVendors(false);
    }
  }

  function toggleVendorBlacklist(vendorId: string, blacklisted: boolean) {
    const nextBlacklist = {
      ...netSuiteVendorBlacklistById
    };

    if (blacklisted) {
      nextBlacklist[vendorId] = true;
    } else {
      delete nextBlacklist[vendorId];
    }

    const visibleVendors = allNetSuiteVendors.filter((vendor) => !nextBlacklist[vendor.id]);

    setNetSuiteVendorBlacklistById(nextBlacklist);
    setNetSuiteVendors(visibleVendors);
    if (blacklisted && selectedSubcontractorVendorId === vendorId) {
      setSelectedSubcontractorVendorId("");
      setSubcontractorVendorSearch("");
    }

    void saveDatabaseNetSuiteVendorBlacklist(vendorId, blacklisted)
      .then((data) => {
        if (data) {
          applyNetSuiteVendorData(data);
        }
      })
      .catch((error) => {
        onAdminMaintenanceNotice({
          message: error instanceof Error ? error.message : "Vendor blacklist saved locally, but did not sync.",
          status: "error"
        });
      });
  }

  function updateSubcontractorVendorSearch(value: string) {
    setSubcontractorVendorSearch(value);

    const normalizedValue = normalizeVendorSearchText(value);
    const exactMatch = netSuiteVendors.find((vendor) =>
      [formatNetSuiteVendorOption(vendor), vendor.name, vendor.entityId ?? ""].some(
        (candidate) => normalizeVendorSearchText(candidate) === normalizedValue
      )
    );
    setSelectedSubcontractorVendorId(exactMatch?.id ?? "");
  }

  function selectSubcontractorVendor(vendor: NetSuiteVendor) {
    setSelectedSubcontractorVendorId(vendor.id);
    setSubcontractorVendorSearch(formatNetSuiteVendorOption(vendor));
  }

  function clearSubcontractorVendorSelection() {
    setSelectedSubcontractorVendorId("");
    setSubcontractorVendorSearch("");
  }

  return {
    allNetSuiteVendors,
    clearSubcontractorVendorSelection,
    filteredSubcontractorVendors,
    loadingNetSuiteVendors,
    netSuiteVendorBlacklistById,
    netSuiteVendors,
    netSuiteVendorsSyncedAt,
    selectSubcontractorVendor,
    selectedSubcontractorVendor,
    selectedSubcontractorVendorId,
    subcontractorVendorSearch,
    syncingNetSuiteVendors,
    syncNetSuiteVendorDirectory,
    toggleVendorBlacklist,
    updateSubcontractorVendorSearch
  };
}
