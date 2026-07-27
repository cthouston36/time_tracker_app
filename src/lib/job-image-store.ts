import { getSql } from "@/lib/db";

export type StoredJobImageUploadStatus = "failed" | "uploaded";

export type StoredJobImageUpload = {
  clientId?: string;
  id: string;
  projectId: string;
  date: string;
  fileName: string;
  originalFileName?: string;
  contentType?: string;
  fileSizeBytes?: number;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  procoreFileId?: string;
  status: StoredJobImageUploadStatus;
  error?: string;
  uploadedByUserId?: string;
  uploadedByName?: string;
  uploadedAt?: string;
  attemptedAt?: string;
};

type JobImageUploadRow = {
  id: string;
  project_id: string;
  date: string;
  file_name: string;
  original_file_name: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  folder_id: string | null;
  folder_path: string;
  folder_url: string | null;
  procore_file_id: string | null;
  status: StoredJobImageUploadStatus;
  error: string | null;
  uploaded_by_user_id: string | null;
  uploaded_by_name: string | null;
  uploaded_at: unknown;
  attempted_at: unknown;
  raw_upload: unknown;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let jobImageUploadTableReady = false;

export async function readJobImageUploads(projectId: string, date: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const normalizedProjectId = readPlainString(projectId);
  const normalizedDate = readPlainString(date);

  if (!normalizedProjectId || !isIsoDate(normalizedDate)) {
    return [];
  }

  await ensureJobImageUploadTable();

  const rows = (await sql`
    select
      id,
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      file_name,
      original_file_name,
      content_type,
      file_size_bytes,
      folder_id,
      folder_path,
      folder_url,
      procore_file_id,
      status,
      error,
      uploaded_by_user_id,
      uploaded_by_name,
      uploaded_at,
      attempted_at,
      raw_upload
    from job_image_uploads
    where project_id = ${normalizedProjectId}
      and work_date = ${normalizedDate}::date
    order by coalesce(uploaded_at, attempted_at, updated_at) desc, file_name
  `) as JobImageUploadRow[];

  return rows.map(normalizeJobImageUploadRow);
}

export async function countJobImageUploads(projectId: string, date: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const normalizedProjectId = readPlainString(projectId);
  const normalizedDate = readPlainString(date);

  if (!normalizedProjectId || !isIsoDate(normalizedDate)) {
    return 0;
  }

  await ensureJobImageUploadTable();

  const rows = (await sql`
    select count(*)::int as count
    from job_image_uploads
    where project_id = ${normalizedProjectId}
      and work_date = ${normalizedDate}::date
      and status = 'uploaded'
  `) as Array<{ count: number }>;

  return rows[0]?.count ?? 0;
}

export async function upsertJobImageUploads(jobImageUploads: StoredJobImageUpload[]) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureJobImageUploadTable();

  const normalizedUploads = jobImageUploads.flatMap((upload) => {
    const normalizedUpload = normalizeJobImageUpload(upload);
    return normalizedUpload ? [normalizedUpload] : [];
  });

  if (normalizedUploads.length === 0) {
    return 0;
  }

  const queries = normalizedUploads.map((upload) => sql`
    insert into job_image_uploads (
      id,
      project_id,
      work_date,
      file_name,
      original_file_name,
      content_type,
      file_size_bytes,
      folder_id,
      folder_path,
      folder_url,
      procore_file_id,
      status,
      error,
      uploaded_by_user_id,
      uploaded_by_name,
      uploaded_at,
      attempted_at,
      raw_upload,
      updated_at
    )
    values (
      ${upload.id},
      ${upload.projectId},
      ${upload.date}::date,
      ${upload.fileName},
      ${upload.originalFileName ?? null},
      ${upload.contentType ?? null},
      ${upload.fileSizeBytes ?? null},
      ${upload.folderId ?? null},
      ${upload.folderPath},
      ${upload.folderUrl ?? null},
      ${upload.procoreFileId ?? null},
      ${upload.status},
      ${upload.error ?? null},
      ${upload.uploadedByUserId ?? null},
      ${upload.uploadedByName ?? null},
      ${upload.uploadedAt ?? null}::timestamptz,
      ${upload.attemptedAt ?? null}::timestamptz,
      ${JSON.stringify(upload)}::jsonb,
      now()
    )
    on conflict (id) do update
    set project_id = excluded.project_id,
        work_date = excluded.work_date,
        file_name = excluded.file_name,
        original_file_name = excluded.original_file_name,
        content_type = excluded.content_type,
        file_size_bytes = excluded.file_size_bytes,
        folder_id = excluded.folder_id,
        folder_path = excluded.folder_path,
        folder_url = excluded.folder_url,
        procore_file_id = excluded.procore_file_id,
        status = excluded.status,
        error = excluded.error,
        uploaded_by_user_id = excluded.uploaded_by_user_id,
        uploaded_by_name = excluded.uploaded_by_name,
        uploaded_at = excluded.uploaded_at,
        attempted_at = excluded.attempted_at,
        raw_upload = excluded.raw_upload,
        updated_at = now()
  `);

  await sql.transaction(queries);

  return normalizedUploads.length;
}

export async function clearJobImageUploadData() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureJobImageUploadTable();

  const rows = (await sql`
    delete from job_image_uploads
    returning id
  `) as Array<{ id: string }>;

  return {
    jobImageUploads: rows.length
  };
}

async function ensureJobImageUploadTable() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (jobImageUploadTableReady) {
    return;
  }

  await sql`
    create table if not exists job_image_uploads (
      id text primary key,
      project_id text not null,
      work_date date not null,
      file_name text not null,
      original_file_name text,
      content_type text,
      file_size_bytes integer,
      folder_id text,
      folder_path text not null,
      folder_url text,
      procore_file_id text,
      status text not null,
      error text,
      uploaded_by_user_id text,
      uploaded_by_name text,
      uploaded_at timestamptz,
      attempted_at timestamptz,
      raw_upload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists job_image_uploads_project_date_idx on job_image_uploads (project_id, work_date)`;
  await sql`create index if not exists job_image_uploads_status_idx on job_image_uploads (status)`;
  await sql`create index if not exists job_image_uploads_uploaded_idx on job_image_uploads (uploaded_at)`;

  jobImageUploadTableReady = true;
}

function normalizeJobImageUpload(upload: StoredJobImageUpload) {
  const normalizedUpload = {
    ...upload,
    date: readPlainString(upload.date),
    fileName: readPlainString(upload.fileName),
    folderPath: readPlainString(upload.folderPath),
    id: readPlainString(upload.id),
    projectId: readPlainString(upload.projectId),
    status: upload.status === "uploaded" ? "uploaded" : "failed"
  } satisfies StoredJobImageUpload;

  if (
    !normalizedUpload.id ||
    !normalizedUpload.projectId ||
    !isIsoDate(normalizedUpload.date) ||
    !normalizedUpload.fileName ||
    !normalizedUpload.folderPath
  ) {
    return null;
  }

  return normalizedUpload;
}

function normalizeJobImageUploadRow(row: JobImageUploadRow): StoredJobImageUpload {
  const rawUpload = asRecord(row.raw_upload);

  return {
    id: readString(rawUpload, "id") || row.id,
    projectId: readString(rawUpload, "projectId") || row.project_id,
    date: readString(rawUpload, "date") || row.date,
    fileName: readString(rawUpload, "fileName") || row.file_name,
    originalFileName: readOptionalString(rawUpload, "originalFileName") ?? row.original_file_name ?? undefined,
    contentType: readOptionalString(rawUpload, "contentType") ?? row.content_type ?? undefined,
    fileSizeBytes: readOptionalNumber(rawUpload, "fileSizeBytes") ?? row.file_size_bytes ?? undefined,
    folderId: readOptionalString(rawUpload, "folderId") ?? row.folder_id ?? undefined,
    folderPath: readString(rawUpload, "folderPath") || row.folder_path,
    folderUrl: readOptionalString(rawUpload, "folderUrl") ?? row.folder_url ?? undefined,
    procoreFileId: readOptionalString(rawUpload, "procoreFileId") ?? row.procore_file_id ?? undefined,
    status: row.status === "uploaded" ? "uploaded" : "failed",
    error: readOptionalString(rawUpload, "error") ?? row.error ?? undefined,
    uploadedByUserId: readOptionalString(rawUpload, "uploadedByUserId") ?? row.uploaded_by_user_id ?? undefined,
    uploadedByName: readOptionalString(rawUpload, "uploadedByName") ?? row.uploaded_by_name ?? undefined,
    uploadedAt: readOptionalString(rawUpload, "uploadedAt") ?? readTimestampString(row.uploaded_at),
    attemptedAt: readOptionalString(rawUpload, "attemptedAt") ?? readTimestampString(row.attempted_at)
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  return value || undefined;
}

function readOptionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function readPlainString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readTimestampString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}
