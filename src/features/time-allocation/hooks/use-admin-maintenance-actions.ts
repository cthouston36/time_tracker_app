import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import {
  clearDatabaseProjectCatalog,
  clearDatabaseStagingOperationalData
} from "@/features/time-allocation/lib/api-client";
import type { ConfirmationOptions } from "@/features/time-allocation/hooks/use-confirmation-dialog";

export type AdminMaintenanceNotice = { message: string; status: "success" | "error" } | null;

type AdminMaintenanceActionsOptions = {
  confirmAction: (options: ConfirmationOptions) => Promise<boolean>;
  currentUser: AuthUser | null;
  onProjectCatalogCleared: () => void;
  onStagingOperationalDataCleared: () => void;
  userIsOffline: boolean;
};

export function useAdminMaintenanceActions({
  confirmAction,
  currentUser,
  onProjectCatalogCleared,
  onStagingOperationalDataCleared,
  userIsOffline
}: AdminMaintenanceActionsOptions) {
  const [adminMaintenanceNotice, setAdminMaintenanceNotice] = useState<AdminMaintenanceNotice>(null);
  const [clearingProjectCatalog, setClearingProjectCatalog] = useState(false);
  const [clearingStagingData, setClearingStagingData] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      setClearingStagingData(false);
      setAdminMaintenanceNotice(null);
    }
  }, [currentUser?.role]);

  const shouldBlockOfflineMaintenance = useCallback(() => {
    if (!userIsOffline) {
      return false;
    }

    setAdminMaintenanceNotice({
      message: "You appear to be offline. Reconnect before saving, syncing, or uploading.",
      status: "error"
    });
    return true;
  }, [userIsOffline]);

  const clearStagingOperationalData = useCallback(async () => {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineMaintenance()) {
      return;
    }

    if (
      !(await confirmAction({
        cancelLabel: "Keep staging data",
        confirmLabel: "Clear staging data",
        description: "Clear staging daily data?",
        details: [
          "This permanently removes daily pay item entries, submitted/draft day statuses, daily notes, daily reports, daily report upload status, and all crew members/crew project assignments.",
          "It keeps user profiles/passwords, project catalog jobs/pay items, sync state/log, project blacklist, and My Projects."
        ],
        title: "Clear staging daily data",
        tone: "danger"
      }))
    ) {
      return;
    }

    setClearingStagingData(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await clearDatabaseStagingOperationalData();

      onStagingOperationalDataCleared();
      setAdminMaintenanceNotice({
        message: data.databaseConfigured
          ? "Staging data cleared. Users, project catalog jobs/pay items, sync state, blacklist, and My Projects were preserved."
          : "Local staging data cleared.",
        status: "success"
      });
    } catch (error) {
      setAdminMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to clear staging data.",
        status: "error"
      });
    } finally {
      setClearingStagingData(false);
    }
  }, [
    confirmAction,
    currentUser?.role,
    onStagingOperationalDataCleared,
    shouldBlockOfflineMaintenance
  ]);

  const clearProjectCatalogData = useCallback(async () => {
    if (currentUser?.role !== "admin") {
      return;
    }

    if (shouldBlockOfflineMaintenance()) {
      return;
    }

    if (
      !(await confirmAction({
        cancelLabel: "Keep project catalog",
        confirmLabel: "Clear catalog",
        description: "Clear project catalog jobs and pay items?",
        details: [
          "This permanently removes the current project catalog jobs/pay items and the legacy catalog fallback.",
          "It keeps users, passwords, daily entries, daily reports, crew records, sync log, project blacklist, and My Projects."
        ],
        title: "Clear project catalog",
        tone: "danger"
      }))
    ) {
      return;
    }

    setClearingProjectCatalog(true);
    setAdminMaintenanceNotice(null);

    try {
      const data = await clearDatabaseProjectCatalog();
      const cleared = data.cleared;
      const projectCount = cleared?.projects ?? 0;
      const payItemCount = cleared?.payItems ?? 0;

      onProjectCatalogCleared();
      setAdminMaintenanceNotice({
        message: `Project catalog cleared. Removed ${projectCount} job${projectCount === 1 ? "" : "s"} and ${payItemCount} pay item${payItemCount === 1 ? "" : "s"}. Sync from NetSuite to reload jobs.`,
        status: "success"
      });
    } catch (error) {
      setAdminMaintenanceNotice({
        message: error instanceof Error ? error.message : "Unable to clear the project catalog.",
        status: "error"
      });
    } finally {
      setClearingProjectCatalog(false);
    }
  }, [
    confirmAction,
    currentUser?.role,
    onProjectCatalogCleared,
    shouldBlockOfflineMaintenance
  ]);

  return {
    adminMaintenanceNotice,
    clearingProjectCatalog,
    clearingStagingData,
    clearProjectCatalogData,
    clearStagingOperationalData,
    setAdminMaintenanceNotice
  };
}
