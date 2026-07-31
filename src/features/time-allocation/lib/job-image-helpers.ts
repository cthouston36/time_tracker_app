import type { JobImageQueueItem, JobImageUpload } from "@/features/time-allocation/types";

export const JOB_IMAGE_DAILY_UPLOAD_LIMIT = 50;
export const MAX_JOB_IMAGE_UPLOAD_BATCH_BYTES = 3.5 * 1024 * 1024;
export const MAX_JOB_IMAGE_UPLOAD_BATCH_ITEMS = 4;
export const MAX_JOB_IMAGE_QUEUE_ITEMS = 20;
export const JOB_IMAGE_CLIENT_BATCH_DELAY_MS = 1_000;
export const JOB_IMAGE_MAX_DIMENSION = 1800;
export const JOB_IMAGE_JPEG_QUALITY = 0.82;

export async function prepareJobImageFileForUpload(file: File) {
  const compressedFile = await compressJobImage(file);
  return compressedFile ?? file;
}

async function compressJobImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name || "Selected file"} is not an image.`);
  }

  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
    return null;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return new Promise<File | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, JOB_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          const compressedName = replaceFileExtension(file.name || "job-image", "jpg");
          resolve(
            new File([blob], compressedName, {
              lastModified: Date.now(),
              type: "image/jpeg"
            })
          );
        },
        "image/jpeg",
        JOB_IMAGE_JPEG_QUALITY
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

export function chunkJobImagesForUpload(images: JobImageQueueItem[]) {
  const batches: JobImageQueueItem[][] = [];
  let currentBatch: JobImageQueueItem[] = [];
  let currentBatchSize = 0;

  for (const image of images) {
    if (
      currentBatch.length > 0 &&
      (currentBatchSize + image.size > MAX_JOB_IMAGE_UPLOAD_BATCH_BYTES ||
        currentBatch.length >= MAX_JOB_IMAGE_UPLOAD_BATCH_ITEMS)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchSize = 0;
    }

    currentBatch.push(image);
    currentBatchSize += image.size;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function waitForClientDelay(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function mergeJobImageUploads(existingUploads: JobImageUpload[], nextUploads: JobImageUpload[]) {
  const uploadsById = new Map(existingUploads.map((upload) => [upload.id, upload]));

  for (const upload of nextUploads) {
    uploadsById.set(upload.id, upload);
  }

  return Array.from(uploadsById.values()).sort(compareJobImageUploads);
}

function compareJobImageUploads(a: JobImageUpload, b: JobImageUpload) {
  const aTimestamp = a.uploadedAt ?? a.attemptedAt ?? "";
  const bTimestamp = b.uploadedAt ?? b.attemptedAt ?? "";

  return bTimestamp.localeCompare(aTimestamp) || a.fileName.localeCompare(b.fileName);
}

export function uploadClientId(upload: JobImageUpload) {
  return upload.clientId ?? upload.id;
}

function replaceFileExtension(fileName: string, extension: string) {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}.${extension}`;
  }

  return `${fileName.slice(0, extensionIndex)}.${extension}`;
}

export function formatFileSize(bytes: number | undefined) {
  if (!bytes || !Number.isFinite(bytes)) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatJobImageQueueStatus(item: JobImageQueueItem) {
  if (item.status === "uploaded") {
    return "Uploaded";
  }

  if (item.status === "uploading") {
    return "Uploading";
  }

  if (item.status === "failed") {
    return "Failed";
  }

  return "Queued";
}
