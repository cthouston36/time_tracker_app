import { recordAuditLog } from "@/lib/audit-log";
import type { AuthUser } from "@/lib/auth/types";
import { isIsoDate } from "@/lib/day-key";
import type { Project } from "@/lib/domain/types";
import { upsertDailyReportUpload } from "@/lib/daily-report-store";
import {
  countReservedJobImageUploadSlots,
  upsertJobImageUploads,
  type StoredJobImageUpload
} from "@/lib/job-image-store";
import { syncAllProjectsFromNetSuite, syncProjectsFromNetSuite, type NetSuiteSyncSummary } from "@/lib/netsuite/projects";
import { syncNetSuiteVendors } from "@/lib/netsuite/vendors";
import { uploadDailyReportToProcore, uploadJobImagesToProcore, type JobImageUploadInput } from "@/lib/procore/documents";
import { readProjectCatalog } from "@/lib/project-catalog/cache";
import { insertSyncLogEntry, readProjectControls, type StoredSyncLogEntry } from "@/lib/project-controls-store";
import { claimQueuedTasks, completeTask, failTask, type TaskQueueTask } from "@/lib/task-queue";
import { buildDailyReportFileName, buildJobImageFileName } from "@/lib/file-names";
import { isRecord } from "@/lib/records";

type ProcessQueuedTasksOptions = {
  limit?: number;
  timeBudgetMs?: number;
};

type ProcessQueuedTasksResult = {
  completed: number;
  failed: number;
  processed: number;
  retried: number;
  tasks: Array<{
    error?: string;
    id: string;
    status: "completed" | "failed" | "retried";
    taskType: string;
  }>;
};

const SYSTEM_ACTOR: AuthUser = {
  firstName: "System",
  id: "system",
  lastName: "Queue",
  role: "admin"
};
const DEFAULT_PROCORE_QUEUE_TASK_DELAY_MS = 1_250;

export async function processQueuedTasks(options: ProcessQueuedTasksOptions = {}): Promise<ProcessQueuedTasksResult | null> {
  const startedAt = Date.now();
  const timeBudgetMs = Math.min(Math.max(Math.trunc(options.timeBudgetMs ?? 45_000), 5_000), 55_000);
  const workerId = `worker-${crypto.randomUUID()}`;
  const tasks = await claimQueuedTasks({
    limit: options.limit ?? 5,
    workerId
  });

  if (!tasks) {
    return null;
  }

  const result: ProcessQueuedTasksResult = {
    completed: 0,
    failed: 0,
    processed: 0,
    retried: 0,
    tasks: []
  };

  for (const task of tasks) {
    if (Date.now() - startedAt > timeBudgetMs) {
      break;
    }

    try {
      const taskResult = await processTask(task);

      await completeTask(task.id, taskResult, {
        clearPayload: task.taskType.startsWith("procore.")
      });
      result.completed += 1;
      result.processed += 1;
      result.tasks.push({
        id: task.id,
        status: "completed",
        taskType: task.taskType
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queued task failed.";
      const failure = await failTask(task, message);

      await recordTaskFailure(task, message, Boolean(failure?.retrying));

      if (failure?.retrying) {
        result.retried += 1;
        result.tasks.push({
          error: message,
          id: task.id,
          status: "retried",
          taskType: task.taskType
        });
      } else {
        result.failed += 1;
        result.tasks.push({
          error: message,
          id: task.id,
          status: "failed",
          taskType: task.taskType
        });
      }

      result.processed += 1;
    }

    if (task.taskType.startsWith("procore.") && Date.now() - startedAt < timeBudgetMs) {
      await delay(readPositiveInteger(process.env.PROCORE_QUEUE_TASK_DELAY_MS) ?? DEFAULT_PROCORE_QUEUE_TASK_DELAY_MS);
    }
  }

  return result;
}

async function processTask(task: TaskQueueTask) {
  switch (task.taskType) {
    case "netsuite.sync_all":
      return processNetSuiteSyncTask(task, "all");
    case "netsuite.sync_new":
      return processNetSuiteSyncTask(task, "new");
    case "netsuite.vendors_sync":
      return processNetSuiteVendorSyncTask(task);
    case "procore.daily_report_upload":
      return processDailyReportUploadTask(task);
    case "procore.job_image_upload":
      return processJobImageUploadTask(task);
  }
}

async function processDailyReportUploadTask(task: TaskQueueTask) {
  const payload = task.payload;
  const actor = readActor(payload);
  const project = readProject(payload.project);
  const date = readString(payload.date);

  if (!project || !isIsoDate(date) || !isRecord(payload.report)) {
    throw new Error("Queued daily report upload is missing required project, date, or report data.");
  }

  const fileName = buildDailyReportFileName(project.name, date);
  const now = new Date().toISOString();
  const queuedStatusResult = await upsertDailyReportUpload(project.id, date, {
    attemptedAt: now,
    fileName,
    folderPath: "Daily Reports",
    status: "processing"
  });

  if (queuedStatusResult === null) {
    throw new Error("Database is not configured for daily report upload tracking.");
  }

  const uploadResult = await uploadDailyReportToProcore({
    date,
    dayNotes: readRecord(payload.dayNotes),
    project,
    report: payload.report
  });

  await upsertDailyReportUpload(project.id, date, {
    companyId: uploadResult.companyId,
    fileName: uploadResult.fileName,
    folderId: uploadResult.folderId,
    folderPath: uploadResult.folderPath,
    folderUrl: uploadResult.folderUrl,
    procoreFileId: uploadResult.procoreFileId,
    status: "uploaded",
    uploadedAt: new Date().toISOString()
  });

  await recordAuditLog({
    action: "procore.daily_report_uploaded",
    actor,
    metadata: {
      companyId: uploadResult.companyId,
      fileName: uploadResult.fileName,
      folderId: uploadResult.folderId,
      folderPath: uploadResult.folderPath,
      folderUrl: uploadResult.folderUrl,
      procoreFileId: uploadResult.procoreFileId,
      projectId: project.id,
      taskId: task.id
    },
    targetId: `${project.id}|${date}`,
    targetType: "project_day"
  });

  return {
    fileName: uploadResult.fileName,
    folderId: uploadResult.folderId,
    projectId: project.id
  };
}

async function processJobImageUploadTask(task: TaskQueueTask) {
  const payload = task.payload;
  const actor = readActor(payload);
  const project = readProject(payload.project);
  const image = readQueuedJobImage(payload.image);
  const date = readString(payload.date);
  const uploadId = readString(payload.uploadId);
  const startingImageNumber = readPositiveInteger(payload.startingImageNumber) ?? 1;
  const fileName = readString(payload.fileName) || buildJobImageFileName({
    contentType: image?.contentType ?? "image/jpeg",
    date,
    imageNumber: startingImageNumber,
    originalFileName: image?.originalFileName ?? "job-image.jpg",
    projectName: project?.name ?? "Project"
  });

  if (!project || !image || !isIsoDate(date) || !uploadId) {
    throw new Error("Queued job image upload is missing required project, date, image, or upload ID data.");
  }

  const now = new Date().toISOString();
  await upsertJobImageUploads([
    {
      attemptedAt: now,
      caption: image.caption,
      clientId: image.clientId,
      contentType: image.contentType,
      date,
      fileName,
      fileSizeBytes: image.fileSizeBytes,
      folderPath: "Daily Reports/Job Images",
      id: uploadId,
      originalFileName: image.originalFileName,
      projectId: project.id,
      status: "processing",
      uploadedByName: formatActorName(actor),
      uploadedByUserId: actor.id
    }
  ]);

  const uploadInput: JobImageUploadInput = {
    caption: image.caption,
    clientId: image.clientId,
    contentType: image.contentType,
    file: new Uint8Array(Buffer.from(image.fileBase64, "base64")),
    fileSizeBytes: image.fileSizeBytes,
    originalFileName: image.originalFileName
  };
  const uploadResult = await uploadJobImagesToProcore({
    date,
    images: [uploadInput],
    project,
    startingImageNumber
  });
  const uploadedImage = uploadResult.uploads[0];

  if (!uploadedImage) {
    throw new Error("Procore did not return an image upload result.");
  }

  const storedUpload: StoredJobImageUpload = {
    attemptedAt: now,
    caption: uploadedImage.caption,
    clientId: uploadedImage.clientId,
    contentType: uploadedImage.contentType,
    date,
    error: uploadedImage.error,
    fileName: uploadedImage.fileName,
    fileSizeBytes: uploadedImage.fileSizeBytes,
    folderId: uploadedImage.folderId,
    folderPath: uploadedImage.folderPath,
    folderUrl: uploadedImage.folderUrl,
    id: uploadId,
    originalFileName: uploadedImage.originalFileName,
    procoreFileId: uploadedImage.procoreFileId,
    projectId: project.id,
    status: uploadedImage.status,
    uploadedAt: uploadedImage.status === "uploaded" ? new Date().toISOString() : undefined,
    uploadedByName: formatActorName(actor),
    uploadedByUserId: actor.id
  };

  await upsertJobImageUploads([storedUpload]);

  if (uploadedImage.status === "failed") {
    throw new Error(uploadedImage.error ?? "Unable to upload image to Procore.");
  }

  await recordAuditLog({
    action: "procore.job_image_uploaded",
    actor,
    metadata: {
      date,
      fileName: uploadedImage.fileName,
      folderId: uploadResult.folderId,
      folderPath: uploadResult.folderPath,
      folderUrl: uploadResult.folderUrl,
      projectId: project.id,
      procoreProjectId: uploadResult.projectId,
      taskId: task.id
    },
    targetId: `${project.id}|${date}`,
    targetType: "project_day"
  });

  return {
    fileName: uploadedImage.fileName,
    folderId: uploadedImage.folderId,
    projectId: project.id
  };
}

async function processNetSuiteSyncTask(task: TaskQueueTask, mode: "all" | "new") {
  const actor = readActor(task.payload);
  const syncResult = mode === "all" ? await syncAllProjectsFromNetSuite() : await syncProjectsFromNetSuite();
  const cache = await readProjectCatalog();
  const controls = await readProjectControls();
  const action = mode === "all" ? "Sync All Projects" : "Sync New Projects";
  const status = hasSyncWarnings(syncResult.summary) ? "warning" : "success";
  const message = buildNetSuiteSyncMessage(mode === "all" ? "Full sync" : "New project sync", syncResult.summary);
  const syncLogEntry: StoredSyncLogEntry = {
    action,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    message,
    status,
    summary: syncResult.summary
  };

  await insertSyncLogEntry(syncLogEntry);
  await recordAuditLog({
    action: mode === "all" ? "netsuite.sync_all_completed" : "netsuite.sync_new_completed",
    actor,
    metadata: {
      summary: syncResult.summary,
      syncedAt: cache?.syncedAt ?? null,
      taskId: task.id
    },
    targetType: "netsuite_sync"
  });

  return {
    projectArchiveCount: Object.keys(controls?.projectArchiveById ?? {}).length,
    projects: syncResult.projects.length,
    status,
    summary: syncResult.summary,
    syncedAt: cache?.syncedAt ?? null
  };
}

async function processNetSuiteVendorSyncTask(task: TaskQueueTask) {
  const actor = readActor(task.payload);
  const vendorResult = await syncNetSuiteVendors();
  const syncLogEntry: StoredSyncLogEntry = {
    action: readString(task.payload.actionName) || "Get Vendors",
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    message: `Loaded ${vendorResult.vendors.length} NetSuite vendor${vendorResult.vendors.length === 1 ? "" : "s"}.`,
    status: "success",
    summary: {
      synced: vendorResult.vendors.length,
      syncedAt: vendorResult.syncedAt
    }
  };

  await insertSyncLogEntry(syncLogEntry);
  await recordAuditLog({
    action: "netsuite.vendor_sync_completed",
    actor,
    metadata: {
      synced: vendorResult.vendors.length,
      syncedAt: vendorResult.syncedAt,
      taskId: task.id
    },
    targetType: "netsuite_sync"
  });

  return {
    synced: vendorResult.vendors.length,
    syncedAt: vendorResult.syncedAt
  };
}

async function recordTaskFailure(task: TaskQueueTask, message: string, retrying: boolean) {
  if (task.taskType === "procore.daily_report_upload") {
    const project = readProject(task.payload.project);
    const date = readString(task.payload.date);

    if (project && isIsoDate(date)) {
      await upsertDailyReportUpload(project.id, date, {
        attemptedAt: new Date().toISOString(),
        error: retrying ? `${message} Retrying automatically.` : message,
        fileName: buildDailyReportFileName(project.name, date),
        folderPath: "Daily Reports",
        status: retrying ? "queued" : "failed"
      });
    }
  }

  if (task.taskType === "procore.job_image_upload") {
    const project = readProject(task.payload.project);
    const image = readQueuedJobImage(task.payload.image);
    const date = readString(task.payload.date);
    const uploadId = readString(task.payload.uploadId);
    const fileName = readString(task.payload.fileName);

    if (project && image && isIsoDate(date) && uploadId && fileName) {
      await upsertJobImageUploads([
        {
          attemptedAt: new Date().toISOString(),
          caption: image.caption,
          clientId: image.clientId,
          contentType: image.contentType,
          date,
          error: retrying ? `${message} Retrying automatically.` : message,
          fileName,
          fileSizeBytes: image.fileSizeBytes,
          folderPath: "Daily Reports/Job Images",
          id: uploadId,
          originalFileName: image.originalFileName,
          projectId: project.id,
          status: retrying ? "queued" : "failed",
          uploadedByName: task.actorName,
          uploadedByUserId: task.actorUserId
        }
      ]);
    }
  }

  if (task.taskType.startsWith("netsuite.")) {
    const syncLogEntry: StoredSyncLogEntry = {
      action: readString(task.payload.actionName) || getTaskLogAction(task.taskType),
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      message: retrying ? `${message} Retrying automatically.` : message,
      status: retrying ? "warning" : "error",
      summary: {
        error: message,
        retrying,
        taskId: task.id
      }
    };

    await insertSyncLogEntry(syncLogEntry);
  }

  await recordAuditLog({
    action: `${task.taskType.replace(/\./g, "_")}_${retrying ? "retry_queued" : "failed"}`,
    actor: readActor(task.payload),
    metadata: {
      error: message,
      retrying,
      taskId: task.id
    },
    targetId: task.targetId,
    targetType: task.targetType
  });
}

export function buildQueuedJobImageFileName({
  contentType,
  date,
  imageNumber,
  originalFileName,
  projectName
}: {
  contentType: string;
  date: string;
  imageNumber: number;
  originalFileName: string;
  projectName: string;
}) {
  return buildJobImageFileName({
    contentType,
    date,
    imageNumber,
    originalFileName,
    projectName
  });
}

export async function countReservedJobImageSlots(projectId: string, date: string) {
  return countReservedJobImageUploadSlots(projectId, date);
}

function buildNetSuiteSyncMessage(prefix: string, summary: NetSuiteSyncSummary) {
  const archivedText =
    (summary.autoArchivedProjects ?? 0) > 0 ? `, ${summary.autoArchivedProjects} archived inactive` : "";
  const unarchivedText =
    (summary.autoUnarchivedProjects ?? 0) > 0 ? `, ${summary.autoUnarchivedProjects} unarchived active` : "";
  const dailyReportOnlyText =
    (summary.dailyReportOnlyProjects ?? 0) > 0 ? `, ${summary.dailyReportOnlyProjects} daily-report-only` : "";

  return `${prefix}: ${summary.synced} synced, ${summary.skippedExisting} existing skipped, ${summary.failed} failed${dailyReportOnlyText}${archivedText}${unarchivedText}`;
}

function hasSyncWarnings(summary: NetSuiteSyncSummary) {
  return summary.failed > 0 || (summary.autoArchivedProjects ?? 0) > 0 || (summary.autoUnarchivedProjects ?? 0) > 0;
}

function getTaskLogAction(taskType: TaskQueueTask["taskType"]) {
  switch (taskType) {
    case "netsuite.sync_all":
      return "Sync All Projects";
    case "netsuite.sync_new":
      return "Sync New Projects";
    case "netsuite.vendors_sync":
      return "Get Vendors";
    default:
      return "Queued Task";
  }
}

function readQueuedJobImage(value: unknown) {
  const record = readRecord(value);
  const clientId = readString(record.clientId);
  const contentType = readString(record.contentType);
  const fileBase64 = readString(record.fileBase64);
  const fileSizeBytes = readPositiveInteger(record.fileSizeBytes);
  const originalFileName = readString(record.originalFileName);

  if (!clientId || !contentType || !fileBase64 || !fileSizeBytes || !originalFileName) {
    return null;
  }

  return {
    caption: readString(record.caption) || undefined,
    clientId,
    contentType,
    fileBase64,
    fileSizeBytes,
    originalFileName
  };
}

function readProject(value: unknown): Project | null {
  const record = readRecord(value);
  const id = readString(record.id);
  const name = readString(record.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    netSuiteProjectId: readString(record.netSuiteProjectId) || undefined,
    netSuiteProjectManagerId: readString(record.netSuiteProjectManagerId) || undefined,
    netSuiteProjectManagerName: readString(record.netSuiteProjectManagerName) || undefined,
    payItems: Array.isArray(record.payItems) ? (record.payItems as Project["payItems"]) : [],
    procoreProjectId: readString(record.procoreProjectId) || undefined,
    sourceSystem: record.sourceSystem === "procore" || record.sourceSystem === "netsuite" ? record.sourceSystem : undefined
  };
}

function readActor(payload: Record<string, unknown>): AuthUser {
  const actor = readRecord(payload.actor);
  const id = readString(actor.id);
  const firstName = readString(actor.firstName);
  const lastName = readString(actor.lastName);
  const role = readString(actor.role);

  if (!id || !firstName || !lastName || !["admin", "executive", "project_manager", "standard"].includes(role)) {
    return SYSTEM_ACTOR;
  }

  return {
    firstName,
    id,
    lastName,
    netSuiteProjectManagerId: readString(actor.netSuiteProjectManagerId) || undefined,
    netSuiteProjectManagerName: readString(actor.netSuiteProjectManagerName) || undefined,
    role: role as AuthUser["role"]
  };
}

function formatActorName(actor: AuthUser) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.id;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsedValue = Number(value);
    return parsedValue > 0 ? parsedValue : null;
  }

  return null;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, milliseconds));
  });
}
