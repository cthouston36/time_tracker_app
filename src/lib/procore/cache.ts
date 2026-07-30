import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getSql, readAppSetting } from "@/lib/db";
import type { PayItem, Project } from "@/lib/procore/types";

const CACHE_FILE = join(process.cwd(), ".data", "procore-cache.json");
const PROCORE_CACHE_SETTING_KEY = "procore_cache";
const PROCORE_SYNC_STATE_KEY = "procore_cache";

let procoreCacheTablesReady = false;

export type ProcoreCache = {
  syncedAt: string;
  projects: Project[];
};

export type ProcoreCacheReadOptions = {
  netSuiteProjectManagerId?: string;
};

export async function readProcoreCache(options: ProcoreCacheReadOptions = {}) {
  const tableCache = await readProcoreTablesCache(options);

  if (tableCache) {
    return tableCache;
  }

  const databaseCache = await readAppSetting<ProcoreCache>(PROCORE_CACHE_SETTING_KEY);

  if (databaseCache) {
    if (await writeProcoreTablesCache(databaseCache.projects, databaseCache.syncedAt)) {
      return readProcoreTablesCache(options);
    }

    return databaseCache;
  }

  try {
    const contents = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(contents) as ProcoreCache;
  } catch {
    return null;
  }
}

export async function writeProcoreCache(projects: Project[]) {
  const cache: ProcoreCache = {
    syncedAt: new Date().toISOString(),
    projects: normalizeProjects(projects)
  };

  const tableCache = await writeProcoreTablesCache(cache.projects, cache.syncedAt);

  if (tableCache) {
    return tableCache;
  }

  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));

  return cache;
}

export async function updateProcoreCache(updater: (currentProjects: Project[]) => Project[]) {
  const currentCache = await readProcoreCache();
  return writeProcoreCache(updater(currentCache?.projects ?? []));
}

async function readProcoreTablesCache(options: ProcoreCacheReadOptions = {}) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProcoreCacheTables();

  const netSuiteProjectManagerId = options.netSuiteProjectManagerId?.trim() ?? "";
  const projectRows = netSuiteProjectManagerId
    ? ((await sql`
        select
          id,
          name,
          netsuite_project_id,
          netsuite_project_manager_id,
          netsuite_project_manager_name,
          procore_project_id,
          source_system
        from procore_projects
        where netsuite_project_manager_id = ${netSuiteProjectManagerId}
        order by lower(name), id
      `) as ProcoreProjectRow[])
    : ((await sql`
        select
          id,
          name,
          netsuite_project_id,
          netsuite_project_manager_id,
          netsuite_project_manager_name,
          procore_project_id,
          source_system
        from procore_projects
        order by lower(name), id
      `) as ProcoreProjectRow[]);

  const syncStateRows = (await sql`
    select synced_at
    from procore_sync_state
    where key = ${PROCORE_SYNC_STATE_KEY}
    limit 1
  `) as ProcoreSyncStateRow[];

  if (projectRows.length === 0) {
    if (!netSuiteProjectManagerId) {
      return null;
    }

    return {
      syncedAt: toIsoDateString(syncStateRows[0]?.synced_at) ?? new Date().toISOString(),
      projects: []
    } satisfies ProcoreCache;
  }

  const projectIds = projectRows.map((project) => project.id);
  const payItemRows = (await sql`
    select
      project_id,
      id,
      code,
      name,
      budgeted_quantity,
      unit_of_measure,
      sort_order
    from procore_pay_items
    where project_id in (
      select value
      from jsonb_array_elements_text(${JSON.stringify(projectIds)}::jsonb)
    )
    order by project_id, sort_order, lower(code), lower(name), id
  `) as ProcorePayItemRow[];
  const payItemsByProjectId = new Map<string, PayItem[]>();

  for (const row of payItemRows) {
    const payItems = payItemsByProjectId.get(row.project_id) ?? [];
    payItems.push({
      id: row.id,
      code: row.code,
      name: row.name,
      budgetedQuantity: toNumber(row.budgeted_quantity),
      unitOfMeasure: row.unit_of_measure
    });
    payItemsByProjectId.set(row.project_id, payItems);
  }

  return {
    syncedAt: toIsoDateString(syncStateRows[0]?.synced_at) ?? new Date().toISOString(),
    projects: projectRows.map((project) => ({
      id: project.id,
      name: project.name,
      netSuiteProjectId: project.netsuite_project_id || undefined,
      netSuiteProjectManagerId: project.netsuite_project_manager_id || undefined,
      netSuiteProjectManagerName: project.netsuite_project_manager_name || undefined,
      payItems: payItemsByProjectId.get(project.id) ?? [],
      procoreProjectId: project.procore_project_id || project.id,
      sourceSystem: readSourceSystem(project.source_system)
    }))
  } satisfies ProcoreCache;
}

async function writeProcoreTablesCache(projects: Project[], syncedAt: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProcoreCacheTables();

  const normalizedProjects = normalizeProjects(projects);
  const projectRows = normalizedProjects.map((project) => ({
    id: project.id,
    name: project.name,
    netsuite_project_id: project.netSuiteProjectId ?? null,
    netsuite_project_manager_id: project.netSuiteProjectManagerId ?? null,
    netsuite_project_manager_name: project.netSuiteProjectManagerName ?? null,
    procore_project_id: project.procoreProjectId ?? project.id,
    source_system: project.sourceSystem ?? "procore"
  }));
  const projectIds = projectRows.map((project) => project.id);
  const payItemRows = normalizedProjects.flatMap((project) =>
    project.payItems.map((payItem, index) => ({
      project_id: project.id,
      id: payItem.id,
      code: payItem.code,
      name: payItem.name,
      budgeted_quantity: payItem.budgetedQuantity,
      unit_of_measure: payItem.unitOfMeasure,
      sort_order: index,
      raw_data: payItem
    }))
  );

  if (projectRows.length > 0) {
    await sql`
      insert into procore_projects (
        id,
        name,
        netsuite_project_id,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        procore_project_id,
        source_system,
        updated_at
      )
      select
        id,
        name,
        netsuite_project_id,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        procore_project_id,
        source_system,
        now()
      from jsonb_to_recordset(${JSON.stringify(projectRows)}::jsonb) as project(
        id text,
        name text,
        netsuite_project_id text,
        netsuite_project_manager_id text,
        netsuite_project_manager_name text,
        procore_project_id text,
        source_system text
      )
      on conflict (id) do update
      set name = excluded.name,
          netsuite_project_id = excluded.netsuite_project_id,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          procore_project_id = excluded.procore_project_id,
          source_system = excluded.source_system,
          updated_at = now()
    `;
  }

  if (projectIds.length > 0) {
    await sql`
      delete from procore_projects
      where id not in (
        select value
        from jsonb_array_elements_text(${JSON.stringify(projectIds)}::jsonb)
      )
    `;
  } else {
    await sql`delete from procore_projects`;
  }

  if (payItemRows.length > 0) {
    await sql`
      insert into procore_pay_items (
        project_id,
        id,
        code,
        name,
        budgeted_quantity,
        unit_of_measure,
        sort_order,
        raw_data,
        updated_at
      )
      select
        project_id,
        id,
        code,
        name,
        budgeted_quantity,
        unit_of_measure,
        sort_order,
        raw_data,
        now()
      from jsonb_to_recordset(${JSON.stringify(payItemRows)}::jsonb) as pay_item(
        project_id text,
        id text,
        code text,
        name text,
        budgeted_quantity numeric,
        unit_of_measure text,
        sort_order integer,
        raw_data jsonb
      )
      on conflict (project_id, id) do update
      set code = excluded.code,
          name = excluded.name,
          budgeted_quantity = excluded.budgeted_quantity,
          unit_of_measure = excluded.unit_of_measure,
          sort_order = excluded.sort_order,
          raw_data = excluded.raw_data,
          updated_at = now()
    `;
  }

  for (const project of normalizedProjects) {
    const payItemIds = project.payItems.map((payItem) => payItem.id);

    if (payItemIds.length > 0) {
      await sql`
        delete from procore_pay_items
        where project_id = ${project.id}
          and id not in (
            select value
            from jsonb_array_elements_text(${JSON.stringify(payItemIds)}::jsonb)
          )
      `;
    } else {
      await sql`
        delete from procore_pay_items
        where project_id = ${project.id}
      `;
    }
  }

  await sql`
    insert into procore_sync_state (key, synced_at, updated_at)
    values (${PROCORE_SYNC_STATE_KEY}, ${toIsoDateString(syncedAt) ?? new Date().toISOString()}, now())
    on conflict (key) do update
    set synced_at = excluded.synced_at,
        updated_at = now()
  `;

  return {
    syncedAt: toIsoDateString(syncedAt) ?? new Date().toISOString(),
    projects: normalizedProjects
  } satisfies ProcoreCache;
}

async function ensureProcoreCacheTables() {
  const sql = getSql();

  if (!sql || procoreCacheTablesReady) {
    return;
  }

  await sql`
    create table if not exists procore_projects (
      id text primary key,
      name text not null,
      netsuite_project_id text,
      netsuite_project_manager_id text,
      netsuite_project_manager_name text,
      procore_project_id text,
      source_system text not null default 'procore',
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table procore_projects add column if not exists netsuite_project_id text`;
  await sql`alter table procore_projects add column if not exists netsuite_project_manager_id text`;
  await sql`alter table procore_projects add column if not exists netsuite_project_manager_name text`;
  await sql`alter table procore_projects add column if not exists procore_project_id text`;
  await sql`alter table procore_projects add column if not exists source_system text not null default 'procore'`;

  await sql`
    create table if not exists procore_pay_items (
      project_id text not null references procore_projects(id) on delete cascade,
      id text not null,
      code text not null,
      name text not null,
      budgeted_quantity numeric not null default 0,
      unit_of_measure text not null default 'EA',
      sort_order integer not null default 0,
      raw_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (project_id, id)
    )
  `;

  await sql`
    create table if not exists procore_sync_state (
      key text primary key,
      synced_at timestamptz not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists procore_projects_name_idx on procore_projects (lower(name))`;
  await sql`create index if not exists procore_pay_items_project_idx on procore_pay_items (project_id)`;
  await sql`create index if not exists procore_pay_items_project_code_idx on procore_pay_items (project_id, lower(code))`;

  procoreCacheTablesReady = true;
}

function normalizeProjects(projects: Project[]): Project[] {
  const normalizedProjects: Project[] = [];

  for (const project of projects) {
    const id = readString(project.id);
    const name = readString(project.name);

    if (!id || !name) {
      continue;
    }

    normalizedProjects.push({
      id,
      name,
      netSuiteProjectId: readString(project.netSuiteProjectId) || undefined,
      netSuiteProjectManagerId: readString(project.netSuiteProjectManagerId) || undefined,
      netSuiteProjectManagerName: readString(project.netSuiteProjectManagerName) || undefined,
      payItems: normalizePayItems(project.payItems),
      procoreProjectId: readString(project.procoreProjectId) || id,
      sourceSystem: readSourceSystem(project.sourceSystem)
    });
  }

  return normalizedProjects;
}

function normalizePayItems(payItems: PayItem[] | undefined): PayItem[] {
  const normalizedPayItems: PayItem[] = [];

  for (const payItem of payItems ?? []) {
    const id = readString(payItem.id);
    const code = readString(payItem.code);
    const name = readString(payItem.name);

    if (!id || !code || !name) {
      continue;
    }

    normalizedPayItems.push({
      id,
      code,
      name,
      budgetedQuantity: toNumber(payItem.budgetedQuantity),
      unitOfMeasure: readString(payItem.unitOfMeasure)
    });
  }

  return normalizedPayItems;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toIsoDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

type ProcoreProjectRow = {
  id: string;
  name: string;
  netsuite_project_id: string | null;
  netsuite_project_manager_id: string | null;
  netsuite_project_manager_name: string | null;
  procore_project_id: string | null;
  source_system: string | null;
};

type ProcorePayItemRow = {
  project_id: string;
  id: string;
  code: string;
  name: string;
  budgeted_quantity: string | number;
  unit_of_measure: string;
  sort_order: number;
};

type ProcoreSyncStateRow = {
  synced_at: string | Date;
};

function readSourceSystem(value: unknown) {
  return value === "netsuite" ? "netsuite" : "procore";
}
