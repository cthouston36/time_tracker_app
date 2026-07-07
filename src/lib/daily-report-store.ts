import { getSql } from "@/lib/db";

export type StoredDailyReportsByKey = Record<string, Record<string, unknown>>;
export type StoredDailyReportUploadsByKey = Record<string, Record<string, unknown>>;

type DailyReportRow = {
  project_id: string;
  date: string;
  report: unknown;
};

type DailyReportUploadRow = {
  project_id: string;
  date: string;
  upload: unknown;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let dailyReportTablesReady = false;

export async function readDailyReportData() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyReportTables();

  const reportRows = (await sql`
    select
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      report
    from daily_reports
    order by work_date desc, project_id
  `) as DailyReportRow[];

  const uploadRows = (await sql`
    select
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      upload
    from daily_report_uploads
    order by work_date desc, project_id
  `) as DailyReportUploadRow[];

  const dailyReportsByKey: StoredDailyReportsByKey = {};
  const dailyReportUploadsByKey: StoredDailyReportUploadsByKey = {};

  for (const row of reportRows) {
    dailyReportsByKey[getDayKey(row.project_id, row.date)] = normalizeReportForClient(row.report, row.project_id, row.date);
  }

  for (const row of uploadRows) {
    dailyReportUploadsByKey[getDayKey(row.project_id, row.date)] = normalizeUploadForClient(row.upload);
  }

  return {
    dailyReportUploadsByKey,
    dailyReportsByKey
  };
}

export async function replaceDailyReportData(
  dailyReportsByKey: StoredDailyReportsByKey,
  dailyReportUploadsByKey: StoredDailyReportUploadsByKey
) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyReportTables();

  const normalizedReports = normalizeDailyReportsByKey(dailyReportsByKey);
  const normalizedUploads = normalizeDailyReportUploadsByKey(dailyReportUploadsByKey);
  const queries = [sql`delete from daily_report_uploads`, sql`delete from daily_reports`];

  for (const report of normalizedReports) {
    queries.push(sql`
      insert into daily_reports (
        project_id,
        work_date,
        created_by_user_id,
        created_by_name,
        created_at,
        report_updated_at,
        report,
        updated_at
      )
      values (
        ${report.projectId},
        ${report.date}::date,
        ${readNullableString(report.value, "createdByUserId")},
        ${readNullableString(report.value, "createdByName")},
        ${readNullableTimestamp(report.value, "createdAt")}::timestamptz,
        ${readNullableTimestamp(report.value, "updatedAt")}::timestamptz,
        ${JSON.stringify(report.value)}::jsonb,
        now()
      )
    `);
  }

  for (const upload of normalizedUploads) {
    queries.push(sql`
      insert into daily_report_uploads (
        project_id,
        work_date,
        file_name,
        folder_path,
        procore_file_id,
        uploaded_at,
        upload,
        updated_at
      )
      values (
        ${upload.projectId},
        ${upload.date}::date,
        ${readString(upload.value, "fileName")},
        ${readString(upload.value, "folderPath")},
        ${readNullableString(upload.value, "procoreFileId")},
        ${readNullableTimestamp(upload.value, "uploadedAt")}::timestamptz,
        ${JSON.stringify(upload.value)}::jsonb,
        now()
      )
    `);
  }

  await sql.transaction(queries);

  return {
    dailyReportUploads: normalizedUploads.length,
    dailyReports: normalizedReports.length
  };
}

async function ensureDailyReportTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (dailyReportTablesReady) {
    return;
  }

  await sql`
    create table if not exists daily_reports (
      project_id text not null,
      work_date date not null,
      created_by_user_id text,
      created_by_name text,
      created_at timestamptz,
      report_updated_at timestamptz,
      report jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date)
    )
  `;

  await sql`
    create table if not exists daily_report_uploads (
      project_id text not null,
      work_date date not null,
      file_name text not null,
      folder_path text not null,
      procore_file_id text,
      uploaded_at timestamptz,
      upload jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date)
    )
  `;

  await sql`create index if not exists daily_reports_date_idx on daily_reports (work_date)`;
  await sql`create index if not exists daily_report_uploads_date_idx on daily_report_uploads (work_date)`;
  await sql`create index if not exists daily_report_uploads_uploaded_idx on daily_report_uploads (uploaded_at)`;

  dailyReportTablesReady = true;
}

function normalizeDailyReportsByKey(dailyReportsByKey: StoredDailyReportsByKey) {
  return Object.entries(dailyReportsByKey).flatMap(([dayKey, value]) => {
    const parsedDayKey = parseDayKey(dayKey);
    const report = asRecord(value);
    const projectId = readString(report, "projectId") || parsedDayKey?.projectId;
    const date = readString(report, "date") || parsedDayKey?.date;

    if (!projectId || !isIsoDate(date)) {
      return [];
    }

    return [
      {
        date,
        projectId,
        value: {
          ...report,
          date,
          projectId
        }
      }
    ];
  });
}

function normalizeDailyReportUploadsByKey(dailyReportUploadsByKey: StoredDailyReportUploadsByKey) {
  return Object.entries(dailyReportUploadsByKey).flatMap(([dayKey, value]) => {
    const parsedDayKey = parseDayKey(dayKey);
    const upload = asRecord(value);

    if (!parsedDayKey || !readString(upload, "fileName") || !readString(upload, "folderPath")) {
      return [];
    }

    return [
      {
        date: parsedDayKey.date,
        projectId: parsedDayKey.projectId,
        value: upload
      }
    ];
  });
}

function normalizeReportForClient(report: unknown, projectId: string, date: string) {
  const reportRecord = asRecord(report);

  return {
    ...reportRecord,
    date: readString(reportRecord, "date") || date,
    projectId: readString(reportRecord, "projectId") || projectId
  };
}

function normalizeUploadForClient(upload: unknown) {
  return asRecord(upload);
}

function getDayKey(projectId: string, date: string) {
  return `${projectId}|${date}`;
}

function parseDayKey(dayKey: string) {
  const [projectId, date] = dayKey.split("|");

  if (!projectId || !isIsoDate(date)) {
    return null;
  }

  return { date, projectId };
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

function readNullableString(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  return value || null;
}

function readNullableTimestamp(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}
