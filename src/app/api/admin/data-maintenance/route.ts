import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import {
  cleanupDataMaintenanceRecords,
  readDataMaintenanceSummary,
  rebuildDataMaintenanceRollups
} from "@/lib/admin/data-maintenance";

export const runtime = "nodejs";

type MaintenanceAction = "cleanup_records" | "rebuild_rollups" | "run_all";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const summary = await readDataMaintenanceSummary();

  if (!summary) {
    return NextResponse.json({
      databaseConfigured: false,
      error: "Database is not configured for data maintenance."
    });
  }

  return NextResponse.json({
    ok: true,
    ...summary
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as { action?: string };
  const action = normalizeAction(body.action);

  if (!action) {
    return NextResponse.json({ error: "Invalid maintenance action." }, { status: 400 });
  }

  const cleanupResult = action === "cleanup_records" || action === "run_all" ? await cleanupDataMaintenanceRecords() : null;
  const rebuiltRollups = action === "rebuild_rollups" || action === "run_all" ? await rebuildDataMaintenanceRollups() : null;

  if ((action === "cleanup_records" || action === "run_all") && !cleanupResult) {
    return NextResponse.json({ error: "Database is not configured for cleanup." }, { status: 503 });
  }

  if ((action === "rebuild_rollups" || action === "run_all") && !rebuiltRollups) {
    return NextResponse.json({ error: "Database is not configured for report rollups." }, { status: 503 });
  }

  const summary = await readDataMaintenanceSummary();

  await recordAuditLog({
    action: `admin.data_maintenance.${action}`,
    actor: currentUser,
    metadata: {
      cleanupResult,
      rebuiltRollups
    },
    targetType: "data_maintenance",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    cleanupResult,
    databaseConfigured: true,
    ok: true,
    rebuiltRollups,
    summary
  });
}

function normalizeAction(action: unknown): MaintenanceAction | null {
  if (action === "cleanup_records" || action === "rebuild_rollups" || action === "run_all") {
    return action;
  }

  return null;
}
