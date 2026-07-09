import { getSql } from "@/lib/db";
import type { AllocationEntry, CrewAllocation, CrewLaborType } from "@/lib/procore/types";

export type AppStateMirrorStatus = "not_configured" | "success";

type CrewMember = {
  id: string;
  laborType?: CrewLaborType;
  name: string;
  jobTitle: string;
  subcontractorCompany?: string;
};

type SharedAppStateRecord = Record<string, unknown>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let normalizedTablesReady = false;
const DEFAULT_CREW_LABOR_TYPE: CrewLaborType = "chinchor_employee";

export async function mirrorSharedAppStateToTables(state: unknown): Promise<AppStateMirrorStatus> {
  const sql = getSql();

  if (!sql) {
    return "not_configured";
  }

  const appState = asRecord(state);

  await ensureNormalizedAppStateTables();
  await clearNormalizedAppStateTables();

  await mirrorCrewDirectory(appState);
  await mirrorProjectCrewMembers(appState);
  await mirrorDailyEntries(appState);
  await mirrorDaySubmissions(appState);
  await mirrorDayNotes(appState);
  await mirrorDailyReports(appState);
  await mirrorDailyReportUploads(appState);
  await mirrorMyJobs(appState);
  await mirrorProjectBlacklist(appState);
  await mirrorSyncLog(appState);

  return "success";
}

async function ensureNormalizedAppStateTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (normalizedTablesReady) {
    return;
  }

  await sql`
    create table if not exists crew_members (
      id text primary key,
      name text not null,
      job_title text not null,
      labor_type text not null default 'chinchor_employee',
      subcontractor_company text,
      raw_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists project_crew_members (
      project_id text not null,
      crew_member_id text not null,
      crew_member_name text not null,
      job_title text not null,
      labor_type text not null default 'chinchor_employee',
      subcontractor_company text,
      raw_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (project_id, crew_member_id)
    )
  `;

  await sql`
    create table if not exists daily_entries (
      id text primary key,
      project_id text not null,
      project_name text,
      work_date date not null,
      pay_item_id text not null,
      pay_item_code text not null,
      pay_item_name text not null,
      pay_item_budgeted_quantity numeric,
      pay_item_unit_of_measure text,
      hours numeric not null default 0,
      quantity_completed numeric not null default 0,
      saved_by_user_id text,
      saved_by_name text,
      saved_at timestamptz,
      raw_entry jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists daily_entry_crew_allocations (
      entry_id text not null,
      crew_member_id text not null,
      crew_member_name text not null,
      job_title text not null,
      labor_type text not null default 'chinchor_employee',
      subcontractor_company text,
      hours numeric not null default 0,
      raw_allocation jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (entry_id, crew_member_id)
    )
  `;

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

  await sql`
    create table if not exists my_jobs (
      user_id text not null,
      project_id text not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, project_id)
    )
  `;

  await sql`
    create table if not exists project_blacklist (
      project_id text primary key,
      blacklisted_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists sync_log_entries (
      id text primary key,
      action text not null,
      status text not null,
      created_at timestamptz,
      message text not null,
      summary jsonb,
      raw_log jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table crew_members add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table crew_members add column if not exists subcontractor_company text`;
  await sql`alter table project_crew_members add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table project_crew_members add column if not exists subcontractor_company text`;
  await sql`alter table daily_entry_crew_allocations add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table daily_entry_crew_allocations add column if not exists subcontractor_company text`;
  await sql`create index if not exists daily_entries_project_date_idx on daily_entries (project_id, work_date)`;
  await sql`create index if not exists daily_entries_pay_item_idx on daily_entries (pay_item_code, pay_item_id)`;
  await sql`create index if not exists daily_entry_crew_allocations_crew_idx on daily_entry_crew_allocations (crew_member_id)`;
  await sql`create index if not exists daily_entry_crew_allocations_labor_type_idx on daily_entry_crew_allocations (labor_type)`;
  await sql`create index if not exists daily_reports_date_idx on daily_reports (work_date)`;
  await sql`create index if not exists sync_log_entries_created_at_idx on sync_log_entries (created_at)`;

  normalizedTablesReady = true;
}

async function clearNormalizedAppStateTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`delete from daily_entry_crew_allocations`;
  await sql`delete from daily_entries`;
  await sql`delete from day_submissions`;
  await sql`delete from day_notes`;
  await sql`delete from daily_reports`;
  await sql`delete from daily_report_uploads`;
  await sql`delete from project_crew_members`;
  await sql`delete from crew_members`;
  await sql`delete from my_jobs`;
  await sql`delete from project_blacklist`;
  await sql`delete from sync_log_entries`;
}

async function mirrorCrewDirectory(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  for (const crewMember of asArray<CrewMember>(appState.crewDirectory)) {
    const normalizedCrewMember = normalizeCrewMember(crewMember);

    if (!normalizedCrewMember) {
      continue;
    }

    await upsertCrewMember(normalizedCrewMember, crewMember);
  }
}

async function mirrorProjectCrewMembers(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const crewMembersByProject = asRecord(appState.crewMembersByProject);

  for (const [projectId, crewMembers] of Object.entries(crewMembersByProject)) {
    if (!projectId) {
      continue;
    }

    for (const crewMember of asArray<CrewMember>(crewMembers)) {
      const normalizedCrewMember = normalizeCrewMember(crewMember);

      if (!normalizedCrewMember) {
        continue;
      }

      await upsertCrewMember(normalizedCrewMember, crewMember);

      await sql`
        insert into project_crew_members (
        project_id,
        crew_member_id,
        crew_member_name,
        job_title,
        labor_type,
        subcontractor_company,
        raw_data,
        updated_at
      )
        values (
          ${projectId},
        ${normalizedCrewMember.id},
        ${normalizedCrewMember.name},
        ${normalizedCrewMember.jobTitle},
        ${normalizedCrewMember.laborType},
        ${normalizedCrewMember.subcontractorCompany ?? null},
        ${toJson(crewMember)}::jsonb,
        now()
      )
      on conflict (project_id, crew_member_id) do update
      set crew_member_name = excluded.crew_member_name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
      `;
    }
  }
}

async function mirrorDailyEntries(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  for (const entry of asArray<AllocationEntry>(appState.entries)) {
    const normalizedEntry = normalizeAllocationEntry(entry);

    if (!normalizedEntry) {
      continue;
    }

    await sql`
      insert into daily_entries (
        id,
        project_id,
        project_name,
        work_date,
        pay_item_id,
        pay_item_code,
        pay_item_name,
        pay_item_budgeted_quantity,
        pay_item_unit_of_measure,
        hours,
        quantity_completed,
        saved_by_user_id,
        saved_by_name,
        saved_at,
        raw_entry,
        updated_at
      )
      values (
        ${normalizedEntry.id},
        ${normalizedEntry.projectId},
        ${normalizedEntry.projectName},
        ${normalizedEntry.date}::date,
        ${normalizedEntry.payItemId},
        ${normalizedEntry.payItemCode},
        ${normalizedEntry.payItemName},
        ${normalizedEntry.payItemBudgetedQuantity},
        ${normalizedEntry.payItemUnitOfMeasure},
        ${normalizedEntry.hours},
        ${normalizedEntry.quantityCompleted},
        ${normalizedEntry.savedByUserId},
        ${normalizedEntry.savedByName},
        ${normalizedEntry.savedAt}::timestamptz,
        ${toJson(entry)}::jsonb,
        now()
      )
      on conflict (id) do update
      set project_id = excluded.project_id,
          project_name = excluded.project_name,
          work_date = excluded.work_date,
          pay_item_id = excluded.pay_item_id,
          pay_item_code = excluded.pay_item_code,
          pay_item_name = excluded.pay_item_name,
          pay_item_budgeted_quantity = excluded.pay_item_budgeted_quantity,
          pay_item_unit_of_measure = excluded.pay_item_unit_of_measure,
          hours = excluded.hours,
          quantity_completed = excluded.quantity_completed,
          saved_by_user_id = excluded.saved_by_user_id,
          saved_by_name = excluded.saved_by_name,
          saved_at = excluded.saved_at,
          raw_entry = excluded.raw_entry,
          updated_at = now()
    `;

    for (const allocation of normalizedEntry.crewAllocations) {
      await sql`
        insert into daily_entry_crew_allocations (
          entry_id,
          crew_member_id,
          crew_member_name,
          job_title,
          labor_type,
          subcontractor_company,
          hours,
          raw_allocation,
          updated_at
        )
        values (
          ${normalizedEntry.id},
          ${allocation.crewMemberId},
          ${allocation.crewMemberName},
          ${allocation.jobTitle},
          ${allocation.laborType},
          ${allocation.subcontractorCompany ?? null},
          ${allocation.hours},
          ${toJson(allocation.rawAllocation)}::jsonb,
          now()
        )
        on conflict (entry_id, crew_member_id) do update
        set crew_member_name = excluded.crew_member_name,
            job_title = excluded.job_title,
            labor_type = excluded.labor_type,
            subcontractor_company = excluded.subcontractor_company,
            hours = excluded.hours,
            raw_allocation = excluded.raw_allocation,
            updated_at = now()
      `;
    }
  }
}

async function mirrorDaySubmissions(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const daySubmissions = asRecord(appState.daySubmissions);

  for (const [dayKey, value] of Object.entries(daySubmissions)) {
    const parsedDayKey = parseDayKey(dayKey);
    const submission = asRecord(value);
    const status = readString(submission, "status");

    if (!parsedDayKey || (status !== "draft" && status !== "submitted")) {
      continue;
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
        ${parsedDayKey.projectId},
        ${parsedDayKey.date}::date,
        ${status},
        ${readNullableString(submission, "submittedByUserId")},
        ${readNullableString(submission, "submittedByName")},
        ${readNullableTimestamp(submission, "submittedAt")}::timestamptz,
        ${toJson(value)}::jsonb,
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
  }
}

async function mirrorDayNotes(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const dayNotes = asRecord(appState.dayEntryNotesByKey);

  for (const [dayKey, value] of Object.entries(dayNotes)) {
    const parsedDayKey = parseDayKey(dayKey);
    const notes = asRecord(value);

    if (!parsedDayKey) {
      continue;
    }

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
        ${parsedDayKey.projectId},
        ${parsedDayKey.date}::date,
        ${readString(notes, "notes")},
        ${readString(notes, "inventory")},
        ${toJson(value)}::jsonb,
        now()
      )
      on conflict (project_id, work_date) do update
      set notes = excluded.notes,
          inventory = excluded.inventory,
          raw_notes = excluded.raw_notes,
          updated_at = now()
    `;
  }
}

async function mirrorDailyReports(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const dailyReports = asRecord(appState.dailyReportsByKey);

  for (const [dayKey, value] of Object.entries(dailyReports)) {
    const parsedDayKey = parseDayKey(dayKey);
    const report = asRecord(value);
    const projectId = readNullableString(report, "projectId") ?? parsedDayKey?.projectId;
    const date = readNullableString(report, "date") ?? parsedDayKey?.date;

    if (!projectId || !isIsoDate(date)) {
      continue;
    }

    await sql`
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
        ${projectId},
        ${date}::date,
        ${readNullableString(report, "createdByUserId")},
        ${readNullableString(report, "createdByName")},
        ${readNullableTimestamp(report, "createdAt")}::timestamptz,
        ${readNullableTimestamp(report, "updatedAt")}::timestamptz,
        ${toJson(value)}::jsonb,
        now()
      )
      on conflict (project_id, work_date) do update
      set created_by_user_id = excluded.created_by_user_id,
          created_by_name = excluded.created_by_name,
          created_at = excluded.created_at,
          report_updated_at = excluded.report_updated_at,
          report = excluded.report,
          updated_at = now()
    `;
  }
}

async function mirrorDailyReportUploads(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const dailyReportUploads = asRecord(appState.dailyReportUploadsByKey);

  for (const [dayKey, value] of Object.entries(dailyReportUploads)) {
    const parsedDayKey = parseDayKey(dayKey);
    const upload = asRecord(value);
    const fileName = readString(upload, "fileName");
    const folderPath = readString(upload, "folderPath");

    if (!parsedDayKey || !fileName || !folderPath) {
      continue;
    }

    await sql`
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
        ${parsedDayKey.projectId},
        ${parsedDayKey.date}::date,
        ${fileName},
        ${folderPath},
        ${readNullableString(upload, "procoreFileId")},
        ${readNullableTimestamp(upload, "uploadedAt")}::timestamptz,
        ${toJson(value)}::jsonb,
        now()
      )
      on conflict (project_id, work_date) do update
      set file_name = excluded.file_name,
          folder_path = excluded.folder_path,
          procore_file_id = excluded.procore_file_id,
          uploaded_at = excluded.uploaded_at,
          upload = excluded.upload,
          updated_at = now()
    `;
  }
}

async function mirrorMyJobs(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const myJobsByUser = asRecord(appState.myJobsByUser);

  for (const [userId, projectIds] of Object.entries(myJobsByUser)) {
    if (!userId) {
      continue;
    }

    for (const projectId of asArray<string>(projectIds)) {
      if (typeof projectId !== "string" || !projectId) {
        continue;
      }

      await sql`
        insert into my_jobs (user_id, project_id, updated_at)
        values (${userId}, ${projectId}, now())
        on conflict (user_id, project_id) do update
        set updated_at = now()
      `;
    }
  }
}

async function mirrorProjectBlacklist(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const projectBlacklistById = asRecord(appState.projectBlacklistById);

  for (const [projectId, isBlacklisted] of Object.entries(projectBlacklistById)) {
    if (!projectId || !isBlacklisted) {
      continue;
    }

    await sql`
      insert into project_blacklist (project_id, blacklisted_at)
      values (${projectId}, now())
      on conflict (project_id) do nothing
    `;
  }
}

async function mirrorSyncLog(appState: SharedAppStateRecord) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  for (const logEntry of asArray<Record<string, unknown>>(appState.syncLog)) {
    const id = readString(logEntry, "id");
    const action = readString(logEntry, "action");
    const status = readString(logEntry, "status");
    const message = readString(logEntry, "message");

    if (!id || !action || !status || !message) {
      continue;
    }

    await sql`
      insert into sync_log_entries (
        id,
        action,
        status,
        created_at,
        message,
        summary,
        raw_log,
        updated_at
      )
      values (
        ${id},
        ${action},
        ${status},
        ${readNullableTimestamp(logEntry, "createdAt")}::timestamptz,
        ${message},
        ${toNullableJson(logEntry.summary)}::jsonb,
        ${toJson(logEntry)}::jsonb,
        now()
      )
      on conflict (id) do update
      set action = excluded.action,
          status = excluded.status,
          created_at = excluded.created_at,
          message = excluded.message,
          summary = excluded.summary,
          raw_log = excluded.raw_log,
          updated_at = now()
    `;
  }
}

async function upsertCrewMember(crewMember: CrewMember, rawData: unknown) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    insert into crew_members (
      id,
      name,
      job_title,
      labor_type,
      subcontractor_company,
      raw_data,
      updated_at
    )
    values (
      ${crewMember.id},
      ${crewMember.name},
      ${crewMember.jobTitle},
      ${crewMember.laborType},
      ${crewMember.subcontractorCompany ?? null},
      ${toJson(rawData)}::jsonb,
      now()
    )
    on conflict (id) do update
    set name = excluded.name,
        job_title = excluded.job_title,
        labor_type = excluded.labor_type,
        subcontractor_company = excluded.subcontractor_company,
        raw_data = excluded.raw_data,
        updated_at = now()
  `;
}

function normalizeCrewMember(value: unknown): CrewMember | null {
  const crewMember = asRecord(value);
  const id = readString(crewMember, "id");
  const name = readString(crewMember, "name");

  if (!id || !name) {
    return null;
  }

  const laborType = normalizeCrewLaborType(crewMember.laborType);
  const subcontractorCompany =
    readNullableString(crewMember, "subcontractorCompany") ?? (laborType === "subcontractor" ? name : undefined);

  return {
    id,
    name: laborType === "subcontractor" ? subcontractorCompany ?? name : name,
    jobTitle: laborType === "subcontractor" ? "Subcontractor" : readString(crewMember, "jobTitle"),
    laborType,
    subcontractorCompany
  };
}

function normalizeAllocationEntry(value: AllocationEntry | unknown) {
  const entry = asRecord(value);
  const id = readString(entry, "id");
  const projectId = readString(entry, "projectId");
  const date = readString(entry, "date");
  const payItemId = readString(entry, "payItemId");
  const payItemCode = readString(entry, "payItemCode");
  const payItemName = readString(entry, "payItemName");

  if (!id || !projectId || !isIsoDate(date) || !payItemId || !payItemCode || !payItemName) {
    return null;
  }

  return {
    id,
    projectId,
    projectName: readNullableString(entry, "projectName"),
    date,
    payItemId,
    payItemCode,
    payItemName,
    payItemBudgetedQuantity: readNullableNumber(entry, "payItemBudgetedQuantity"),
    payItemUnitOfMeasure: readNullableString(entry, "payItemUnitOfMeasure"),
    hours: readNumber(entry, "hours"),
    quantityCompleted: readNumber(entry, "quantityCompleted"),
    crewAllocations: asArray<CrewAllocation>(entry.crewAllocations)
      .map(normalizeCrewAllocation)
      .filter((allocation) => allocation !== null),
    savedByUserId: readNullableString(entry, "savedByUserId"),
    savedByName: readNullableString(entry, "savedByName"),
    savedAt: readNullableTimestamp(entry, "savedAt")
  };
}

function normalizeCrewAllocation(value: CrewAllocation | unknown) {
  const allocation = asRecord(value);
  const crewMemberId = readString(allocation, "crewMemberId");
  const crewMemberName = readString(allocation, "crewMemberName");

  if (!crewMemberId || !crewMemberName) {
    return null;
  }

  const laborType = normalizeCrewLaborType(allocation.laborType);
  const subcontractorCompany =
    readNullableString(allocation, "subcontractorCompany") ?? (laborType === "subcontractor" ? crewMemberName : undefined);

  return {
    crewMemberId,
    crewMemberName: laborType === "subcontractor" ? subcontractorCompany ?? crewMemberName : crewMemberName,
    jobTitle: laborType === "subcontractor" ? "Subcontractor" : readString(allocation, "jobTitle"),
    laborType,
    subcontractorCompany,
    hours: readNumber(allocation, "hours"),
    rawAllocation: value
  };
}

function parseDayKey(dayKey: string) {
  const [projectId, date] = dayKey.split("|");

  if (!projectId || !isIsoDate(date)) {
    return null;
  }

  return { projectId, date };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asArray<TValue>(value: unknown): TValue[] {
  return Array.isArray(value) ? (value as TValue[]) : [];
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  return value || null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function normalizeCrewLaborType(value: unknown): CrewLaborType {
  if (value === "subcontractor" || value === "temp_employee" || value === "chinchor_employee") {
    return value;
  }

  return DEFAULT_CREW_LABOR_TYPE;
}

function readNullableNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
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

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function toNullableJson(value: unknown) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}
