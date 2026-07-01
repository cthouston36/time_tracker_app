import { getProcoreConfig } from "@/lib/procore/config";
import { getProcoreIntegrationAccessToken } from "@/lib/procore/session";
import type { Project } from "@/lib/procore/types";

const DEFAULT_FOLDERS_PATH = "/rest/v1.0/folders";

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

type DailyReportItsfmItem = {
  group: "Aboveground Equipment" | "Cabinet Equipment";
  key: string;
  label: string;
};

const DAILY_REPORT_ITSFM_ITEMS: DailyReportItsfmItem[] = [
  { group: "Aboveground Equipment", key: "cctv-1", label: "CCTV #1" },
  { group: "Aboveground Equipment", key: "cctv-2", label: "CCTV #2" },
  { group: "Aboveground Equipment", key: "cctv-3", label: "CCTV #3" },
  { group: "Aboveground Equipment", key: "cctv-4", label: "CCTV #4" },
  { group: "Aboveground Equipment", key: "cctv-5", label: "CCTV #5" },
  { group: "Aboveground Equipment", key: "cctv-6", label: "CCTV #6" },
  { group: "Aboveground Equipment", key: "preemption-unit-1", label: "#1 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "preemption-unit-2", label: "#2 Preemtion Unit" },
  { group: "Aboveground Equipment", key: "rsu", label: "RSU" },
  { group: "Aboveground Equipment", key: "antenna", label: "Antenna" },
  { group: "Cabinet Equipment", key: "cabinet", label: "Cabinet" },
  { group: "Cabinet Equipment", key: "controller", label: "Controller" },
  { group: "Cabinet Equipment", key: "mmu", label: "MMU" },
  { group: "Cabinet Equipment", key: "biu-1", label: "BIU #1" },
  { group: "Cabinet Equipment", key: "biu-2", label: "BIU #2" },
  { group: "Cabinet Equipment", key: "detection-ccu", label: "Detection CCU" },
  { group: "Cabinet Equipment", key: "rpm", label: "RPM" },
  { group: "Cabinet Equipment", key: "ups", label: "UPS" },
  { group: "Cabinet Equipment", key: "ethernet-switch", label: "Ethernet Switch" },
  { group: "Cabinet Equipment", key: "preemption-card", label: "Preemtion Card" },
  { group: "Cabinet Equipment", key: "misc-1", label: "Misc" },
  { group: "Cabinet Equipment", key: "misc-2", label: "Misc" }
];

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
  folderPath: string;
  folderId: string;
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

  const fileName = buildDailyReportFileName(payload.project.name, payload.date);
  const html = renderDailyReportHtml(payload);
  const uploadResult = await uploadProjectFileWithDirectUpload({
    accessToken,
    baseUrl: config.baseUrl,
    companyId: config.companyId,
    projectId: payload.project.id,
    folderId: folder.id,
    fileName,
    html
  });

  return {
    fileName: uploadResult.fileName,
    folderPath,
    folderId: folder.id,
    procoreFileId: extractId(uploadResult.response),
    procoreUpload: uploadResult.procoreUpload
  };
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
  projectId,
  folderId,
  fileName,
  html
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  folderId: string;
  fileName: string;
  html: string;
}) {
  const directUpload = await createProjectUpload({
    accessToken,
    baseUrl,
    companyId,
    projectId,
    fileName
  });

  await uploadFileToStorageService({
    directUpload,
    fileName,
    html
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
      fileName: fallbackFileName
    });

    await uploadFileToStorageService({
      directUpload: fallbackDirectUpload,
      fileName: fallbackFileName,
      html
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
  fileName
}: {
  accessToken: string;
  baseUrl: string;
  companyId: string;
  projectId: string;
  fileName: string;
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
      response_content_type: "text/html"
    }),
    stage: `create upload for "${fileName}"`
  });
}

function buildCreateProjectUploadPath(projectId: string) {
  return `/rest/v1.1/projects/${encodeURIComponent(projectId)}/uploads`;
}

async function uploadFileToStorageService({
  directUpload,
  fileName,
  html
}: {
  directUpload: ProcoreDirectUpload;
  fileName: string;
  html: string;
}) {
  const file = new Blob([html], { type: "text/html" });
  const formData = new FormData();

  for (const [key, value] of Object.entries(directUpload.fields)) {
    formData.set(key, value);
  }

  formData.set("file", file, fileName);

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

function renderDailyReportHtml({ project, date, report, dayNotes }: DailyReportUploadPayload) {
  const payItemMap = new Map(project.payItems.map((payItem) => [payItem.id, payItem]));
  const employeeRows = (report.employeeRows ?? []).filter((row) =>
    [
      row.employeeClassification,
      row.truckNumber,
      row.timeIn,
      row.lunchOut,
      row.lunchIn,
      row.timeOut,
      row.totalHours
    ].some(Boolean)
  );
  const payItemRows = (report.payItemRows ?? []).filter((row) => row.payItemId || row.quantity);
  const itsfmRows = normalizeDailyReportItsfmRows(report.itsfmRows);
  const legacyItsfmNotes = renderLegacyItsfmNotes(report);
  const inspectorQuantitiesTurnedIn = report.quantitiesTurnedIn === "yes";
  const incidentOccurred = report.incidentOccurred === "yes";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(buildDailyReportFileName(project.name, date))}</title>
    <style>
      body { color: #111827; font-family: Arial, sans-serif; font-size: 13px; margin: 28px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { border-bottom: 1px solid #9ca3af; font-size: 16px; margin: 24px 0 8px; padding-bottom: 4px; }
      table { border-collapse: collapse; margin-top: 8px; width: 100%; }
      th, td { border: 1px solid #9ca3af; padding: 6px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; }
      .meta { color: #4b5563; margin-bottom: 16px; }
      .note { border: 1px solid #d1d5db; min-height: 52px; padding: 8px; white-space: pre-wrap; }
      .grid { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
      .mot-table { max-width: 100%; min-width: 720px; table-layout: auto; width: auto; }
      .mot-table th { min-width: 210px; white-space: nowrap; }
      .mot-table td { min-width: 70px; }
      .mot-table .wide-value { min-width: 360px; }
      .itsfm-table th:first-child, .itsfm-table td:first-child { width: 28%; }
      .section-row th { background: #dbeafe; color: #111827; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <h1>Daily Report</h1>
    <div class="meta">
      <strong>Project:</strong> ${escapeHtml(project.name)}<br />
      <strong>Date:</strong> ${escapeHtml(date)}<br />
      <strong>Created By:</strong> ${escapeHtml(report.createdByName ?? "")}<br />
      <strong>Last Updated:</strong> ${escapeHtml(report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "")}
    </div>

    <h2>Employee Time on Site</h2>
    <table>
      <thead>
        <tr>
          <th>Employee Name - Classification</th>
          <th>Truck #</th>
          <th>Time In</th>
          <th>Lunch Out</th>
          <th>Lunch In</th>
          <th>Time Out</th>
          <th>Total Hours</th>
          <th>Driver</th>
          <th>Passenger</th>
        </tr>
      </thead>
      <tbody>
        ${employeeRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.employeeClassification)}</td>
            <td>${escapeHtml(row.truckNumber)}</td>
            <td>${escapeHtml(row.timeIn)}</td>
            <td>${escapeHtml(row.lunchOut)}</td>
            <td>${escapeHtml(row.lunchIn)}</td>
            <td>${escapeHtml(row.timeOut)}</td>
            <td>${escapeHtml(row.totalHours)}</td>
            <td>${row.driver ? "Yes" : ""}</td>
            <td>${row.passenger ? "Yes" : ""}</td>
          </tr>
        `).join("") || `<tr><td colspan="9">No employee time entered.</td></tr>`}
      </tbody>
    </table>

    <h2>Work Performed Pay Items</h2>
    <table>
      <thead>
        <tr>
          <th>Pay Item #</th>
          <th>Description</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>
        ${payItemRows.map((row) => {
          const payItem = payItemMap.get(row.payItemId);

          return `
          <tr>
            <td>${escapeHtml(payItem?.code ?? "")}</td>
            <td>${escapeHtml(payItem?.name ?? "")}</td>
            <td>${escapeHtml(row.quantity)} ${escapeHtml(payItem?.unitOfMeasure ?? "")}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="3">No pay item quantities entered.</td></tr>`}
      </tbody>
    </table>

    <h2>Inspector / Quantities</h2>
    <div class="grid">
      <div><strong>Quantities turned into inspector:</strong> ${escapeHtml(formatYesNo(report.quantitiesTurnedIn))}</div>
      ${
        inspectorQuantitiesTurnedIn
          ? `<div><strong>Inspector Name:</strong> ${escapeHtml(report.inspectorName ?? "")}</div>`
          : ""
      }
    </div>
    ${
      inspectorQuantitiesTurnedIn
        ? `<h3>Quantities and Items Turned Into Inspector</h3>
    <div class="note">${escapeHtml(report.inspectorQuantityDetails ?? "")}</div>`
        : ""
    }

    <h2>Work Description</h2>
    <div class="note">${escapeHtml(report.workDescription ?? "")}</div>
    <h2>Plan Sheet Numbers</h2>
    <div class="note">${escapeHtml(report.planSheetNumbers ?? "")}</div>
    <h2>Work Details</h2>
    <div class="note">${escapeHtml(report.workDetails ?? "")}</div>

    <h2>Notes</h2>
    <div class="note">${escapeHtml(dayNotes?.notes ?? "")}</div>
    <h2>Inventory</h2>
    <div class="note">${escapeHtml(dayNotes?.inventory ?? "")}</div>

    <h2>Incidents / Accidents</h2>
    <div class="grid">
      <div><strong>Incident occurred:</strong> ${escapeHtml(formatYesNo(report.incidentOccurred))}</div>
      ${
        incidentOccurred
          ? `<div><strong>Accident report filed:</strong> ${escapeHtml(formatYesNo(report.accidentReportFiled))}</div>`
          : ""
      }
    </div>
    ${incidentOccurred ? `<div class="note">${escapeHtml(report.incidentDetails ?? "")}</div>` : ""}

    <h2>MOT Quantities</h2>
    <table class="mot-table">
      <tbody>
        <tr><th>Total MOT Signs</th><td>${escapeHtml(report.motSigns ?? "")}</td><th>Cones / Barrels</th><td>${escapeHtml(report.conesBarrels ?? "")}</td></tr>
        <tr><th>Type II Sidewalk Barricades</th><td>${escapeHtml(report.typeIISidewalkBarricades ?? "")}</td><th>Type III Barricades</th><td>${escapeHtml(report.typeIIIBarricades ?? "")}</td></tr>
        <tr><th>LCD Count</th><td>${escapeHtml(report.lcdCount ?? "")}</td><th>LCD Footage</th><td>${escapeHtml(report.lcdFootage ?? "")}</td></tr>
        <tr><th>Arrow Boards</th><td>${escapeHtml(report.arrowBoards ?? "")}</td><th>VMS Boards</th><td>${escapeHtml(report.vmsBoards ?? "")}</td></tr>
        <tr><th>FDOT Index Used</th><td class="wide-value" colspan="3">${escapeHtml(report.fdotIndex ?? "")}</td></tr>
      </tbody>
    </table>

    <h2>ITSFM Itemized List</h2>
    <table class="itsfm-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Model #</th>
          <th>S/N</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        ${renderItsfmRows(itsfmRows)}
      </tbody>
    </table>
    ${legacyItsfmNotes}
  </body>
</html>`;
}

function renderItsfmRows(rows: DailyReportItsfmRow[]) {
  const rowsByKey = new Map(rows.map((row) => [row.itemKey, row]));
  const groups = Array.from(new Set(DAILY_REPORT_ITSFM_ITEMS.map((item) => item.group)));

  return groups.map((group) => `
        <tr class="section-row">
          <th colspan="4">${escapeHtml(group)}</th>
        </tr>
        ${DAILY_REPORT_ITSFM_ITEMS.filter((item) => item.group === group).map((item) => {
          const row = rowsByKey.get(item.key) ?? createEmptyDailyReportItsfmRow(item.key);

          return `<tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${escapeHtml(row.modelNumber)}</td>
          <td>${escapeHtml(row.serialNumber)}</td>
          <td>${escapeHtml(row.location)}</td>
        </tr>`;
        }).join("")}`).join("");
}

function renderLegacyItsfmNotes(report: DailyReportUploadPayload["report"]) {
  const abovegroundEquipment = report.itsfmAbovegroundEquipment?.trim();
  const cabinetEquipment = report.itsfmCabinetEquipment?.trim();

  if (!abovegroundEquipment && !cabinetEquipment) {
    return "";
  }

  return `
    <h3>Legacy ITSFM Notes</h3>
    ${abovegroundEquipment ? `<h4>Aboveground Equipment</h4><div class="note">${escapeHtml(abovegroundEquipment)}</div>` : ""}
    ${cabinetEquipment ? `<h4>Cabinet Equipment</h4><div class="note">${escapeHtml(cabinetEquipment)}</div>` : ""}`;
}

function createEmptyDailyReportItsfmRow(itemKey: string): DailyReportItsfmRow {
  return {
    itemKey,
    location: "",
    modelNumber: "",
    serialNumber: ""
  };
}

function normalizeDailyReportItsfmRows(rows: DailyReportItsfmRow[] | undefined) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.itemKey, row]));

  return DAILY_REPORT_ITSFM_ITEMS.map((item) => ({
    ...createEmptyDailyReportItsfmRow(item.key),
    ...(rowsByKey.get(item.key) ?? {})
  }));
}

function buildDailyReportFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";
  return `${date}_${sanitizeFileName(projectNumber)}_Daily_Report.html`;
}

function buildCollisionSafeFileName(fileName: string) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}_${timestamp}`;
  }

  return `${fileName.slice(0, extensionIndex)}_${timestamp}${fileName.slice(extensionIndex)}`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function formatYesNo(value: string | undefined) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
