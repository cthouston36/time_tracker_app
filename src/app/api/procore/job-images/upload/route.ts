import { NextRequest, NextResponse } from "next/server";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import { countJobImageUploads, upsertJobImageUploads, type StoredJobImageUpload } from "@/lib/job-image-store";
import { uploadJobImagesToProcore, type JobImageUploadInput } from "@/lib/procore/documents";
import type { Project } from "@/lib/procore/types";

export const runtime = "nodejs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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
    const project = readProject(formData.get("project"));
    const files = formData.getAll("images").filter(isFile);
    const clientIds = formData.getAll("imageClientIds").map(readFormString);
    const originalFileNames = formData.getAll("originalFileNames").map(readFormString);

    if (!project?.id || !project.name || !ISO_DATE_PATTERN.test(date)) {
      return NextResponse.json({ error: "Provide a valid project and date." }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Select at least one image." }, { status: 400 });
    }

    if (files.length > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json({ error: `Upload ${MAX_IMAGES_PER_REQUEST} images or fewer at a time.` }, { status: 400 });
    }

    const images: JobImageUploadInput[] = [];

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
        clientId: clientIds[index] || crypto.randomUUID(),
        contentType: file.type || "image/jpeg",
        file: new Uint8Array(await file.arrayBuffer()),
        fileSizeBytes: file.size,
        originalFileName: originalFileNames[index] || file.name || `job-image-${index + 1}`
      });
    }

    const existingImageCount = await countJobImageUploads(project.id, date);

    if (existingImageCount === null) {
      return NextResponse.json({ error: "Database is not configured for job image upload tracking." }, { status: 503 });
    }

    const uploadResult = await uploadJobImagesToProcore({
      date,
      images,
      project,
      startingImageNumber: existingImageCount + 1
    });
    const now = new Date().toISOString();
    const uploads: StoredJobImageUpload[] = uploadResult.uploads.map((upload) => ({
      attemptedAt: now,
      clientId: upload.clientId,
      contentType: upload.contentType,
      date,
      error: upload.error,
      fileName: upload.fileName,
      fileSizeBytes: upload.fileSizeBytes,
      folderId: upload.folderId,
      folderPath: upload.folderPath,
      folderUrl: upload.folderUrl,
      id: crypto.randomUUID(),
      originalFileName: upload.originalFileName,
      procoreFileId: upload.procoreFileId,
      projectId: project.id,
      status: upload.status,
      uploadedAt: upload.status === "uploaded" ? now : undefined,
      uploadedByName: formatUserName(user),
      uploadedByUserId: user.id
    }));

    const databaseResult = await upsertJobImageUploads(uploads);

    if (databaseResult === null) {
      return NextResponse.json({ error: "Database is not configured for job image upload tracking." }, { status: 503 });
    }

    const uploadedCount = uploads.filter((upload) => upload.status === "uploaded").length;
    const failedCount = uploads.length - uploadedCount;

    await recordAuditLog({
      action:
        failedCount === 0
          ? "procore.job_images_uploaded"
          : uploadedCount > 0
            ? "procore.job_images_upload_partially_failed"
            : "procore.job_images_upload_failed",
      actor: user,
      metadata: {
        date,
        failedCount,
        folderId: uploadResult.folderId,
        folderPath: uploadResult.folderPath,
        folderUrl: uploadResult.folderUrl,
        projectId: project.id,
        procoreProjectId: uploadResult.projectId,
        uploadedCount
      },
      targetId: `${project.id}|${date}`,
      targetType: "project_day",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      databaseConfigured: true,
      failedCount,
      folderId: uploadResult.folderId,
      folderPath: uploadResult.folderPath,
      folderUrl: uploadResult.folderUrl,
      ok: failedCount === 0,
      uploadedCount,
      uploads
    });
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
