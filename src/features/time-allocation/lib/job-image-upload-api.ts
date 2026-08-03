import type { Project } from "@/lib/domain/types";
import { readApiJson } from "@/features/time-allocation/lib/api-utils";
import { uploadClientId } from "@/features/time-allocation/lib/job-image-helpers";
import type { JobImageUploadResponse } from "@/features/time-allocation/lib/workspace-api-types";
import type { JobImageQueueItem, JobImageUpload } from "@/features/time-allocation/types";

type UploadJobImageBatchOptions = {
  date: string;
  images: JobImageQueueItem[];
  project: Project;
};

export async function uploadJobImageBatchToProcore({ date, images, project }: UploadJobImageBatchOptions) {
  const formData = new FormData();

  formData.set("date", date);
  formData.set(
    "project",
    JSON.stringify({
      id: project.id,
      name: project.name,
      payItems: [],
      procoreProjectId: project.procoreProjectId
    } satisfies Project)
  );

  for (const item of images) {
    formData.append("images", item.file, item.file.name);
    formData.append("imageClientIds", item.id);
    formData.append("imageCaptions", item.caption);
    formData.append("originalFileNames", item.originalName);
  }

  const response = await fetch("/api/procore/job-images/upload", {
    body: formData,
    method: "POST"
  });
  const data = (await readApiJson(response)) as JobImageUploadResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to upload job images to Procore.");
  }

  const returnedUploads = data.uploads ?? [];

  return {
    data,
    failedCount: countJobImageUploadsByStatus(returnedUploads, "failed"),
    queuedCount: data.queued ? data.queuedCount ?? returnedUploads.length : 0,
    returnedUploads,
    uploadedByClientId: new Map(returnedUploads.map((upload) => [uploadClientId(upload), upload])),
    uploadedCount: countJobImageUploadsByStatus(returnedUploads, "uploaded")
  };
}

function countJobImageUploadsByStatus(uploads: JobImageUpload[], status: JobImageUpload["status"]) {
  return uploads.filter((upload) => upload.status === status).length;
}
