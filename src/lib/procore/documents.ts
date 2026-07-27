import { getProcoreConfig } from "@/lib/procore/config";
import { getProcoreIntegrationAccessToken } from "@/lib/procore/session";
import { buildDailyReportPdf, buildDailyReportPdfFileName } from "@/lib/daily-report-pdf";
import type { Project } from "@/lib/procore/types";

const DEFAULT_FOLDERS_PATH = "/rest/v1.0/folders";
const DEFAULT_PROCORE_WEB_BASE_URL = "https://us02.procore.com";
const DEFAULT_PROCORE_RATE_LIMIT_MAX_RETRIES = 2;
const DEFAULT_PROCORE_RATE_LIMIT_MAX_WAIT_MS = 8_000;
const DEFAULT_PROCORE_JOB_IMAGE_UPLOAD_DELAY_MS = 1_250;

type DailyReportUploadPayload = {
  project: Project;
  date: string;
  report: {
    employeeRows?: DailyReportEmployeeRow[];
    payItemRows?: DailyReportPayItemRow[];
    quantitiesTurnedIn?: string;
    inspectorName?: string;
    inspectorQuantityDetails?: string;
    workDescription?: string;
    planSheetNumbers?: string;
    workDetails?: string;
    incidentOccurred?: string;
    incidentDetails?: string;
    accidentReportFiled?: string;
    motSigns?: string;
    conesBarrels?: string;
    typeIISidewalkBarricades?: string;
    typeIIIBarricades?: string;
    lcdCount?: string;
    lcdFootage?: string;
    arrowBoards?: string;
    vmsBoards?: string;
    fdotIndex?: string;
    itsfmRows?: DailyReportItsfmRow[];
    itsfmAbovegroundEquipment?: string;
    itsfmCabinetEquipment?: string;
    twoSeriesEquipmentTools?: string;
    twoSeriesSafetyIssues?: string;
    twoSeriesDelayReasons?: string;
    twoSeriesDeliveries?: string;
    createdByName?: string;
    updatedAt?: string;
  };
  dayNotes?: {
    notes?: string;
    inventory?: string;
  };
};

type DailyReportEmployeeRow = {
  employeeClassification: string;
  truckNumber: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  productionCode1?: string;
  productionHours1?: string;
  productionCode2?: string;
  productionHours2?: string;
  totalHours: string;
  driver: boolean;
  passenger: boolean;
};

type DailyReportPayItemRow = {
  payItemId: string;
  quantity: string;
};

type DailyReportItsfmRow = {
  itemKey: string;
  modelNumber: string;
  serialNumber: string;
  location: string;
};

type ProcoreFolder = {
  id: string;
  name: string;
  parentId?: string | null;
};

type ProcoreDirectUpload = {
  uuid: string;
  url: string;
  fields: Record<string, string>;
};

type UploadDailyReportResult = {
  companyId: string;
  fileName: string;
  folderId: string;
  folderPath: string;
  folderUrl: string;
  procoreFileId?: string;
  procoreUpload?: ProcoreUploadDebugInfo;
};

type ProcoreUploadDebugInfo = {
  createUploadPath: string;
  createFilePath: string;
  createFilePayload: string;
};

export type JobImageUploadInput = {
  clientId: string;
  contentType: string;
  file: Uint8Array;
  fileSizeBytes: number;
  originalFileName: string;
};

export type JobImageUploadResult = {
  clientId: string;
  contentType: string;
  error?: string;
  fileName: string;
  fileSizeBytes: number;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  originalFileName: string;
  procoreFileId?: string;
  status: "failed" | "uploaded";
};

export async function uploadDailyReportToProcore(payload: DailyReportUploadPayload): Promise<UploadDailyReportResult> {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    throw new Error("Procore upload has not been configured by an admin.");
  }

  const config = getProcoreConfig();
  const folderPath = ["Daily Reports"];
  const procoreProjectId = resolveProcoreProjectId(payload.project);

  if (!procoreProjectId) {
    throw new Error("The selected project does not have a Procore project ID for document upload.");
  }

  const folder = await findOrCreateProjectFolderPath({
    accessToken,
    baseUrl: config.baseUrl,
    companyId: config.companyId,
    projectId: procoreProjectId,
    folderPath
  });

  if (!folder.id) {
    throw new Error("Unable to resolve the Procore Daily Reports folder.");
  }

  const fileName = buildDailyReportPdfFileName(payload.project.name, payload.date);
  const pdf = await buildDailyReportPdf(payload);
  const uploadResult = await uploadProjectFileWithDirectUpload({
    accessToken,
    baseUrl: config.baseUrl,
    companyId: config.companyId,
    projectId: procoreProjectId,
    folderId: folder.id,
    fileName,
    file: pdf,
    contentType: "application/pdf"
  });

  return {
    companyId: config.companyId,
    fileName: uploadResult.fileName,
    folderId: folder.id,
    folderPath: folderPath.join("/"),
    folderUrl: buildProjectDocumentsFolderUrl(config.companyId, procoreProjectId, folder.id),
    procoreFileId: extractId(uploadResult.response),
    procoreUpload: uploadResult.procoreUpload
  };
}

export async function uploadJobImagesToProcore({
  date,
  images,
  project,
  startingImageNumber
}: {
  date: string;
  images: JobImageUploadInput[];
  project: Project;
  startingImageNumber: number;
}) {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    throw new Error("Procore upload has not been configured by an admin.");
  }

  const config = getProcoreConfig();
  const folderPath = ["Daily Reports", "Job Images"];
  const folderPathText = folderPath.join("/");
  const procoreProjectId = resolveProcoreProjectId(project);

  if (!procoreProjectId) {
    throw new Error("The selected project does not have a Procore project ID for image upload.");
  }

  const folder = await findOrCreateProjectFolderPath({
    accessToken,
    baseUrl: config.baseUrl,
    companyId: config.companyId,
    folderPath,
    projectId: procoreProjectId
  });

  if (!folder.id) {
    throw new Error("Unable to resolve the Procore Job Images folder.");
  }

  const folderUrl = buildProjectDocumentsFolderUrl(config.companyId, procoreProjectId, folder.id);
  const uploads: JobImageUploadResult[] = [];
  const uploadDelayMs = readPositiveIntegerEnv("PROCORE_JOB_IMAGE_UPLOAD_DELAY_MS", DEFAULT_PROCORE_JOB_IMAGE_UPLOAD_DELAY_MS);

  for (const [index, image] of images.entries()) {
    if (index > 0 && uploadDelayMs > 0) {
      await delay(uploadDelayMs);
    }

    const fileName = buildJobImageFileName({
      contentType: image.contentType,
      date,
      imageNumber: startingImageNumber + index,
      originalFileName: image.originalFileName,
      projectName: project.name
    });

    try {
      const uploadResult = await uploadProjectFileWithDirectUpload({
        accessToken,
        baseUrl: config.baseUrl,
        companyId: config.companyId,
        contentType: image.contentType,
        file: image.file,
        fileName,
        folderId: folder.id,
        projectId: procoreProjectId
      });

      uploads.push({
        clientId: image.clientId,
        contentType: image.contentType,
        fileName: uploadResult.fileName,
        fileSizeBytes: image.fileSizeBytes,
        folderId: folder.id,
        folderPath: folderPathText,
        folderUrl,
        originalFileName: image.originalFileName,
        procoreFileId: extractId(uploadResult.response),
        status: "uploaded"
      });
    } catch (error) {
      uploads.push({
        clientId: image.clientId,
        contentType: image.contentType,
        error: error instanceof Error ? error.message : "Unable to upload image to Procore.",
        fileName,
        fileSizeBytes: image.fileSizeBytes,
        folderId: folder.id,
        folderPath: folderPathText,
        folderUrl,
        originalFileName: image.originalFileName,
        status: "failed"
      });
    }
  }

  return {
    companyId: config.companyId,
    folderId: folder.id,
    folderPath: folderPathText,
    folderUrl,
    projectId: procoreProjectId,
    uploads
  };
}

function resolveProcoreProjectId(project: Project) {
  return firstString(project.procoreProjectId, project.id);
}

function buildProjectDocumentsFolderUrl(companyId: string, projectId: string, folderId: string) {
  const webBaseUrl = process.env.PROCORE_WEB_BASE_URL ?? DEFAULT_PROCORE_WEB_BASE_URL;
  const url = new URL(
    `/webclients/host/companies/${encodeURIComponent(companyId)}/projects/${encodeURIComponent(projectId)}/tools/documents`,
    webBaseUrl
  );
  url.searchParams.set("folder_id", folderId);

  return url.toString();
}

async function findOrCreateProjectFolderPath({
  accessToken,
  baseUrl,
  companyId,
  folderPath,
  projectId
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  folderPath: string[];
  projectId: string;
}) {
  let parentFolderId: string | undefined;
  let folder: ProcoreFolder | null = null;

  for (const folderName of folderPath) {
    folder = await findOrCreateProjectFolder({
      accessToken,
      baseUrl,
      companyId,
      folderName,
      parentFolderId,
      projectId
    });
    parentFolderId = folder.id;
  }

  return (
    folder ?? {
      id: "",
      name: ""
    }
  );
}

async function findOrCreateProjectFolder({
  accessToken,
  baseUrl,
  companyId,
  projectId,
  parentFolderId,
  folderName
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  parentFolderId?: string;
  folderName: string;
}) {
  const folders = await listProjectFolders({
    accessToken,
    baseUrl,
    companyId,
    projectId,
    parentFolderId
  });
  const existingFolder = findMatchingFolder(folders, folderName, parentFolderId);

  if (existingFolder) {
    return existingFolder;
  }

  let createdFolder: ProcoreFolder | undefined;

  try {
    createdFolder = await createProjectFolder({
      accessToken,
      baseUrl,
      companyId,
      projectId,
      parentFolderId,
      folderName
    });
  } catch (error) {
    if (!isDuplicateNameError(error)) {
      throw error;
    }

    const refreshedFolders = await listProjectFolders({
      accessToken,
      baseUrl,
      companyId,
      exhaustive: true,
      projectId,
      parentFolderId
    });
    const refreshedExistingFolder = findMatchingFolder(refreshedFolders, folderName, parentFolderId);

    if (!refreshedExistingFolder) {
      throw error;
    }

    return refreshedExistingFolder;
  }

  if (!createdFolder.id) {
    throw new Error(`Procore created or returned folder "${folderName}" without a folder ID.`);
  }

  return createdFolder;
}

async function listProjectFolders({
  accessToken,
  baseUrl,
  companyId,
  exhaustive = false,
  projectId,
  parentFolderId
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  exhaustive?: boolean;
  projectId: string;
  parentFolderId?: string;
}) {
  const baseParams = {
    company_id: companyId,
    project_id: projectId
  };
  const pathVariants = process.env.PROCORE_DOCUMENT_FOLDERS_PATH
    ? [process.env.PROCORE_DOCUMENT_FOLDERS_PATH]
    : [
        DEFAULT_FOLDERS_PATH,
        `/rest/v1.0/projects/${encodeURIComponent(projectId)}/folders`,
        ...(parentFolderId
          ? [
              `/rest/v1.0/folders/${encodeURIComponent(parentFolderId)}`,
              `/rest/v1.0/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(parentFolderId)}`
            ]
          : [])
      ];
  const queryVariants = parentFolderId
    ? [
        { ...baseParams, parent_id: parentFolderId },
        { ...baseParams, folder_id: parentFolderId },
        { ...baseParams, id: parentFolderId },
        baseParams
      ]
    : [baseParams];
  const foldersById = new Map<string, ProcoreFolder>();
  let lastError: unknown;

  for (const path of pathVariants) {
    for (const queryVariant of queryVariants) {
      const params = new URLSearchParams(queryVariant);

      try {
        const response = await procoreJsonRequest<unknown>({
          accessToken,
          baseUrl,
          path,
          params,
          stage: `list folders at ${path}`
        });

        const folders = normalizeFolders(response);

        for (const folder of folders) {
          foldersById.set(folder.id, folder);
        }

        if (!exhaustive && folders.length > 0) {
          return Array.from(foldersById.values());
        }
      } catch (error) {
        lastError = error;

        if (!isRecoverableProcoreShapeError(error)) {
          throw error;
        }
      }
    }
  }

  if (foldersById.size === 0 && lastError && process.env.PROCORE_DOCUMENT_FOLDERS_PATH) {
    throw lastError;
  }

  return Array.from(foldersById.values());
}

async function createProjectFolder({
  accessToken,
  baseUrl,
  companyId,
  projectId,
  parentFolderId,
  folderName
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  parentFolderId?: string;
  folderName: string;
}) {
  const params = new URLSearchParams({
    company_id: companyId,
    project_id: projectId
  });
  const folderBody = {
    company_id: companyId,
    project_id: projectId,
    name: folderName,
    parent_id: parentFolderId
  };

  try {
    const response = await procoreJsonRequest<unknown>({
      accessToken,
      baseUrl,
      path: process.env.PROCORE_DOCUMENT_FOLDERS_PATH ?? DEFAULT_FOLDERS_PATH,
      method: "POST",
      params,
      body: JSON.stringify(folderBody),
      stage: `create folder "${folderName}"`
    });

    return normalizeFolder(response, folderName);
  } catch (error) {
    if (isDuplicateNameError(error) || !isRecoverableProcoreShapeError(error)) {
      throw error;
    }

    const response = await procoreJsonRequest<unknown>({
      accessToken,
      baseUrl,
      path: process.env.PROCORE_DOCUMENT_FOLDERS_PATH ?? DEFAULT_FOLDERS_PATH,
      method: "POST",
      params,
      body: JSON.stringify({
        company_id: companyId,
        project_id: projectId,
        folder: folderBody
      }),
      stage: `create folder "${folderName}" with nested payload`
    });

    return normalizeFolder(response, folderName);
  }
}

async function uploadProjectFileWithDirectUpload({
  accessToken,
  baseUrl,
  companyId,
  contentType,
  file,
  projectId,
  folderId,
  fileName
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  contentType: string;
  file: Uint8Array;
  projectId: string;
  folderId: string;
  fileName: string;
}) {
  const directUpload = await createProjectUpload({
    accessToken,
    baseUrl,
    companyId,
    projectId,
    fileName,
    contentType
  });

  await uploadFileToStorageService({
    directUpload,
    fileName,
    file,
    contentType
  });

  try {
    const createFileResult = await createProjectFileFromUpload({
      accessToken,
      baseUrl,
      companyId,
      projectId,
      folderId,
      fileName,
      uploadId: directUpload.uuid
    });

    return {
      fileName,
      response: createFileResult.response,
      procoreUpload: {
        createUploadPath: buildCreateProjectUploadPath(projectId),
        createFilePath: createFileResult.path,
        createFilePayload: createFileResult.payloadName
      }
    };
  } catch (error) {
    if (!isDuplicateNameError(error)) {
      throw error;
    }

    const fallbackFileName = buildCollisionSafeFileName(fileName);
    const fallbackDirectUpload = await createProjectUpload({
      accessToken,
      baseUrl,
      companyId,
      projectId,
      fileName: fallbackFileName,
      contentType
    });

    await uploadFileToStorageService({
      directUpload: fallbackDirectUpload,
      fileName: fallbackFileName,
      file,
      contentType
    });

    const fallbackCreateFileResult = await createProjectFileFromUpload({
      accessToken,
      baseUrl,
      companyId,
      projectId,
      folderId,
      fileName: fallbackFileName,
      uploadId: fallbackDirectUpload.uuid
    });

    return {
      fileName: fallbackFileName,
      response: fallbackCreateFileResult.response,
      procoreUpload: {
        createUploadPath: buildCreateProjectUploadPath(projectId),
        createFilePath: fallbackCreateFileResult.path,
        createFilePayload: fallbackCreateFileResult.payloadName
      }
    };
  }
}

async function createProjectUpload({
  accessToken,
  baseUrl,
  companyId,
  projectId,
  fileName,
  contentType
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  fileName: string;
  contentType: string;
}) {
  const params = new URLSearchParams({
    company_id: companyId
  });

  return procoreJsonRequest<ProcoreDirectUpload>({
    accessToken,
    baseUrl,
    path: buildCreateProjectUploadPath(projectId),
    method: "POST",
    params,
    body: JSON.stringify({
      response_filename: fileName,
      response_content_type: contentType
    }),
    stage: `create upload for "${fileName}"`
  });
}

function buildCreateProjectUploadPath(projectId: string) {
  return `/rest/v1.1/projects/${encodeURIComponent(projectId)}/uploads`;
}

async function uploadFileToStorageService({
  directUpload,
  contentType,
  file,
  fileName
}: {
  directUpload: ProcoreDirectUpload;
  contentType: string;
  file: Uint8Array;
  fileName: string;
}) {
  const fileArrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  const fileBlob = new Blob([fileArrayBuffer], { type: contentType });
  const formData = new FormData();

  for (const [key, value] of Object.entries(directUpload.fields)) {
    formData.set(key, value);
  }

  formData.set("file", fileBlob, fileName);

  const response = await fetch(directUpload.url, {
    body: formData,
    method: "POST"
  });

  if (!response.ok) {
    const details = await response.text();
    const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;

    throw new Error(`upload file "${fileName}" to Procore storage failed: ${message}`);
  }
}

async function createProjectFileFromUpload({
  accessToken,
  baseUrl,
  companyId,
  projectId,
  folderId,
  fileName,
  uploadId
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  folderId: string;
  fileName: string;
  uploadId: string;
}) {
  const params = new URLSearchParams({
    company_id: companyId,
    project_id: projectId,
    folder_id: folderId,
    parent_id: folderId
  });
  const path = process.env.PROCORE_CREATE_PROJECT_FILE_PATH ?? "/rest/v1.0/files";
  const payloadName = "file.upload_uuid with folder_id";
  const response = await procoreJsonRequest<unknown>({
    accessToken,
    baseUrl,
    path,
    method: "POST",
    params,
    body: JSON.stringify({
      file: {
        name: fileName,
        upload_uuid: uploadId,
        folder_id: folderId,
        parent_id: folderId
      }
    }),
    stage: `create project file "${fileName}" at ${path}`
  });

  return {
    path,
    payloadName,
    response
  };
}

async function procoreJsonRequest<TResponse>({
  accessToken,
  baseUrl,
  path,
  method = "GET",
  params,
  body,
  contentType = "application/json",
  stage = "Procore documents request"
}: {
  accessToken: string;
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  params?: URLSearchParams;
  body?: BodyInit;
  contentType?: string | null;
  stage?: string;
}) {
  const url = new URL(path, baseUrl);

  params?.forEach((value, key) => {
    if (value !== "undefined") {
      url.searchParams.set(key, value);
    }
  });

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`
  });

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const maxRetries = readPositiveIntegerEnv("PROCORE_RATE_LIMIT_MAX_RETRIES", DEFAULT_PROCORE_RATE_LIMIT_MAX_RETRIES);
  const maxWaitMs = readPositiveIntegerEnv("PROCORE_RATE_LIMIT_MAX_WAIT_MS", DEFAULT_PROCORE_RATE_LIMIT_MAX_WAIT_MS);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      body,
      headers,
      method
    });

    if (response.ok) {
      if (response.status === 204) {
        return {} as TResponse;
      }

      const text = await response.text();

      if (!text) {
        return {} as TResponse;
      }

      return JSON.parse(text) as TResponse;
    }

    const retryAfter = response.headers.get("retry-after");
    const details = await response.text();
    const retryMessage = retryAfter ? ` Try again after ${formatRetryAfter(retryAfter)}.` : "";
    const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;
    const shouldRetry = response.status === 429 && attempt < maxRetries;

    if (shouldRetry) {
      const retryAfterMs = parseRetryAfterMs(retryAfter);
      const waitMs = retryAfterMs ?? Math.min(maxWaitMs, 1_500 * 2 ** attempt);

      if (waitMs <= maxWaitMs) {
        await delay(waitMs);
        continue;
      }
    }

    throw new ProcoreDocumentsError(`${stage} failed: ${message}${retryMessage}`, response.status, stage);
  }

  throw new ProcoreDocumentsError(`${stage} failed after rate-limit retries.`, 429, stage);
}

function normalizeFolders(response: unknown) {
  return flattenFolderRecords(response).map((folder) => normalizeFolder(folder)).filter((folder) => folder.id && folder.name);
}

function findMatchingFolder(folders: ProcoreFolder[], folderName: string, parentFolderId?: string) {
  const normalizedFolderName = folderName.trim().toLowerCase();
  const matchingFolders = folders.filter((folder) => folder.name.trim().toLowerCase() === normalizedFolderName);

  return (
    matchingFolders.find((folder) => parentFolderId && folder.parentId === parentFolderId) ??
    matchingFolders.find((folder) => !parentFolderId && !folder.parentId) ??
    matchingFolders[0] ??
    null
  );
}

function normalizeFolder(response: unknown, fallbackName = ""): ProcoreFolder {
  const record = isRecord(response) && isRecord(response.data) ? response.data : response;

  if (!isRecord(record)) {
    return {
      id: "",
      name: fallbackName
    };
  }

  return {
    id: firstString(record.id, record.folder_id),
    name: firstString(record.name, record.title, fallbackName),
    parentId: firstString(record.parent_id, record.parent_folder_id) || null
  };
}

function flattenFolderRecords(value: unknown): unknown[] {
  const folders: unknown[] = [];

  function visit(currentValue: unknown) {
    if (Array.isArray(currentValue)) {
      currentValue.forEach(visit);
      return;
    }

    if (!isRecord(currentValue)) {
      return;
    }

    if (firstString(currentValue.id, currentValue.folder_id) && firstString(currentValue.name, currentValue.title)) {
      folders.push(currentValue);
    }

    for (const key of ["data", "folders", "items", "results", "children"]) {
      if (key in currentValue) {
        visit(currentValue[key]);
      }
    }
  }

  visit(value);

  return folders;
}

function buildCollisionSafeFileName(fileName: string) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}_${timestamp}`;
  }

  return `${fileName.slice(0, extensionIndex)}_${timestamp}${fileName.slice(extensionIndex)}`;
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

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function extractId(response: unknown) {
  if (!isRecord(response)) {
    return undefined;
  }

  const record = isRecord(response.data) ? response.data : response;
  const id = firstString(record.id, record.file_id, record.document_id);

  return id || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecoverableProcoreShapeError(error: unknown) {
  return error instanceof ProcoreDocumentsError && [400, 404, 422].includes(error.status);
}

function isDuplicateNameError(error: unknown) {
  return error instanceof ProcoreDocumentsError && error.message.toLowerCase().includes("has already been taken");
}

function formatRetryAfter(value: string) {
  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return new Date(Date.now() + seconds * 1000).toLocaleTimeString();
  }

  return value;
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);

  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }

  return null;
}

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);

  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

class ProcoreDocumentsError extends Error {
  constructor(message: string, readonly status: number, readonly stage?: string) {
    super(message);
  }
}
