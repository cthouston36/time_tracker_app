import { getProcoreConfig } from "@/lib/procore/config";
import { getProcoreIntegrationAccessToken } from "@/lib/procore/session";
import { buildDailyReportPdf, buildDailyReportPdfFileName } from "@/lib/daily-report-pdf";
import type { Project } from "@/lib/procore/types";

const DEFAULT_FOLDERS_PATH = "/rest/v1.0/folders";
const DEFAULT_PROCORE_WEB_BASE_URL = "https://app.procore.com";

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

export async function uploadDailyReportToProcore(payload: DailyReportUploadPayload): Promise<UploadDailyReportResult> {
  const accessToken = await getProcoreIntegrationAccessToken();

  if (!accessToken) {
    throw new Error("Procore upload has not been configured by an admin.");
  }

  const config = getProcoreConfig();
  const folderPath = "Daily Reports";
  const folder = await findOrCreateProjectFolder({
    accessToken,
    baseUrl: config.baseUrl,
    companyId: config.companyId,
    projectId: payload.project.id,
    folderName: folderPath
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
    projectId: payload.project.id,
    folderId: folder.id,
    fileName,
    file: pdf,
    contentType: "application/pdf"
  });

  return {
    fileName: uploadResult.fileName,
    folderId: folder.id,
    folderPath,
    folderUrl: buildProjectDocumentsFolderUrl(payload.project.id, folder.id),
    procoreFileId: extractId(uploadResult.response),
    procoreUpload: uploadResult.procoreUpload
  };
}

function buildProjectDocumentsFolderUrl(projectId: string, folderId: string) {
  const webBaseUrl = process.env.PROCORE_WEB_BASE_URL ?? DEFAULT_PROCORE_WEB_BASE_URL;
  const url = new URL(`/${encodeURIComponent(projectId)}/project/documents`, webBaseUrl);
  url.searchParams.set("folder_id", folderId);

  return url.toString();
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
  projectId,
  parentFolderId
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
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

        for (const folder of normalizeFolders(response)) {
          foldersById.set(folder.id, folder);
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

  const response = await fetch(url, {
    body,
    headers,
    method
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const details = await response.text();
    const retryMessage = retryAfter ? ` Try again after ${formatRetryAfter(retryAfter)}.` : "";
    const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;

    throw new ProcoreDocumentsError(`${stage} failed: ${message}${retryMessage}`, response.status, stage);
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  const text = await response.text();

  if (!text) {
    return {} as TResponse;
  }

  return JSON.parse(text) as TResponse;
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

class ProcoreDocumentsError extends Error {
  constructor(message: string, readonly status: number, readonly stage?: string) {
    super(message);
  }
}
