import { isIsoDate } from "@/lib/day-key";
import { isValidTimestamp } from "@/lib/date";
import { getSql } from "@/lib/db";
import { normalizeNumericCostCode } from "@/lib/pay-items";
import {
  rebuildEntryReportRollups,
  refreshEntryReportRollupsForDays,
  type ReportRollupDayKey
} from "@/lib/report-rollups";
import { normalizeCrewLaborType, type AllocationEntry, type CrewAllocation } from "@/lib/domain/types";
import { readNullableNumber, readNumber, readOptionalNumber, readStringList } from "@/lib/records";

type EntryRow = {
  id: string;
  project_id: string;
  project_name: string | null;
  date: string;
  pay_item_id: string;
  pay_item_code: string;
  pay_item_name: string;
  pay_item_budgeted_quantity: number | string | null;
  pay_item_unit_of_measure: string | null;
  hours: number | string | null;
  quantity_completed: number | string | null;
  saved_by_user_id: string | null;
  saved_by_name: string | null;
  saved_at: string | null;
};

type CrewAllocationRow = {
  entry_id: string;
  crew_member_id: string;
  crew_member_name: string;
  job_title: string;
  labor_type: string | null;
  subcontractor_company: string | null;
  hours: number | string | null;
};

export type AllocationEntryReportFilters = {
  endDate?: string;
  payItemQuery?: string;
  projectIds?: string[];
  startDate?: string;
};

let dailyEntryTablesReady = false;

export async function readAllocationEntries() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  const entryRows = (await sql`
    select
      id,
      project_id,
      project_name,
      to_char(work_date, 'YYYY-MM-DD') as date,
      pay_item_id,
      pay_item_code,
      pay_item_name,
      pay_item_budgeted_quantity,
      pay_item_unit_of_measure,
      hours,
      quantity_completed,
      saved_by_user_id,
      saved_by_name,
      saved_at::text as saved_at
    from daily_entries
    order by work_date desc, project_name nulls last, pay_item_code, pay_item_name
  `) as EntryRow[];

  return readEntriesWithAllocations(entryRows);
}

export async function readAllocationEntriesForReport(filters: AllocationEntryReportFilters) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  const projectIds = readStringList(filters.projectIds);

  if (filters.projectIds && projectIds.length === 0) {
    return [];
  }

  const startDate = isIsoDate(filters.startDate ?? "") ? filters.startDate : null;
  const endDate = isIsoDate(filters.endDate ?? "") ? filters.endDate : null;
  const normalizedPayItemQuery = filters.payItemQuery?.trim().toLowerCase() ?? "";
  const payItemQuery = normalizedPayItemQuery ? `%${normalizedPayItemQuery}%` : "";
  const projectIdsJson = JSON.stringify(projectIds);
  const entryRows = (await sql`
    select
      id,
      project_id,
      project_name,
      to_char(work_date, 'YYYY-MM-DD') as date,
      pay_item_id,
      pay_item_code,
      pay_item_name,
      pay_item_budgeted_quantity,
      pay_item_unit_of_measure,
      hours,
      quantity_completed,
      saved_by_user_id,
      saved_by_name,
      saved_at::text as saved_at
    from daily_entries
    where (${projectIds.length === 0}::boolean or project_id in (
      select value
      from jsonb_array_elements_text(${projectIdsJson}::jsonb)
    ))
      and (${startDate}::date is null or work_date >= ${startDate}::date)
      and (${endDate}::date is null or work_date <= ${endDate}::date)
      and (${payItemQuery} = '' or lower(pay_item_code || ' ' || pay_item_name) like ${payItemQuery})
    order by work_date desc, project_name nulls last, pay_item_code, pay_item_name
  `) as EntryRow[];

  return readEntriesWithAllocations(entryRows);
}

async function readEntriesWithAllocations(entryRows: EntryRow[]) {
  const sql = getSql();

  if (!sql || entryRows.length === 0) {
    return [];
  }

  const entryIdsJson = JSON.stringify(entryRows.map((entryRow) => entryRow.id));
  const allocationRows = (await sql`
    select
      entry_id,
      crew_member_id,
      crew_member_name,
      job_title,
      labor_type,
      subcontractor_company,
      hours
    from daily_entry_crew_allocations
    where entry_id in (
      select value
      from jsonb_array_elements_text(${entryIdsJson}::jsonb)
    )
    order by crew_member_name, crew_member_id
  `) as CrewAllocationRow[];

  const allocationsByEntryId = new Map<string, CrewAllocation[]>();

  for (const allocationRow of allocationRows) {
    const allocations = allocationsByEntryId.get(allocationRow.entry_id) ?? [];
    allocations.push({
      crewMemberId: allocationRow.crew_member_id,
      crewMemberName: allocationRow.crew_member_name,
      jobTitle: allocationRow.job_title,
      laborType: normalizeCrewLaborType(allocationRow.labor_type),
      subcontractorCompany: allocationRow.subcontractor_company ?? undefined,
      hours: readNumber(allocationRow.hours)
    });
    allocationsByEntryId.set(allocationRow.entry_id, allocations);
  }

  return entryRows
    .map((entryRow) => {
      const payItemCode = normalizeNumericCostCode(entryRow.pay_item_code);

      if (!payItemCode) {
        return null;
      }

      return {
        id: entryRow.id,
        projectId: entryRow.project_id,
        projectName: entryRow.project_name ?? undefined,
        date: entryRow.date,
        payItemId: entryRow.pay_item_id,
        payItemCode,
        payItemName: entryRow.pay_item_name,
        payItemBudgetedQuantity: readOptionalNumber(entryRow.pay_item_budgeted_quantity),
        payItemUnitOfMeasure: entryRow.pay_item_unit_of_measure ?? undefined,
        hours: readNumber(entryRow.hours),
        quantityCompleted: readNumber(entryRow.quantity_completed),
        crewAllocations: allocationsByEntryId.get(entryRow.id) ?? [],
        savedByUserId: entryRow.saved_by_user_id ?? undefined,
        savedByName: entryRow.saved_by_name ?? undefined,
        savedAt: entryRow.saved_at ?? undefined
      };
    })
    .filter((entry) => entry !== null);
}

export async function replaceAllocationEntries(entries: AllocationEntry[]) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  const normalizedEntries = entries.map(normalizeAllocationEntry).filter((entry) => entry !== null);
  const queries = [sql`delete from daily_entry_crew_allocations`, sql`delete from daily_entries`];

  for (const entry of normalizedEntries) {
    queries.push(sql`
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
        ${entry.id},
        ${entry.projectId},
        ${entry.projectName},
        ${entry.date}::date,
        ${entry.payItemId},
        ${entry.payItemCode},
        ${entry.payItemName},
        ${entry.payItemBudgetedQuantity},
        ${entry.payItemUnitOfMeasure},
        ${entry.hours},
        ${entry.quantityCompleted},
        ${entry.savedByUserId},
        ${entry.savedByName},
        ${entry.savedAt}::timestamptz,
        ${JSON.stringify(entry.rawEntry)}::jsonb,
        now()
      )
    `);

    for (const allocation of entry.crewAllocations) {
      queries.push(sql`
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
          ${entry.id},
          ${allocation.crewMemberId},
          ${allocation.crewMemberName},
          ${allocation.jobTitle},
          ${allocation.laborType},
          ${allocation.subcontractorCompany ?? null},
          ${allocation.hours},
          ${JSON.stringify(allocation.rawAllocation)}::jsonb,
          now()
        )
      `);
    }
  }

  await sql.transaction(queries);
  await refreshEntryRollupsAfterWrite(rebuildEntryReportRollups);

  return {
    crewAllocations: normalizedEntries.reduce((total, entry) => total + entry.crewAllocations.length, 0),
    entries: normalizedEntries.length
  };
}

export async function upsertAllocationEntries(entries: AllocationEntry[]) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  const normalizedEntries = entries.map(normalizeAllocationEntry).filter((entry) => entry !== null);

  if (normalizedEntries.length === 0) {
    return {
      crewAllocations: 0,
      entries: 0
    };
  }

  const queries = [];
  const existingDays = await readExistingEntryDays(normalizedEntries.map((entry) => entry.id));

  for (const entry of normalizedEntries) {
    queries.push(sql`delete from daily_entry_crew_allocations where entry_id = ${entry.id}`);
    queries.push(sql`
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
        ${entry.id},
        ${entry.projectId},
        ${entry.projectName},
        ${entry.date}::date,
        ${entry.payItemId},
        ${entry.payItemCode},
        ${entry.payItemName},
        ${entry.payItemBudgetedQuantity},
        ${entry.payItemUnitOfMeasure},
        ${entry.hours},
        ${entry.quantityCompleted},
        ${entry.savedByUserId},
        ${entry.savedByName},
        ${entry.savedAt}::timestamptz,
        ${JSON.stringify(entry.rawEntry)}::jsonb,
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
    `);

    for (const allocation of entry.crewAllocations) {
      queries.push(sql`
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
          ${entry.id},
          ${allocation.crewMemberId},
          ${allocation.crewMemberName},
          ${allocation.jobTitle},
          ${allocation.laborType},
          ${allocation.subcontractorCompany ?? null},
          ${allocation.hours},
          ${JSON.stringify(allocation.rawAllocation)}::jsonb,
          now()
        )
      `);
    }
  }

  await sql.transaction(queries);
  await refreshEntryRollupsAfterWrite(() =>
    refreshEntryReportRollupsForDays([
      ...existingDays,
      ...normalizedEntries.map((entry) => ({
        date: entry.date,
        projectId: entry.projectId
      }))
    ])
  );

  return {
    crewAllocations: normalizedEntries.reduce((total, entry) => total + entry.crewAllocations.length, 0),
    entries: normalizedEntries.length
  };
}

export async function deleteAllocationEntry(entryId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  const existingDays = await readExistingEntryDays([entryId]);

  await sql.transaction([
    sql`delete from daily_entry_crew_allocations where entry_id = ${entryId}`,
    sql`delete from daily_entries where id = ${entryId}`
  ]);
  await refreshEntryRollupsAfterWrite(() => refreshEntryReportRollupsForDays(existingDays));

  return true;
}

export async function deleteAllocationEntriesForDay(projectId: string, date: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureDailyEntryTables();

  await sql.transaction([
    sql`
      delete from daily_entry_crew_allocations
      where entry_id in (
        select id
        from daily_entries
        where project_id = ${projectId}
          and work_date = ${date}::date
      )
    `,
    sql`
      delete from daily_entries
      where project_id = ${projectId}
        and work_date = ${date}::date
    `
  ]);
  await refreshEntryRollupsAfterWrite(() => refreshEntryReportRollupsForDays([{ date, projectId }]));

  return true;
}

async function readExistingEntryDays(entryIds: string[]): Promise<ReportRollupDayKey[]> {
  const sql = getSql();
  const normalizedEntryIds = readStringList(entryIds);

  if (!sql || normalizedEntryIds.length === 0) {
    return [];
  }

  const entryIdsJson = JSON.stringify(normalizedEntryIds);
  const rows = (await sql`
    select distinct project_id, to_char(work_date, 'YYYY-MM-DD') as date
    from daily_entries
    where id in (
      select value
      from jsonb_array_elements_text(${entryIdsJson}::jsonb)
    )
  `) as Array<{ date: string; project_id: string }>;

  return rows.map((row) => ({
    date: row.date,
    projectId: row.project_id
  }));
}

async function refreshEntryRollupsAfterWrite(refresh: () => Promise<unknown>) {
  try {
    await refresh();
  } catch (error) {
    console.error("Unable to refresh entry report rollups.", error);
  }
}

async function ensureDailyEntryTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (dailyEntryTablesReady) {
    return;
  }

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

  await sql`alter table daily_entry_crew_allocations add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table daily_entry_crew_allocations add column if not exists subcontractor_company text`;
  await sql`create index if not exists daily_entries_project_date_idx on daily_entries (project_id, work_date)`;
  await sql`create index if not exists daily_entries_pay_item_idx on daily_entries (pay_item_code, pay_item_id)`;
  await sql`create index if not exists daily_entry_crew_allocations_crew_idx on daily_entry_crew_allocations (crew_member_id)`;
  await sql`create index if not exists daily_entry_crew_allocations_labor_type_idx on daily_entry_crew_allocations (labor_type)`;

  dailyEntryTablesReady = true;
}

function normalizeAllocationEntry(entry: AllocationEntry) {
  const payItemCode = normalizeNumericCostCode(entry.payItemCode);

  if (!entry.id || !entry.projectId || !isIsoDate(entry.date) || !entry.payItemId || !payItemCode || !entry.payItemName) {
    return null;
  }

  return {
    id: entry.id,
    projectId: entry.projectId,
    projectName: entry.projectName ?? null,
    date: entry.date,
    payItemId: entry.payItemId,
    payItemCode,
    payItemName: entry.payItemName,
    payItemBudgetedQuantity: readNullableNumber(entry.payItemBudgetedQuantity),
    payItemUnitOfMeasure: entry.payItemUnitOfMeasure ?? null,
    hours: readNumber(entry.hours),
    quantityCompleted: readNumber(entry.quantityCompleted),
    crewAllocations: (entry.crewAllocations ?? []).map(normalizeCrewAllocation).filter((allocation) => allocation !== null),
    rawEntry: entry,
    savedAt: isValidTimestamp(entry.savedAt) ? entry.savedAt : null,
    savedByName: entry.savedByName ?? null,
    savedByUserId: entry.savedByUserId ?? null
  };
}

function normalizeCrewAllocation(allocation: CrewAllocation) {
  if (!allocation.crewMemberId || !allocation.crewMemberName) {
    return null;
  }

  const laborType = normalizeCrewLaborType(allocation.laborType);
  const subcontractorCompany = allocation.subcontractorCompany?.trim() || (laborType === "subcontractor" ? allocation.crewMemberName : "");

  return {
    crewMemberId: allocation.crewMemberId,
    crewMemberName: laborType === "subcontractor" ? subcontractorCompany : allocation.crewMemberName,
    hours: readNumber(allocation.hours),
    jobTitle: laborType === "subcontractor" ? "Subcontractor" : allocation.jobTitle ?? "",
    laborType,
    subcontractorCompany: subcontractorCompany || undefined,
    rawAllocation: allocation
  };
}
