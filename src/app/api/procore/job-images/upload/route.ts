import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { requestUserCanAccessProjectId } from "@/lib/auth/project-access-server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countJobImageUploads,
  countReservedJobImageUploadSlots,
  upsertJobImageUploads,
  type StoredJobImageUpload
} from "@/lib/job-image-store";
import { getProjects } from "@/lib/project-catalog/projects";
import { enqueueTask } from "@/lib/task-queue";
import { scheduleQueuedTaskProcessing } from "@/lib/task-queue-scheduler";
import type { Project } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const JOB_IMAGE_DAILY_UPLOAD_LIMIT = 50;
const MAX_IMAGES_PER_REQUEST = 6;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before uploading job images." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const date = readFormString(formData.get("date"));
    const submittedProject = readProject(formData.get("project"));
    const files = formData.getAll("images").filter(isFile);
    const clientIds = formData.getAll("imageClientIds").map(readFormString);
    const captions = formData.getAll("imageCaptions").map(readFormString);
    const originalFileNames = formData.getAll("originalFileNames").map(readFormString);

    if (!submittedProject?.id || !ISO_DATE_PATTERN.test(date)) {
      return NextResponse.json({ error: "Provide a valid project and date." }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((candidate) => candidate.id === submittedProject.id);

    if (!project) {
      return NextResponse.json({ error: "Provide a valid project." }, { status: 400 });
    }

    if (!(await requestUserCanAccessProjectId(user, project.id, projects))) {
      return NextResponse.json({ error: "You do not have access to upload images for this project." }, { status: 403 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Select at least one image." }, { status: 400 });
    }

    if (files.length > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json({ error: `Upload ${MAX_IMAGES_PER_REQUEST} images or fewer at a time.` }, { status: 400 });
    }

    const images: Array<{
      caption?: string;
      clientId: string;
      contentType: string;
      file: Uint8Array;
      fileSizeBytes: number;
      originalFileName: string;
    }> = [];

    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: `${file.name || "Selected file"} is not an image.` }, { status: 400 });
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `${file.name || "Selected image"} is too large. Keep each image under 8 MB.` },
          { status: 400 }
        );
      }

      images.push({
        caption: captions[index] || undefined,
        clientId: clientIds[index] || crypto.randomUUID(),
        contentType: file.type || "image/jpeg",
        file: new Uint8Array(await file.arrayBuffer()),
        fileSizeBytes: file.size,
        originalFileName: originalFileNames[index] || file.name || `job-image-${index + 1}`
      });
    }

    const existingUploadedImageCount = await countJobImageUploads(project.id, date);
    const reservedImageSlotCount = await countReservedJobImageUploadSlots(project.id, date);

    if (existingUploadedImageCount === null || reservedImageSlotCount === null) {
      return NextResponse.json({ error: "Database is not configured for job image upload tracking." }, { status: 503 });
    }

    const remainingImageSlots = Math.max(0, JOB_IMAGE_DAILY_UPLOAD_LIMIT - reservedImageSlotCount);

    if (remainingImageSlots === 0) {
      return NextResponse.json(
        {
          error: `This job/day already has the maximum ${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded images.`,
          uploadedImageCount: existingUploadedImageCount,
          uploadedImageLimit: JOB_IMAGE_DAILY_UPLOAD_LIMIT
        },
        { status: 400 }
      );
    }

    if (images.length > remainingImageSlots) {
      return NextResponse.json(
        {
          error: `This job/day has ${reservedImageSlotCount} uploaded or queued images. Upload ${remainingImageSlots} image${
            remainingImageSlots === 1 ? "" : "s"
          } or fewer.`,
          uploadedImageCount: existingUploadedImageCount,
          uploadedImageLimit: JOB_IMAGE_DAILY_UPLOAD_LIMIT
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const uploads: StoredJobImageUpload[] = images.map((image, index) => ({
      attemptedAt: now,
      caption: image.caption,
      clientId: image.clientId,
      contentType: image.contentType,
      date,
      fileName: buildJobImageFileName({
        contentType: image.contentType,
        date,
        imageNumber: reservedImageSlotCount + index + 1,
        originalFileName: image.originalFileName,
        projectName: project.name
      }),
      fileSizeBytes: image.fileSizeBytes,
      folderPath: "Daily Reports/Job Images",
      id: crypto.randomUUID(),
      originalFileName: image.originalFileName,
      projectId: project.id,
      status: "queued",
      uploadedByName: formatUserName(user),
      uploadedByUserId: user.id
    }));

    const databaseResult = await upsertJobImageUploads(uploads);

    if (databaseResult === null) {
      return NextResponse.json({ error: "Database is not configured for job image upload tracking." }, { status: 503 });
    }

    const queuedTasks = await Promise.all(
      uploads.map((upload, index) =>
        enqueueTask({
          actorName: formatUserName(user),
          actorUserId: user.id,
          dedupeKey: `job-image-upload:${upload.id}`,
          maxAttempts: 6,
          payload: {
            actor: user,
            date,
            fileName: upload.fileName,
            image: {
              caption: images[index].caption,
              clientId: images[index].clientId,
              contentType: images[index].contentType,
              fileBase64: Buffer.from(images[index].file).toString("base64"),
              fileSizeBytes: images[index].fileSizeBytes,
              originalFileName: images[index].originalFileName
            },
            project,
            startingImageNumber: reservedImageSlotCount + index + 1,
            uploadId: upload.id
          },
          priority: 10,
          targetId: `${project.id}|${date}`,
          targetType: "project_day",
          taskType: "procore.job_image_upload"
        })
      )
    );

    if (queuedTasks.some((task) => !task)) {
      return NextResponse.json({ error: "Database is not configured for queued job image uploads." }, { status: 503 });
    }

    scheduleQueuedTaskProcessing({
      limit: 10,
      timeBudgetMs: 35_000
    });

    await recordAuditLog({
      action: "procore.job_images_upload_queued",
      actor: user,
      metadata: {
        date,
        queuedCount: uploads.length,
        projectId: project.id,
        taskIds: queuedTasks.flatMap((task) => (task ? [task.id] : []))
      },
      targetId: `${project.id}|${date}`,
      targetType: "project_day",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      databaseConfigured: true,
      failedCount: 0,
      folderPath: "Daily Reports/Job Images",
      ok: true,
      queued: true,
      queuedCount: uploads.length,
      taskIds: queuedTasks.flatMap((task) => (task ? [task.id] : [])),
      uploadedImageCount: existingUploadedImageCount,
      uploadedImageLimit: JOB_IMAGE_DAILY_UPLOAD_LIMIT,
      uploadedCount: 0,
      uploads
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload job images to Procore.";

    await recordAuditLog({
      action: "procore.job_images_upload_failed",
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

function readProject(value: FormDataEntryValue | null) {
  const projectText = readFormString(value);

  if (!projectText) {
    return null;
  }

  try {
    const parsedProject = JSON.parse(projectText) as Project;
    return parsedProject && typeof parsedProject === "object" ? parsedProject : null;
  } catch {
    return null;
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return value instanceof File;
}

function readFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formatUserName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}

function buildJobImageFileName({
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
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";
  const paddedImageNumber = String(Math.max(1, imageNumber)).padStart(3, "0");
  const extension = readImageFileExtension(contentType, originalFileName);

  return `${date}_${sanitizeFileName(projectNumber)}_Job_Image_${paddedImageNumber}.${extension}`;
}

function readImageFileExtension(contentType: string, originalFileName: string) {
  const normalizedContentType = contentType.trim().toLowerCase();

  if (normalizedContentType === "image/jpeg" || normalizedContentType === "image/jpg") {
    return "jpg";
  }

  if (normalizedContentType === "image/png") {
    return "png";
  }

  if (normalizedContentType === "image/webp") {
    return "webp";
  }

  if (normalizedContentType === "image/heic") {
    return "heic";
  }

  const extension = originalFileName.split(".").pop()?.trim().toLowerCase();

  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "jpg";
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}
