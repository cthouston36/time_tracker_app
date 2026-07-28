import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/audit-log";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const auditLog = await listAuditLogs({
    action: requestUrl.searchParams.get("action") ?? undefined,
    actorUserId: requestUrl.searchParams.get("actorUserId") ?? undefined,
    endDate: requestUrl.searchParams.get("endDate") ?? undefined,
    limit: Number(requestUrl.searchParams.get("limit") ?? 200),
    projectId: requestUrl.searchParams.get("projectId") ?? undefined,
    startDate: requestUrl.searchParams.get("startDate") ?? undefined,
    targetId: requestUrl.searchParams.get("targetId") ?? undefined,
    targetType: requestUrl.searchParams.get("targetType") ?? undefined
  });

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
