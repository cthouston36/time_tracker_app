import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/audit-log";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const limit = Number(requestUrl.searchParams.get("limit") ?? 200);
  const auditLog = await listAuditLogs(limit);

  if (!auditLog) {
    return NextResponse.json({
      auditLog: [],
      databaseConfigured: false
    });
  }

  return NextResponse.json({
    auditLog,
    databaseConfigured: true
  });
}
