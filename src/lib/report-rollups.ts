import { getSql } from "@/lib/db";
import type { DailyWorkReportSourceRow } from "@/lib/report-builders";

export type ReportRollupDayKey = {
  date: string;
  projectId: string;
};

export type ReportRollupFilters = {
  endDate?: string;
  projectIds?: string[];
  startDate?: string;
};

type CountRow = {
  count: number | string;
};

type DailyWorkRollupRow = {
  date: string;
  notes: string | null;
  pay_item_id: string;
  project_id: string;
  quantity: number | string | null;
  row_index: number | string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let reportRollupTablesReady = false;

export async function ensureReportRollupTables() {
  const sql = getSql();

  if (!sql || reportRollupTablesReady) {
    return;
  }

  await sql`
    create table if not exists pay_item_project_rollups (
      project_id text not null,
      work_date date not null,
      project_name text not null,
      pay_item_key text not null,
      pay_item_code text not null,
      pay_item_name text not null,
      unit_of_measure text,
      entry_count integer not null default 0,
      total_hours numeric not null default 0,
      total_quantity numeric not null default 0,
      rate_samples jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date, pay_item_key)
    )
  `;

  await sql`
    create table if not exists crew_performance_rollups (
      project_id text not null,
      work_date date not null,
      project_name text not null,
      pay_item_key text not null,
      pay_item_code text not null,
      pay_item_name text not null,
      unit_of_measure text,
      crew_member_id text not null,
      crew_member_name text not null,
      job_title text not null,
      labor_type text not null,
      subcontractor_company text,
      entry_count integer not null default 0,
      total_hours numeric not null default 0,
      total_quantity numeric not null default 0,
      rate_samples jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date, pay_item_key, crew_member_id)
    )
  `;

  await sql`
    create table if not exists daily_work_rollups (
      project_id text not null,
      work_date date not null,
      row_index integer not null,
      pay_item_id text not null,
      quantity numeric not null default 0,
      notes text not null default '',
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date, row_index)
    )
  `;

  await sql`
    create table if not exists pm_summary_rollups (
      project_id text not null,
      work_date date not null,
      project_name text not null,
      netsuite_project_manager_id text,
      netsuite_project_manager_name text,
      entry_count integer not null default 0,
      total_hours numeric not null default 0,
      daily_report_saved boolean not null default false,
      daily_work_row_count integer not null default 0,
      daily_work_total_quantity numeric not null default 0,
      procore_upload_status text not null default 'none',
      uploaded_image_count integer not null default 0,
      failed_image_count integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (project_id, work_date)
    )
  `;

  await sql`create index if not exists pay_item_project_rollups_date_idx on pay_item_project_rollups (work_date)`;
  await sql`create index if not exists pay_item_project_rollups_pay_item_idx on pay_item_project_rollups (pay_item_code, pay_item_key)`;
  await sql`create index if not exists crew_performance_rollups_date_idx on crew_performance_rollups (work_date)`;
  await sql`create index if not exists crew_performance_rollups_crew_idx on crew_performance_rollups (crew_member_id, labor_type)`;
  await sql`create index if not exists daily_work_rollups_project_date_idx on daily_work_rollups (project_id, work_date)`;
  await sql`create index if not exists pm_summary_rollups_pm_date_idx on pm_summary_rollups (netsuite_project_manager_id, work_date)`;

  reportRollupTablesReady = true;
}

export async function backfillReportRollupsIfEmpty() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureReportRollupTables();

  if (
    (await tableExists("daily_entries")) &&
    (!(await tableHasRows("pay_item_project_rollups")) || !(await tableHasRows("crew_performance_rollups")))
  ) {
    await rebuildEntryReportRollups();
  }

  if ((await tableExists("daily_reports")) && !(await tableHasRows("daily_work_rollups"))) {
    await rebuildDailyReportRollups();
  }

  return true;
}

export async function rebuildEntryReportRollups() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureReportRollupTables();

  await sql.transaction([
    sql`delete from crew_performance_rollups`,
    sql`delete from pay_item_project_rollups`
  ]);

  if (!(await tableExists("daily_entries"))) {
    await rebuildPmSummaryRollups();
    return true;
  }

  await insertPayItemProjectRollups();

  if (await tableExists("daily_entry_crew_allocations")) {
    await insertCrewPerformanceRollups();
  }

  await rebuildPmSummaryRollups();

  return true;
}

export async function refreshEntryReportRollupsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql) {
    return null;
  }

  if (normalizedDays.length === 0) {
    return true;
  }

  await ensureReportRollupTables();

  const daysJson = JSON.stringify(normalizedDays);

  await sql.transaction([
    sql`
      delete from pay_item_project_rollups
      where exists (
        select 1
        from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
        where pay_item_project_rollups.project_id = selected_days."projectId"
          and pay_item_project_rollups.work_date = selected_days."date"::date
      )
    `,
    sql`
      delete from crew_performance_rollups
      where exists (
        select 1
        from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
        where crew_performance_rollups.project_id = selected_days."projectId"
          and crew_performance_rollups.work_date = selected_days."date"::date
      )
    `
  ]);

  if (await tableExists("daily_entries")) {
    await insertPayItemProjectRollups(daysJson);

    if (await tableExists("daily_entry_crew_allocations")) {
      await insertCrewPerformanceRollups(daysJson);
    }
  }

  await refreshPmSummaryEntryMetricsForDays(normalizedDays);

  return true;
}

export async function rebuildDailyReportRollups() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureReportRollupTables();
  await sql`delete from daily_work_rollups`;

  if (await tableExists("daily_reports")) {
    await insertDailyWorkRollups();
  }

  await rebuildPmSummaryRollups();

  return true;
}

export async function refreshDailyReportRollupsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql) {
    return null;
  }

  if (normalizedDays.length === 0) {
    return true;
  }

  await ensureReportRollupTables();

  const daysJson = JSON.stringify(normalizedDays);

  await sql`
    delete from daily_work_rollups
    where exists (
      select 1
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      where daily_work_rollups.project_id = selected_days."projectId"
        and daily_work_rollups.work_date = selected_days."date"::date
    )
  `;

  if (await tableExists("daily_reports")) {
    await insertDailyWorkRollups(daysJson);
  }

  await refreshPmSummaryDailyReportMetricsForDays(normalizedDays);

  return true;
}

export async function refreshPmSummaryRollupsForDays(days: ReportRollupDayKey[]) {
  const normalizedDays = normalizeDayKeys(days);

  if (normalizedDays.length === 0) {
    return true;
  }

  await refreshPmSummaryEntryMetricsForDays(normalizedDays);
  await refreshPmSummaryDailyReportMetricsForDays(normalizedDays);
  await refreshPmSummaryImageMetricsForDays(normalizedDays);

  return true;
}

export async function rebuildPmSummaryRollups() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureReportRollupTables();
  await sql`delete from pm_summary_rollups`;

  const days = await readAllPmSummarySourceDays();

  if (days.length === 0) {
    return true;
  }

  await refreshPmSummaryRollupsForDays(days);

  return true;
}

export async function clearReportRollups() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureReportRollupTables();

  await sql.transaction([
    sql`delete from crew_performance_rollups`,
    sql`delete from daily_work_rollups`,
    sql`delete from pay_item_project_rollups`,
    sql`delete from pm_summary_rollups`
  ]);

  return true;
}

export async function readDailyWorkRollupSourceRows(filters: ReportRollupFilters): Promise<DailyWorkReportSourceRow[] | null> {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await backfillReportRollupsIfEmpty();

  const projectIds = normalizeStringList(filters.projectIds);

  if (filters.projectIds && projectIds.length === 0) {
    return [];
  }

  const projectIdsJson = JSON.stringify(projectIds);
  const startDate = isIsoDate(filters.startDate ?? "") ? filters.startDate : "0001-01-01";
  const endDate = isIsoDate(filters.endDate ?? "") ? filters.endDate : "9999-12-31";
  const rows = (await sql`
    select
      project_id,
      to_char(work_date, 'YYYY-MM-DD') as date,
      row_index,
      pay_item_id,
      quantity,
      notes
    from daily_work_rollups
    where (${projectIds.length === 0}::boolean or project_id in (
      select value
      from jsonb_array_elements_text(${projectIdsJson}::jsonb)
    ))
      and work_date >= ${startDate}::date
      and work_date <= ${endDate}::date
    order by project_id, work_date, row_index
  `) as DailyWorkRollupRow[];

  const rowsByDay = new Map<string, DailyWorkReportSourceRow>();

  for (const row of rows) {
    const key = `${row.project_id}|${row.date}`;
    const current = rowsByDay.get(key) ?? {
      date: row.date,
      projectId: row.project_id,
      report: {
        payItemRows: []
      }
    };
    const rowIndex = toInteger(row.row_index);

    current.report.payItemRows ??= [];
    current.report.payItemRows[rowIndex] = {
      notes: row.notes ?? "",
      payItemId: row.pay_item_id,
      quantity: toNumber(row.quantity)
    };
    rowsByDay.set(key, current);
  }

  return Array.from(rowsByDay.values()).map((row) => ({
    ...row,
    report: {
      payItemRows: (row.report.payItemRows ?? []).filter(Boolean)
    }
  }));
}

async function insertPayItemProjectRollups(daysJson?: string) {
  const sql = getSql();

  if (!sql || !(await tableExists("daily_entries"))) {
    return;
  }

  await sql`
    insert into pay_item_project_rollups (
      project_id,
      work_date,
      project_name,
      pay_item_key,
      pay_item_code,
      pay_item_name,
      unit_of_measure,
      entry_count,
      total_hours,
      total_quantity,
      rate_samples,
      updated_at
    )
    select
      entries.project_id,
      entries.work_date,
      coalesce(nullif(max(entries.project_name), ''), entries.project_id) as project_name,
      entries.pay_item_key,
      entries.pay_item_code,
      entries.pay_item_name,
      nullif(entries.pay_item_unit_of_measure, '') as unit_of_measure,
      count(*)::int as entry_count,
      coalesce(sum(entries.hours), 0) as total_hours,
      coalesce(sum(entries.quantity_completed), 0) as total_quantity,
      jsonb_agg(
        jsonb_build_object(
          'entryId',
          entries.id,
          'hours',
          entries.hours,
          'quantityCompleted',
          entries.quantity_completed,
          'hoursPerUnit',
          case when entries.quantity_completed > 0 then entries.hours / entries.quantity_completed else 0 end
        )
        order by entries.id
      ) as rate_samples,
      now()
    from (
      select
        daily_entries.*,
        daily_entries.pay_item_code || '-' || daily_entries.pay_item_name || '-' || coalesce(daily_entries.pay_item_unit_of_measure, '') as pay_item_key
      from daily_entries
      where (
        ${!daysJson}::boolean
        or exists (
          select 1
          from jsonb_to_recordset(${daysJson ?? "[]"}::jsonb) as selected_days("projectId" text, "date" text)
          where daily_entries.project_id = selected_days."projectId"
            and daily_entries.work_date = selected_days."date"::date
        )
      )
    ) entries
    group by
      entries.project_id,
      entries.work_date,
      entries.pay_item_key,
      entries.pay_item_code,
      entries.pay_item_name,
      entries.pay_item_unit_of_measure
    on conflict (project_id, work_date, pay_item_key) do update
    set project_name = excluded.project_name,
        pay_item_code = excluded.pay_item_code,
        pay_item_name = excluded.pay_item_name,
        unit_of_measure = excluded.unit_of_measure,
        entry_count = excluded.entry_count,
        total_hours = excluded.total_hours,
        total_quantity = excluded.total_quantity,
        rate_samples = excluded.rate_samples,
        updated_at = now()
  `;
}

async function insertCrewPerformanceRollups(daysJson?: string) {
  const sql = getSql();

  if (!sql || !(await tableExists("daily_entries")) || !(await tableExists("daily_entry_crew_allocations"))) {
    return;
  }

  await sql`
    insert into crew_performance_rollups (
      project_id,
      work_date,
      project_name,
      pay_item_key,
      pay_item_code,
      pay_item_name,
      unit_of_measure,
      crew_member_id,
      crew_member_name,
      job_title,
      labor_type,
      subcontractor_company,
      entry_count,
      total_hours,
      total_quantity,
      rate_samples,
      updated_at
    )
    select
      entries.project_id,
      entries.work_date,
      coalesce(nullif(max(entries.project_name), ''), entries.project_id) as project_name,
      entries.pay_item_key,
      entries.pay_item_code,
      entries.pay_item_name,
      nullif(entries.pay_item_unit_of_measure, '') as unit_of_measure,
      allocations.crew_member_id,
      max(allocations.crew_member_name) as crew_member_name,
      max(allocations.job_title) as job_title,
      coalesce(nullif(max(allocations.labor_type), ''), 'chinchor_employee') as labor_type,
      nullif(max(allocations.subcontractor_company), '') as subcontractor_company,
      count(*)::int as entry_count,
      coalesce(sum(allocations.hours), 0) as total_hours,
      coalesce(
        sum(
          case
            when entries.hours > 0 then entries.quantity_completed * allocations.hours / entries.hours
            else 0
          end
        ),
        0
      ) as total_quantity,
      jsonb_agg(
        jsonb_build_object(
          'entryId',
          entries.id,
          'hours',
          allocations.hours,
          'quantityCompleted',
          case
            when entries.hours > 0 then entries.quantity_completed * allocations.hours / entries.hours
            else 0
          end,
          'hoursPerUnit',
          case
            when entries.hours > 0 and entries.quantity_completed > 0 and allocations.hours > 0
              then allocations.hours / (entries.quantity_completed * allocations.hours / entries.hours)
            else 0
          end
        )
        order by entries.id
      ) as rate_samples,
      now()
    from (
      select
        daily_entries.*,
        daily_entries.pay_item_code || '-' || daily_entries.pay_item_name || '-' || coalesce(daily_entries.pay_item_unit_of_measure, '') as pay_item_key
      from daily_entries
      where (
        ${!daysJson}::boolean
        or exists (
          select 1
          from jsonb_to_recordset(${daysJson ?? "[]"}::jsonb) as selected_days("projectId" text, "date" text)
          where daily_entries.project_id = selected_days."projectId"
            and daily_entries.work_date = selected_days."date"::date
        )
      )
    ) entries
    inner join daily_entry_crew_allocations allocations on allocations.entry_id = entries.id
    group by
      entries.project_id,
      entries.work_date,
      entries.pay_item_key,
      entries.pay_item_code,
      entries.pay_item_name,
      entries.pay_item_unit_of_measure,
      allocations.crew_member_id
    on conflict (project_id, work_date, pay_item_key, crew_member_id) do update
    set project_name = excluded.project_name,
        pay_item_code = excluded.pay_item_code,
        pay_item_name = excluded.pay_item_name,
        unit_of_measure = excluded.unit_of_measure,
        crew_member_name = excluded.crew_member_name,
        job_title = excluded.job_title,
        labor_type = excluded.labor_type,
        subcontractor_company = excluded.subcontractor_company,
        entry_count = excluded.entry_count,
        total_hours = excluded.total_hours,
        total_quantity = excluded.total_quantity,
        rate_samples = excluded.rate_samples,
        updated_at = now()
  `;
}

async function insertDailyWorkRollups(daysJson?: string) {
  const sql = getSql();

  if (!sql || !(await tableExists("daily_reports"))) {
    return;
  }

  await sql`
    insert into daily_work_rollups (
      project_id,
      work_date,
      row_index,
      pay_item_id,
      quantity,
      notes,
      updated_at
    )
    select
      source_rows.project_id,
      source_rows.work_date,
      source_rows.row_index,
      source_rows.pay_item_id,
      source_rows.quantity,
      source_rows.notes,
      now()
    from (
      select
        daily_reports.project_id,
        daily_reports.work_date,
        (report_rows.ordinality - 1)::int as row_index,
        report_rows.value ->> 'payItemId' as pay_item_id,
        case
          when regexp_replace(coalesce(report_rows.value ->> 'quantity', ''), '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
            then regexp_replace(coalesce(report_rows.value ->> 'quantity', ''), '[^0-9.\-]', '', 'g')::numeric
          else 0
        end as quantity,
        coalesce(report_rows.value ->> 'notes', '') as notes
      from daily_reports
      cross join lateral jsonb_array_elements(coalesce(daily_reports.report -> 'payItemRows', '[]'::jsonb)) with ordinality as report_rows(value, ordinality)
      where (
        ${!daysJson}::boolean
        or exists (
          select 1
          from jsonb_to_recordset(${daysJson ?? "[]"}::jsonb) as selected_days("projectId" text, "date" text)
          where daily_reports.project_id = selected_days."projectId"
            and daily_reports.work_date = selected_days."date"::date
        )
      )
    ) source_rows
    where source_rows.pay_item_id is not null
      and source_rows.pay_item_id <> ''
      and source_rows.quantity > 0
    on conflict (project_id, work_date, row_index) do update
    set pay_item_id = excluded.pay_item_id,
        quantity = excluded.quantity,
        notes = excluded.notes,
        updated_at = now()
  `;
}

async function refreshPmSummaryEntryMetricsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0) {
    return;
  }

  await ensureReportRollupTables();

  const daysJson = JSON.stringify(normalizedDays);
  const hasProjectCatalog = await tableExists("project_catalog");
  const hasDailyEntries = await tableExists("daily_entries");

  if (!hasDailyEntries) {
    await upsertEmptyPmSummaryRowsForDays(normalizedDays, hasProjectCatalog);
    await deleteEmptyPmSummaryRowsForDays(normalizedDays);
    return;
  }

  if (hasProjectCatalog) {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        entry_count,
        total_hours,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        coalesce(project_catalog.name, entry_stats.project_name, selected_days."projectId") as project_name,
        project_catalog.netsuite_project_manager_id,
        project_catalog.netsuite_project_manager_name,
        coalesce(entry_stats.entry_count, 0),
        coalesce(entry_stats.total_hours, 0),
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join project_catalog on project_catalog.id = selected_days."projectId"
      left join (
        select
          project_id,
          work_date,
          coalesce(nullif(max(project_name), ''), project_id) as project_name,
          count(*)::int as entry_count,
          coalesce(sum(hours), 0) as total_hours
        from daily_entries
        group by project_id, work_date
      ) entry_stats on entry_stats.project_id = selected_days."projectId"
        and entry_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          entry_count = excluded.entry_count,
          total_hours = excluded.total_hours,
          updated_at = now()
    `;
  } else {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        entry_count,
        total_hours,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        coalesce(entry_stats.project_name, selected_days."projectId") as project_name,
        coalesce(entry_stats.entry_count, 0),
        coalesce(entry_stats.total_hours, 0),
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join (
        select
          project_id,
          work_date,
          coalesce(nullif(max(project_name), ''), project_id) as project_name,
          count(*)::int as entry_count,
          coalesce(sum(hours), 0) as total_hours
        from daily_entries
        group by project_id, work_date
      ) entry_stats on entry_stats.project_id = selected_days."projectId"
        and entry_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          entry_count = excluded.entry_count,
          total_hours = excluded.total_hours,
          updated_at = now()
    `;
  }

  await deleteEmptyPmSummaryRowsForDays(normalizedDays);
}

async function refreshPmSummaryDailyReportMetricsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0) {
    return;
  }

  await ensureReportRollupTables();

  const daysJson = JSON.stringify(normalizedDays);
  const hasProjectCatalog = await tableExists("project_catalog");
  const hasDailyReports = await tableExists("daily_reports");
  const hasDailyReportUploads = await tableExists("daily_report_uploads");

  if (!hasDailyReports) {
    await updatePmSummaryRowsWithoutDailyReports(normalizedDays);
    return;
  }

  if (hasProjectCatalog && hasDailyReportUploads) {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        daily_report_saved,
        daily_work_row_count,
        daily_work_total_quantity,
        procore_upload_status,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        coalesce(project_catalog.name, selected_days."projectId") as project_name,
        project_catalog.netsuite_project_manager_id,
        project_catalog.netsuite_project_manager_name,
        daily_reports.project_id is not null as daily_report_saved,
        coalesce(work_stats.row_count, 0),
        coalesce(work_stats.total_quantity, 0),
        case
          when upload_stats.project_id is not null then 'uploaded'
          when daily_reports.project_id is not null then 'pending'
          else 'none'
        end,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join project_catalog on project_catalog.id = selected_days."projectId"
      left join daily_reports on daily_reports.project_id = selected_days."projectId"
        and daily_reports.work_date = selected_days."date"::date
      left join (
        select project_id, work_date, count(*)::int as row_count, coalesce(sum(quantity), 0) as total_quantity
        from daily_work_rollups
        group by project_id, work_date
      ) work_stats on work_stats.project_id = selected_days."projectId"
        and work_stats.work_date = selected_days."date"::date
      left join daily_report_uploads upload_stats on upload_stats.project_id = selected_days."projectId"
        and upload_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          daily_report_saved = excluded.daily_report_saved,
          daily_work_row_count = excluded.daily_work_row_count,
          daily_work_total_quantity = excluded.daily_work_total_quantity,
          procore_upload_status = excluded.procore_upload_status,
          updated_at = now()
    `;
  } else if (hasProjectCatalog) {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        daily_report_saved,
        daily_work_row_count,
        daily_work_total_quantity,
        procore_upload_status,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        coalesce(project_catalog.name, selected_days."projectId") as project_name,
        project_catalog.netsuite_project_manager_id,
        project_catalog.netsuite_project_manager_name,
        daily_reports.project_id is not null as daily_report_saved,
        coalesce(work_stats.row_count, 0),
        coalesce(work_stats.total_quantity, 0),
        case when daily_reports.project_id is not null then 'pending' else 'none' end,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join project_catalog on project_catalog.id = selected_days."projectId"
      left join daily_reports on daily_reports.project_id = selected_days."projectId"
        and daily_reports.work_date = selected_days."date"::date
      left join (
        select project_id, work_date, count(*)::int as row_count, coalesce(sum(quantity), 0) as total_quantity
        from daily_work_rollups
        group by project_id, work_date
      ) work_stats on work_stats.project_id = selected_days."projectId"
        and work_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          daily_report_saved = excluded.daily_report_saved,
          daily_work_row_count = excluded.daily_work_row_count,
          daily_work_total_quantity = excluded.daily_work_total_quantity,
          procore_upload_status = excluded.procore_upload_status,
          updated_at = now()
    `;
  } else if (hasDailyReportUploads) {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        daily_report_saved,
        daily_work_row_count,
        daily_work_total_quantity,
        procore_upload_status,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        selected_days."projectId",
        daily_reports.project_id is not null as daily_report_saved,
        coalesce(work_stats.row_count, 0),
        coalesce(work_stats.total_quantity, 0),
        case
          when upload_stats.project_id is not null then 'uploaded'
          when daily_reports.project_id is not null then 'pending'
          else 'none'
        end,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join daily_reports on daily_reports.project_id = selected_days."projectId"
        and daily_reports.work_date = selected_days."date"::date
      left join (
        select project_id, work_date, count(*)::int as row_count, coalesce(sum(quantity), 0) as total_quantity
        from daily_work_rollups
        group by project_id, work_date
      ) work_stats on work_stats.project_id = selected_days."projectId"
        and work_stats.work_date = selected_days."date"::date
      left join daily_report_uploads upload_stats on upload_stats.project_id = selected_days."projectId"
        and upload_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          daily_report_saved = excluded.daily_report_saved,
          daily_work_row_count = excluded.daily_work_row_count,
          daily_work_total_quantity = excluded.daily_work_total_quantity,
          procore_upload_status = excluded.procore_upload_status,
          updated_at = now()
    `;
  } else {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        daily_report_saved,
        daily_work_row_count,
        daily_work_total_quantity,
        procore_upload_status,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        selected_days."projectId",
        daily_reports.project_id is not null as daily_report_saved,
        coalesce(work_stats.row_count, 0),
        coalesce(work_stats.total_quantity, 0),
        case when daily_reports.project_id is not null then 'pending' else 'none' end,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join daily_reports on daily_reports.project_id = selected_days."projectId"
        and daily_reports.work_date = selected_days."date"::date
      left join (
        select project_id, work_date, count(*)::int as row_count, coalesce(sum(quantity), 0) as total_quantity
        from daily_work_rollups
        group by project_id, work_date
      ) work_stats on work_stats.project_id = selected_days."projectId"
        and work_stats.work_date = selected_days."date"::date
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          daily_report_saved = excluded.daily_report_saved,
          daily_work_row_count = excluded.daily_work_row_count,
          daily_work_total_quantity = excluded.daily_work_total_quantity,
          procore_upload_status = excluded.procore_upload_status,
          updated_at = now()
    `;
  }

  await deleteEmptyPmSummaryRowsForDays(normalizedDays);
}

async function upsertEmptyPmSummaryRowsForDays(days: ReportRollupDayKey[], hasProjectCatalog: boolean) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0) {
    return;
  }

  const daysJson = JSON.stringify(normalizedDays);

  if (hasProjectCatalog) {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        entry_count,
        total_hours,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        coalesce(project_catalog.name, selected_days."projectId"),
        project_catalog.netsuite_project_manager_id,
        project_catalog.netsuite_project_manager_name,
        0,
        0,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      left join project_catalog on project_catalog.id = selected_days."projectId"
      on conflict (project_id, work_date) do update
      set project_name = excluded.project_name,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          entry_count = 0,
          total_hours = 0,
          updated_at = now()
    `;
  } else {
    await sql`
      insert into pm_summary_rollups (
        project_id,
        work_date,
        project_name,
        entry_count,
        total_hours,
        updated_at
      )
      select
        selected_days."projectId",
        selected_days."date"::date,
        selected_days."projectId",
        0,
        0,
        now()
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      on conflict (project_id, work_date) do update
      set entry_count = 0,
          total_hours = 0,
          updated_at = now()
    `;
  }
}

async function updatePmSummaryRowsWithoutDailyReports(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0) {
    return;
  }

  const daysJson = JSON.stringify(normalizedDays);

  await sql`
    update pm_summary_rollups
    set daily_report_saved = false,
        daily_work_row_count = 0,
        daily_work_total_quantity = 0,
        procore_upload_status = 'none',
        updated_at = now()
    where exists (
      select 1
      from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
      where pm_summary_rollups.project_id = selected_days."projectId"
        and pm_summary_rollups.work_date = selected_days."date"::date
    )
  `;

  await deleteEmptyPmSummaryRowsForDays(normalizedDays);
}

async function refreshPmSummaryImageMetricsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0 || !(await tableExists("job_image_uploads"))) {
    return;
  }

  await ensureReportRollupTables();

  const daysJson = JSON.stringify(normalizedDays);

  await sql`
    insert into pm_summary_rollups (
      project_id,
      work_date,
      project_name,
      uploaded_image_count,
      failed_image_count,
      updated_at
    )
    select
      selected_days."projectId",
      selected_days."date"::date,
      selected_days."projectId",
      coalesce(image_stats.uploaded_count, 0),
      coalesce(image_stats.failed_count, 0),
      now()
    from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
    left join (
      select
        project_id,
        work_date,
        count(*) filter (where status = 'uploaded')::int as uploaded_count,
        count(*) filter (where status = 'failed')::int as failed_count
      from job_image_uploads
      group by project_id, work_date
    ) image_stats on image_stats.project_id = selected_days."projectId"
      and image_stats.work_date = selected_days."date"::date
    on conflict (project_id, work_date) do update
    set uploaded_image_count = excluded.uploaded_image_count,
        failed_image_count = excluded.failed_image_count,
        updated_at = now()
  `;

  await deleteEmptyPmSummaryRowsForDays(normalizedDays);
}

async function readAllPmSummarySourceDays() {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const daysByKey = new Map<string, ReportRollupDayKey>();

  if (await tableExists("daily_entries")) {
    const rows = (await sql`
      select distinct project_id, to_char(work_date, 'YYYY-MM-DD') as date
      from daily_entries
    `) as Array<{ date: string; project_id: string }>;
    addDayRows(daysByKey, rows);
  }

  if (await tableExists("daily_reports")) {
    const rows = (await sql`
      select distinct project_id, to_char(work_date, 'YYYY-MM-DD') as date
      from daily_reports
    `) as Array<{ date: string; project_id: string }>;
    addDayRows(daysByKey, rows);
  }

  if (await tableExists("daily_report_uploads")) {
    const rows = (await sql`
      select distinct project_id, to_char(work_date, 'YYYY-MM-DD') as date
      from daily_report_uploads
    `) as Array<{ date: string; project_id: string }>;
    addDayRows(daysByKey, rows);
  }

  if (await tableExists("job_image_uploads")) {
    const rows = (await sql`
      select distinct project_id, to_char(work_date, 'YYYY-MM-DD') as date
      from job_image_uploads
    `) as Array<{ date: string; project_id: string }>;
    addDayRows(daysByKey, rows);
  }

  return Array.from(daysByKey.values());
}

async function deleteEmptyPmSummaryRowsForDays(days: ReportRollupDayKey[]) {
  const sql = getSql();
  const normalizedDays = normalizeDayKeys(days);

  if (!sql || normalizedDays.length === 0) {
    return;
  }

  const daysJson = JSON.stringify(normalizedDays);

  await sql`
    delete from pm_summary_rollups
    where entry_count = 0
      and total_hours = 0
      and daily_report_saved = false
      and daily_work_row_count = 0
      and daily_work_total_quantity = 0
      and procore_upload_status = 'none'
      and uploaded_image_count = 0
      and failed_image_count = 0
      and exists (
        select 1
        from jsonb_to_recordset(${daysJson}::jsonb) as selected_days("projectId" text, "date" text)
        where pm_summary_rollups.project_id = selected_days."projectId"
          and pm_summary_rollups.work_date = selected_days."date"::date
      )
  `;
}

function addDayRows(daysByKey: Map<string, ReportRollupDayKey>, rows: Array<{ date: string; project_id: string }>) {
  for (const row of rows) {
    if (!row.project_id || !isIsoDate(row.date)) {
      continue;
    }

    daysByKey.set(`${row.project_id}|${row.date}`, {
      date: row.date,
      projectId: row.project_id
    });
  }
}

async function tableHasRows(tableName: string) {
  const sql = getSql();

  if (!sql || !(await tableExists(tableName))) {
    return false;
  }

  let rows: CountRow[];

  if (tableName === "pay_item_project_rollups") {
    rows = (await sql`select count(*)::int as count from pay_item_project_rollups`) as CountRow[];
  } else if (tableName === "daily_work_rollups") {
    rows = (await sql`select count(*)::int as count from daily_work_rollups`) as CountRow[];
  } else if (tableName === "crew_performance_rollups") {
    rows = (await sql`select count(*)::int as count from crew_performance_rollups`) as CountRow[];
  } else if (tableName === "pm_summary_rollups") {
    rows = (await sql`select count(*)::int as count from pm_summary_rollups`) as CountRow[];
  } else {
    return false;
  }

  return toNumber(rows[0]?.count) > 0;
}

async function tableExists(tableName: string) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    select to_regclass(${`public.${tableName}`}) as table_name
  `) as Array<{ table_name: string | null }>;

  return Boolean(rows[0]?.table_name);
}

function normalizeDayKeys(days: ReportRollupDayKey[]) {
  const daysByKey = new Map<string, ReportRollupDayKey>();

  for (const day of days) {
    const projectId = readString(day.projectId);
    const date = readString(day.date);

    if (!projectId || !isIsoDate(date)) {
      continue;
    }

    daysByKey.set(`${projectId}|${date}`, {
      date,
      projectId
    });
  }

  return Array.from(daysByKey.values());
}

function normalizeStringList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map(readString).filter(Boolean)));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}

function toInteger(value: unknown) {
  const numberValue = toNumber(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  return 0;
}
