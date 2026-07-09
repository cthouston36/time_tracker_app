import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { uploadDailyReportToProcore } from "@/lib/procore/documents";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before uploading daily reports." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await uploadDailyReportToProcore(payload);

    await recordAuditLog({
      action: "procore.daily_report_uploaded",
      actor: user,
      metadata: {
        companyId: result.companyId,
        fileName: result.fileName,
        folderId: result.folderId,
        folderPath: result.folderPath,
        folderUrl: result.folderUrl,
        procoreFileId: result.procoreFileId,
        projectId: readProjectId(payload)
      },
      targetId: readProjectDayTargetId(payload),
      targetType: "project_day",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload daily report to Procore.";

    await recordAuditLog({
      action: "procore.daily_report_upload_failed",
      actor: user,
      metadata: {
        error: message
      },
      targetType: "project_day",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function readProjectId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const value = (payload as { project?: { id?: unknown }; projectId?: unknown }).projectId ?? (payload as { project?: { id?: unknown } }).project?.id;

  return typeof value === "string" ? value : undefined;
}

function readProjectDayTargetId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const projectId = readProjectId(payload);
  const date = (payload as { date?: unknown }).date;

  if (!projectId || typeof date !== "string") {
    return projectId;
  }

  return `${projectId}|${date}`;
}
