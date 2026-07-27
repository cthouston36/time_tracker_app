import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { readCachedNetSuiteVendors, syncNetSuiteVendors } from "@/lib/netsuite/vendors";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading NetSuite vendors." }, { status: 401 });
  }

  const cache = await readCachedNetSuiteVendors();

  if (!cache) {
    return NextResponse.json({
      databaseConfigured: false,
      vendors: []
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    syncedAt: cache.syncedAt,
    vendors: cache.vendors
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await syncNetSuiteVendors();

    await recordAuditLog({
      action: "netsuite.vendors_synced",
      actor: user,
      metadata: {
        syncedAt: result.syncedAt,
        vendorCount: result.vendors.length
      },
      targetType: "netsuite_vendor_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      databaseConfigured: true,
      ok: true,
      syncedAt: result.syncedAt,
      vendors: result.vendors
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync NetSuite vendors.";

    await recordAuditLog({
      action: "netsuite.vendors_sync_failed",
      actor: user,
      metadata: {
        error: message
      },
      targetType: "netsuite_vendor_sync",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json(
      {
        databaseConfigured: true,
        error: message,
        ok: false,
        vendors: []
      },
      { status: 502 }
    );
  }
}
