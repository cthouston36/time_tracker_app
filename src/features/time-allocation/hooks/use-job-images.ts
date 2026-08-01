import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { Project } from "@/lib/domain/types";
import {
  loadDatabaseJobImageUploads,
  readApiJson
} from "@/features/time-allocation/lib/api-client";
import {
  chunkJobImagesForUpload,
  JOB_IMAGE_CLIENT_BATCH_DELAY_MS,
  JOB_IMAGE_DAILY_UPLOAD_LIMIT,
  MAX_JOB_IMAGE_QUEUE_ITEMS,
  mergeJobImageUploads,
  prepareJobImageFileForUpload,
  uploadClientId,
  waitForClientDelay
} from "@/features/time-allocation/lib/job-image-helpers";
import type { JobImageQueueItem, JobImageUploadsByDay } from "@/features/time-allocation/types";
import type { JobImageUploadResponse } from "@/features/time-allocation/lib/workspace-api-types";

type JobImageNotice = { message: string; status: "success" | "error" } | null;

type UseJobImagesOptions = {
  currentDayKey: string;
  currentUser: AuthUser | null;
  selectedProject: Project | undefined;
  userIsOffline: boolean;
  workDate: string;
};

export function useJobImages({
  currentDayKey,
  currentUser,
  selectedProject,
  userIsOffline,
  workDate
}: UseJobImagesOptions) {
  const [jobImageUploadsByDay, setJobImageUploadsByDay] = useState<JobImageUploadsByDay>({});
  const [jobImageQueue, setJobImageQueue] = useState<JobImageQueueItem[]>([]);
  const [jobImageNotice, setJobImageNotice] = useState<JobImageNotice>(null);
  const [loadingJobImageUploads, setLoadingJobImageUploads] = useState(false);
  const [uploadingJobImages, setUploadingJobImages] = useState(false);
  const [jobImageHistoryExpanded, setJobImageHistoryExpanded] = useState(false);

  const jobImageInputRef = useRef<HTMLInputElement>(null);
  const jobImagePreviewUrlsRef = useRef<Set<string>>(new Set());

  const currentJobImageUploads = useMemo(
    () => (selectedProject ? jobImageUploadsByDay[currentDayKey] ?? [] : []),
    [currentDayKey, jobImageUploadsByDay, selectedProject]
  );
  const queuedJobImages = useMemo(
    () => jobImageQueue.filter((image) => image.status !== "uploaded"),
    [jobImageQueue]
  );
  const failedQueuedJobImages = useMemo(
    () => jobImageQueue.filter((image) => image.status === "failed"),
    [jobImageQueue]
  );
  const failedJobImageUploads = useMemo(
    () => currentJobImageUploads.filter((upload) => upload.status === "failed"),
    [currentJobImageUploads]
  );
  const uploadedJobImageCount = useMemo(
    () => currentJobImageUploads.filter((upload) => upload.status === "uploaded").length,
    [currentJobImageUploads]
  );
  const reservedJobImageCount = useMemo(
    () => currentJobImageUploads.filter((upload) => upload.status === "uploaded" || upload.status === "queued" || upload.status === "processing").length,
    [currentJobImageUploads]
  );
  const remainingJobImageSlots = Math.max(0, JOB_IMAGE_DAILY_UPLOAD_LIMIT - reservedJobImageCount);
  const remainingQueueableJobImageSlots = Math.max(0, remainingJobImageSlots - queuedJobImages.length);
  const jobImageDailyLimitReached = remainingJobImageSlots === 0;
  const showJobImageDetails = Boolean(
    jobImageQueue.length > 0 || currentJobImageUploads.length > 0 || jobImageNotice || uploadingJobImages
  );

  useEffect(() => {
    if (!currentUser || typeof window === "undefined") {
      setJobImageHistoryExpanded(false);
      return;
    }

    setJobImageHistoryExpanded(window.matchMedia("(min-width: 861px)").matches);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedProject) {
      return;
    }

    let cancelled = false;
    const dayKey = currentDayKey;
    const project = selectedProject;

    async function loadJobImagesForDay() {
      setLoadingJobImageUploads(true);

      try {
        const uploads = await loadDatabaseJobImageUploads(project.id, workDate);

        if (!cancelled && uploads) {
          setJobImageUploadsByDay((current) => ({
            ...current,
            [dayKey]: uploads
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingJobImageUploads(false);
        }
      }
    }

    void loadJobImagesForDay();

    return () => {
      cancelled = true;
    };
  }, [currentDayKey, currentUser, selectedProject, workDate]);

  useEffect(
    () => () => {
      for (const previewUrl of jobImagePreviewUrlsRef.current) {
        URL.revokeObjectURL(previewUrl);
      }

      jobImagePreviewUrlsRef.current.clear();
    },
    []
  );

  const revokeJobImagePreview = useCallback((previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    jobImagePreviewUrlsRef.current.delete(previewUrl);
  }, []);

  const createJobImageQueueItem = useCallback(async (file: File): Promise<JobImageQueueItem> => {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${file.name || "Selected file"} is not an image.`);
    }

    const preparedFile = await prepareJobImageFileForUpload(file);
    const previewUrl = URL.createObjectURL(preparedFile);

    jobImagePreviewUrlsRef.current.add(previewUrl);

    return {
      caption: "",
      file: preparedFile,
      id: crypto.randomUUID(),
      originalName: file.name || preparedFile.name,
      previewUrl,
      size: preparedFile.size,
      status: "queued"
    };
  }, []);

  const updateJobImageCaption = useCallback((imageId: string, caption: string) => {
    setJobImageQueue((current) => current.map((item) => (item.id === imageId ? { ...item, caption } : item)));
  }, []);

  const addJobImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }

      if (!selectedProject) {
        setJobImageNotice({
          message: "Select a job before adding images.",
          status: "error"
        });
        return;
      }

      const remainingQueueSlots = Math.max(0, MAX_JOB_IMAGE_QUEUE_ITEMS - jobImageQueue.length);
      const remainingSlots = Math.min(remainingQueueSlots, remainingQueueableJobImageSlots);
      const selectedFiles = Array.from(files).slice(0, remainingSlots);

      if (remainingSlots === 0) {
        if (remainingQueueableJobImageSlots === 0) {
          setJobImageNotice({
            message: jobImageDailyLimitReached
              ? `This job/day already has the maximum ${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded images.`
              : `Upload or remove queued images before adding more. ${remainingJobImageSlots} upload slot${
                  remainingJobImageSlots === 1 ? "" : "s"
                } remain for this job/day.`,
            status: "error"
          });
          return;
        }

        setJobImageNotice({
          message: `Upload or remove queued images before adding more. The temporary queue holds ${MAX_JOB_IMAGE_QUEUE_ITEMS} images.`,
          status: "error"
        });
        return;
      }

      setJobImageNotice(null);

      try {
        const queueItems = await Promise.all(selectedFiles.map(createJobImageQueueItem));

        setJobImageQueue((current) => [...current, ...queueItems]);

        if (selectedFiles.length < files.length) {
          setJobImageNotice({
            message: `Added ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}. Extra selected images were not added because of the job/day limit or temporary queue limit.`,
            status: "success"
          });
        }
      } catch (error) {
        setJobImageNotice({
          message: error instanceof Error ? error.message : "Unable to prepare selected images.",
          status: "error"
        });
      } finally {
        if (jobImageInputRef.current) {
          jobImageInputRef.current.value = "";
        }
      }
    },
    [
      createJobImageQueueItem,
      jobImageDailyLimitReached,
      jobImageQueue.length,
      remainingJobImageSlots,
      remainingQueueableJobImageSlots,
      selectedProject
    ]
  );

  const removeJobImageFromQueue = useCallback(
    (imageId: string) => {
      setJobImageQueue((current) => {
        const removedItem = current.find((item) => item.id === imageId);

        if (removedItem) {
          revokeJobImagePreview(removedItem.previewUrl);
        }

        return current.filter((item) => item.id !== imageId);
      });
    },
    [revokeJobImagePreview]
  );

  const clearUploadedJobImagesFromQueue = useCallback(() => {
    setJobImageQueue((current) => {
      const uploadedItems = current.filter((item) => item.status === "uploaded");

      for (const item of uploadedItems) {
        revokeJobImagePreview(item.previewUrl);
      }

      return current.filter((item) => item.status !== "uploaded");
    });
  }, [revokeJobImagePreview]);

  const clearJobImageQueue = useCallback(() => {
    setJobImageQueue((current) => {
      for (const item of current) {
        revokeJobImagePreview(item.previewUrl);
      }

      return [];
    });
    setJobImageNotice(null);
  }, [revokeJobImagePreview]);

  const uploadJobImageItems = useCallback(
    async (imagesToUpload: JobImageQueueItem[], emptyMessage: string) => {
      if (!selectedProject) {
        setJobImageNotice({
          message: "Select a job before uploading images.",
          status: "error"
        });
        return;
      }

      if (userIsOffline) {
        setJobImageNotice({
          message: "You appear to be offline. Reconnect before uploading images to Procore.",
          status: "error"
        });
        return;
      }

      if (imagesToUpload.length === 0) {
        setJobImageNotice({
          message: emptyMessage,
          status: "error"
        });
        return;
      }

      if (remainingJobImageSlots === 0) {
        setJobImageNotice({
          message: `This job/day already has the maximum ${JOB_IMAGE_DAILY_UPLOAD_LIMIT} uploaded images.`,
          status: "error"
        });
        return;
      }

      if (imagesToUpload.length > remainingJobImageSlots) {
        setJobImageNotice({
          message: `Only ${remainingJobImageSlots} image${remainingJobImageSlots === 1 ? "" : "s"} can still be uploaded for this job/day. Remove extra queued images before uploading.`,
          status: "error"
        });
        return;
      }

      setUploadingJobImages(true);
      setJobImageNotice(null);
      setJobImageQueue((current) =>
        current.map((item) =>
          imagesToUpload.some((image) => image.id === item.id)
            ? {
                ...item,
                error: undefined,
                status: "uploading"
              }
            : item
        )
      );

      let uploadedCount = 0;
      let failedCount = 0;
      let queuedCount = 0;

      try {
        const batches = chunkJobImagesForUpload(imagesToUpload);

        for (const [batchIndex, batch] of batches.entries()) {
          if (batchIndex > 0) {
            await waitForClientDelay(JOB_IMAGE_CLIENT_BATCH_DELAY_MS);
          }

          const formData = new FormData();

          formData.set("date", workDate);
          formData.set(
            "project",
            JSON.stringify({
              id: selectedProject.id,
              name: selectedProject.name,
              payItems: [],
              procoreProjectId: selectedProject.procoreProjectId
            } satisfies Project)
          );

          for (const item of batch) {
            formData.append("images", item.file, item.file.name);
            formData.append("imageClientIds", item.id);
            formData.append("imageCaptions", item.caption);
            formData.append("originalFileNames", item.originalName);
          }

          try {
            const response = await fetch("/api/procore/job-images/upload", {
              body: formData,
              method: "POST"
            });
            const data = (await readApiJson(response)) as JobImageUploadResponse;

            if (!response.ok) {
              throw new Error(data.error ?? "Unable to upload job images to Procore.");
            }

            const uploadedByClientId = new Map((data.uploads ?? []).map((upload) => [uploadClientId(upload), upload]));
            const returnedUploads = data.uploads ?? [];

            uploadedCount += returnedUploads.filter((upload) => upload.status === "uploaded").length;
            failedCount += returnedUploads.filter((upload) => upload.status === "failed").length;
            queuedCount += data.queued ? data.queuedCount ?? returnedUploads.length : 0;

            if (data.queued) {
              for (const item of batch) {
                revokeJobImagePreview(item.previewUrl);
              }

              setJobImageQueue((current) => current.filter((item) => !batch.some((image) => image.id === item.id)));
            } else {
              setJobImageQueue((current) =>
                current.map((item) => {
                  const upload = uploadedByClientId.get(item.id);

                  if (!upload) {
                    return item;
                  }

                  return {
                    ...item,
                    error: upload.error,
                    status: upload.status === "processing" ? "uploading" : upload.status,
                    uploadedFileName: upload.fileName
                  };
                })
              );
            }
            setJobImageUploadsByDay((current) => ({
              ...current,
              [currentDayKey]: mergeJobImageUploads(current[currentDayKey] ?? [], returnedUploads)
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to upload job images to Procore.";

            failedCount += batch.length;
            setJobImageQueue((current) =>
              current.map((item) =>
                batch.some((image) => image.id === item.id)
                  ? {
                      ...item,
                      error: message,
                      status: "failed"
                    }
                  : item
              )
            );
          }
        }

        if (queuedCount > 0 && uploadedCount === 0 && failedCount === 0) {
          setJobImageNotice({
            message: `Queued ${queuedCount} job image${queuedCount === 1 ? "" : "s"} for Procore upload. They will retry automatically if Procore is busy.`,
            status: "success"
          });
        } else if (uploadedCount > 0 && failedCount === 0) {
          setJobImageNotice({
            message: `Uploaded ${uploadedCount} job image${uploadedCount === 1 ? "" : "s"} to Procore.`,
            status: "success"
          });
        } else if (uploadedCount > 0) {
          setJobImageNotice({
            message: `Uploaded ${uploadedCount} image${uploadedCount === 1 ? "" : "s"}; ${failedCount} failed and can be retried.`,
            status: "error"
          });
        } else {
          setJobImageNotice({
            message: "No images were uploaded. Review the failed image messages and try again.",
            status: "error"
          });
        }
      } finally {
        setUploadingJobImages(false);
      }
    },
    [currentDayKey, remainingJobImageSlots, revokeJobImagePreview, selectedProject, userIsOffline, workDate]
  );

  const uploadQueuedJobImages = useCallback(async () => {
    await uploadJobImageItems(
      jobImageQueue.filter((image) => image.status === "queued" || image.status === "failed"),
      "Add at least one image before uploading."
    );
  }, [jobImageQueue, uploadJobImageItems]);

  const retryFailedJobImages = useCallback(async () => {
    await uploadJobImageItems(failedQueuedJobImages, "No failed images are waiting to retry.");
  }, [failedQueuedJobImages, uploadJobImageItems]);

  return {
    addJobImages,
    clearJobImageQueue,
    clearUploadedJobImagesFromQueue,
    currentJobImageUploads,
    failedJobImageUploads,
    failedQueuedJobImages,
    jobImageDailyLimitReached,
    jobImageHistoryExpanded,
    jobImageInputRef,
    jobImageNotice,
    jobImageQueue,
    jobImageUploadsByDay,
    loadingJobImageUploads,
    queuedJobImages,
    removeJobImageFromQueue,
    retryFailedJobImages,
    setJobImageHistoryExpanded,
    showJobImageDetails,
    uploadedJobImageCount,
    uploadingJobImages,
    uploadQueuedJobImages,
    updateJobImageCaption
  };
}
