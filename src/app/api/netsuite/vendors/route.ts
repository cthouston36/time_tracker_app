import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { readCachedNetSuiteVendors, setNetSuiteVendorBlacklist, syncNetSuiteVendors } from "@/lib/netsuite/vendors";

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
    ...(user.role === "admin"
      ? {
          allVendors: cache.allVendors,
          vendorBlacklistById: cache.vendorBlacklistById
        }
      : {}),
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
    const cache = await readCachedNetSuiteVendors();

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
      allVendors: cache?.allVendors ?? result.vendors,
      databaseConfigured: true,
      ok: true,
      syncedAt: cache?.syncedAt ?? result.syncedAt,
      vendorBlacklistById: cache?.vendorBlacklistById ?? {},
      vendors: cache?.vendors ?? result.vendors
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

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    blacklisted?: boolean;
    vendorId?: string;
  };
  const vendorId = body.vendorId?.trim() ?? "";

  if (!vendorId || typeof body.blacklisted !== "boolean") {
    return NextResponse.json({ error: "Provide vendorId and blacklisted." }, { status: 400 });
  }

  const result = await setNetSuiteVendorBlacklist(vendorId, body.blacklisted);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid NetSuite vendor blacklist payload." }, { status: 400 });
  }

  const cache = await readCachedNetSuiteVendors();

  await recordAuditLog({
    action: body.blacklisted ? "netsuite.vendor_blacklisted" : "netsuite.vendor_unblacklisted",
    actor: user,
    metadata: {
      blacklisted: body.blacklisted
    },
    targetId: vendorId,
    targetType: "netsuite_vendor",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    allVendors: cache?.allVendors ?? [],
    databaseConfigured: true,
    ok: true,
    syncedAt: cache?.syncedAt ?? null,
    vendorBlacklistById: cache?.vendorBlacklistById ?? {},
    vendors: cache?.vendors ?? []
  });
}
