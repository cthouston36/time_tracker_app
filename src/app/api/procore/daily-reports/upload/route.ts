import { NextRequest, NextResponse } from "next/server";
import { requestUserCanAccessProjectId } from "@/lib/auth/project-access-server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { isIsoDate } from "@/lib/day-key";
import { upsertDailyReportUpload } from "@/lib/daily-report-store";
import { getProjects } from "@/lib/project-catalog/projects";
import { enqueueTask } from "@/lib/task-queue";
import { scheduleQueuedTaskProcessing } from "@/lib/task-queue-scheduler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before uploading daily reports." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const projectId = readProjectId(payload);
    const projects = await getProjects();
    const project = projects.find((candidate) => candidate.id === projectId);

    if (!projectId || !project) {
      return NextResponse.json({ error: "Provide a valid project." }, { status: 400 });
    }

    if (!isIsoDate(readDate(payload))) {
      return NextResponse.json({ error: "Provide a valid date." }, { status: 400 });
    }

    if (!(await requestUserCanAccessProjectId(user, projectId, projects))) {
      return NextResponse.json({ error: "You do not have access to upload daily reports for this project." }, { status: 403 });
    }

    const fileName = buildDailyReportFileName(project.name, readDate(payload));
    const queuedUpload = {
      attemptedAt: new Date().toISOString(),
      fileName,
      folderPath: "Daily Reports",
      status: "queued"
    };
    const queuedUploadResult = await upsertDailyReportUpload(project.id, readDate(payload), queuedUpload);

    if (queuedUploadResult === null) {
      return NextResponse.json({ error: "Database is not configured for queued daily report uploads." }, { status: 503 });
    }

    if (queuedUploadResult === false) {
      return NextResponse.json({ error: "Unable to queue the daily report upload status." }, { status: 400 });
    }

    const task = await enqueueTask({
      actorName: formatUserName(user),
      actorUserId: user.id,
      dedupeKey: `daily-report-upload:${project.id}:${readDate(payload)}`,
      maxAttempts: 6,
      payload: {
        ...payload,
        actor: user,
        project,
        projectId
      },
      priority: 20,
      targetId: readProjectDayTargetId({ ...payload, projectId }),
      targetType: "project_day",
      taskType: "procore.daily_report_upload"
    });

    if (!task) {
      return NextResponse.json({ error: "Database is not configured for queued daily report uploads." }, { status: 503 });
    }

    scheduleQueuedTaskProcessing({
      limit: 3,
      timeBudgetMs: 25_000
    });

    await recordAuditLog({
      action: "procore.daily_report_upload_queued",
      actor: user,
      metadata: {
        fileName,
        projectId,
        taskId: task.id
      },
      targetId: readProjectDayTargetId({ ...payload, projectId }),
      targetType: "project_day",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json(
      {
        fileName,
        folderPath: "Daily Reports",
        queued: true,
        status: "queued",
        taskId: task.id
      },
      { status: 202 }
    );
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

function readDate(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const date = (payload as { date?: unknown }).date;

  return typeof date === "string" ? date.trim() : "";
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

function buildDailyReportFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";

  return `${date}_${projectNumber.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")}_Daily_Report.pdf`;
}

function formatUserName(user: { firstName: string; lastName: string; id: string }) {
  return `${user.firstName} ${user.lastName}`.trim() || user.id;
}
