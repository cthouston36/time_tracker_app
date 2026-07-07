import { getSql } from "@/lib/db";

export type StoredDaySubmission = {
  status: "draft" | "submitted";
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAt?: string;
};

export type StoredDayEntryNotes = {
  notes: string;
  inventory: string;
};

export type StoredDaySubmissionsByKey = Record<string, StoredDaySubmission>;
export type StoredDayEntryNotesByKey = Record<string, StoredDayEntryNotes>;

type DaySubmissionRow = {
  project_id: string;
  date: string;
  status: string;
  submitted_by_user_id: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
};

type DayNotesRow = {
  project_id: string;
  date: string;
  notes: string | null;
  inventory: string | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let dayRecordTablesReady = false;

export async function readDayRecords() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDayRecordTables();

  const submissionRows = (await sql`
    select
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      status,
      submitted_by_user_id,
      submitted_by_name,
      submitted_at::text as submitted_at
    from day_submissions
    order by work_date desc, project_id
  `) as DaySubmissionRow[];

  const notesRows = (await sql`
    select
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      notes,
      inventory
    from day_notes
    order by work_date desc, project_id
  `) as DayNotesRow[];

  const daySubmissions: StoredDaySubmissionsByKey = {};
  const dayEntryNotesByKey: StoredDayEntryNotesByKey = {};

  for (const row of submissionRows) {
    if (row.status !== "draft" && row.status !== "submitted") {
      continue;
    }

    daySubmissions[getDayKey(row.project_id, row.date)] = {
      status: row.status,
      ...(row.submitted_by_user_id ? { submittedByUserId: row.submitted_by_user_id } : {}),
      ...(row.submitted_by_name ? { submittedByName: row.submitted_by_name } : {}),
      ...(row.submitted_at ? { submittedAt: row.submitted_at } : {})
    };
  }

  for (const row of notesRows) {
    dayEntryNotesByKey[getDayKey(row.project_id, row.date)] = {
      inventory: row.inventory ?? "",
      notes: row.notes ?? ""
    };
  }

  return {
    dayEntryNotesByKey,
    daySubmissions
  };
}

export async function replaceDayRecords(
  daySubmissions: StoredDaySubmissionsByKey,
  dayEntryNotesByKey: StoredDayEntryNotesByKey
) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDayRecordTables();

  const normalizedSubmissions = normalizeDaySubmissions(daySubmissions);
  const normalizedNotes = normalizeDayNotes(dayEntryNotesByKey);
  const queries = [sql`delete from day_submissions`, sql`delete from day_notes`];

  for (const submission of normalizedSubmissions) {
    queries.push(sql`
      insert into day_submissions (
        project_id,
        work_date,
        status,
        submitted_by_user_id,
        submitted_by_name,
        submitted_at,
        raw_submission,
        updated_at
      )
      values (
        ${submission.projectId},
        ${submission.date}::date,
        ${submission.value.status},
        ${submission.value.submittedByUserId ?? null},
        ${submission.value.submittedByName ?? null},
        ${isValidTimestamp(submission.value.submittedAt) ? submission.value.submittedAt : null}::timestamptz,
        ${JSON.stringify(submission.value)}::jsonb,
        now()
      )
    `);
  }

  for (const dayNotes of normalizedNotes) {
    queries.push(sql`
      insert into day_notes (
        project_id,
        work_date,
        notes,
        inventory,
        raw_notes,
        updated_at
      )
      values (
        ${dayNotes.projectId},
        ${dayNotes.date}::date,
        ${dayNotes.value.notes},
        ${dayNotes.value.inventory},
        ${JSON.stringify(dayNotes.value)}::jsonb,
        now()
      )
    `);
  }

  await sql.transaction(queries);

  return {
    dayNotes: normalizedNotes.length,
    daySubmissions: normalizedSubmissions.length
  };
}

export async function upsertDayNotes(projectId: string, date: string, dayNotes: StoredDayEntryNotes) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDayRecordTables();

  const normalizedProjectId = readString(projectId);
  const normalizedDate = readString(date);

  if (!normalizedProjectId || !isIsoDate(normalizedDate)) {
    return false;
  }

  const normalizedNotes = {
    inventory: readString(dayNotes.inventory),
    notes: readString(dayNotes.notes)
  };

  await sql`
    insert into day_notes (
      project_id,
      work_date,
      notes,
      inventory,
      raw_notes,
      updated_at
    )
    values (
      ${normalizedProjectId},
      ${normalizedDate}::date,
      ${normalizedNotes.notes},
      ${normalizedNotes.inventory},
      ${JSON.stringify(normalizedNotes)}::jsonb,
      now()
    )
    on conflict (project_id, work_date) do update
    set notes = excluded.notes,
        inventory = excluded.inventory,
        raw_notes = excluded.raw_notes,
        updated_at = now()
  `;

  return true;
}

export async function upsertDaySubmission(projectId: string, date: string, daySubmission: StoredDaySubmission) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDayRecordTables();

  const normalizedProjectId = readString(projectId);
  const normalizedDate = readString(date);

  if (
    !normalizedProjectId ||
    !isIsoDate(normalizedDate) ||
    (daySubmission.status !== "draft" && daySubmission.status !== "submitted")
  ) {
    return false;
  }

  await sql`
    insert into day_submissions (
      project_id,
      work_date,
      status,
      submitted_by_user_id,
      submitted_by_name,
      submitted_at,
      raw_submission,
      updated_at
    )
    values (
      ${normalizedProjectId},
      ${normalizedDate}::date,
      ${daySubmission.status},
      ${daySubmission.submittedByUserId ?? null},
      ${daySubmission.submittedByName ?? null},
      ${isValidTimestamp(daySubmission.submittedAt) ? daySubmission.submittedAt : null}::timestamptz,
      ${JSON.stringify(daySubmission)}::jsonb,
      now()
    )
    on conflict (project_id, work_date) do update
    set status = excluded.status,
        submitted_by_user_id = excluded.submitted_by_user_id,
        submitted_by_name = excluded.submitted_by_name,
        submitted_at = excluded.submitted_at,
        raw_submission = excluded.raw_submission,
        updated_at = now()
  `;

  return true;
}

export async function deleteDaySubmission(projectId: string, date: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDayRecordTables();

  const normalizedProjectId = readString(projectId);
  const normalizedDate = readString(date);

  if (!normalizedProjectId || !isIsoDate(normalizedDate)) {
    return false;
  }

  await sql`
    delete from day_submissions
    where project_id = ${normalizedProjectId}
      and work_date = ${normalizedDate}::date
  `;

  return true;
}

async function ensureDayRecordTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (dayRecordTablesReady) {
    return;
  }

  await sql`
    create table if not exists day_submissions (
      project_id text not null,
      work_date date not null,
      status text not null,
      submitted_by_user_id text,
      submitted_by_name text,
      submitted_at timestamptz,
      raw_submission jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date)
    )
  `;

  await sql`
    create table if not exists day_notes (
      project_id text not null,
      work_date date not null,
      notes text not null default '',
      inventory text not null default '',
      raw_notes jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date)
    )
  `;

  await sql`create index if not exists day_submissions_date_idx on day_submissions (work_date)`;
  await sql`create index if not exists day_notes_date_idx on day_notes (work_date)`;

  dayRecordTablesReady = true;
}

function normalizeDaySubmissions(daySubmissions: StoredDaySubmissionsByKey) {
  return Object.entries(daySubmissions).flatMap(([dayKey, value]) => {
    const parsedDayKey = parseDayKey(dayKey);

    if (!parsedDayKey || (value.status !== "draft" && value.status !== "submitted")) {
      return [];
    }

    return [
      {
        ...parsedDayKey,
        value
      }
    ];
  });
}

function normalizeDayNotes(dayEntryNotesByKey: StoredDayEntryNotesByKey) {
  return Object.entries(dayEntryNotesByKey).flatMap(([dayKey, value]) => {
    const parsedDayKey = parseDayKey(dayKey);

    if (!parsedDayKey) {
      return [];
    }

    return [
      {
        ...parsedDayKey,
        value: {
          inventory: readString(value.inventory),
          notes: readString(value.notes)
        }
      }
    ];
  });
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

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}
