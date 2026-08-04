import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getSql, readAppSetting } from "@/lib/db";
import type { PayItem, Project } from "@/lib/domain/types";
import { readString, readStringList } from "@/lib/records";

const CACHE_FILE = join(process.cwd(), ".data", "project-catalog.json");
const LEGACY_CACHE_FILE = join(process.cwd(), ".data", "procore-cache.json");
const PROJECT_CATALOG_SETTING_KEY = "project_catalog";
const PROJECT_CATALOG_SYNC_STATE_KEY = "project_catalog";
const LEGACY_PROCORE_CACHE_SETTING_KEY = "procore_cache";

let projectCatalogTablesReady = false;

export type ProjectCatalog = {
  syncedAt: string;
  projects: Project[];
};

export type ProjectCatalogReadOptions = {
  netSuiteProjectManagerId?: string;
  projectIds?: string[];
};

export async function readProjectCatalog(options: ProjectCatalogReadOptions = {}) {
  const tableCache = await readProjectCatalogTables(options);

  if (tableCache) {
    return tableCache;
  }

  const databaseCache =
    (await readAppSetting<ProjectCatalog>(PROJECT_CATALOG_SETTING_KEY)) ??
    (await readAppSetting<ProjectCatalog>(LEGACY_PROCORE_CACHE_SETTING_KEY));

  if (databaseCache) {
    if (await writeProjectCatalogTables(databaseCache.projects, databaseCache.syncedAt)) {
      return readProjectCatalogTables(options);
    }

    return filterProjectCatalog(databaseCache, options);
  }

  for (const filePath of [CACHE_FILE, LEGACY_CACHE_FILE]) {
    let fileCatalog: ProjectCatalog;

    try {
      const contents = await readFile(filePath, "utf8");
      fileCatalog = JSON.parse(contents) as ProjectCatalog;
    } catch {
      continue;
    }

    if (await writeProjectCatalogTables(fileCatalog.projects, fileCatalog.syncedAt)) {
      return readProjectCatalogTables(options);
    }

    return filterProjectCatalog(fileCatalog, options);
  }

  return null;
}

export async function writeProjectCatalog(projects: Project[]) {
  const cache: ProjectCatalog = {
    syncedAt: new Date().toISOString(),
    projects: normalizeProjects(projects)
  };

  const tableCache = await writeProjectCatalogTables(cache.projects, cache.syncedAt);

  if (tableCache) {
    return tableCache;
  }

  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));

  return cache;
}

export async function updateProjectCatalog(updater: (currentProjects: Project[]) => Project[]) {
  const currentCache = await readProjectCatalog();
  return writeProjectCatalog(updater(currentCache?.projects ?? []));
}

async function readProjectCatalogTables(options: ProjectCatalogReadOptions = {}) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProjectCatalogTables();

  const netSuiteProjectManagerId = options.netSuiteProjectManagerId?.trim() ?? "";
  const filteredProjectIds = normalizeProjectIdFilter(options.projectIds);
  const hasProjectIdFilter = Array.isArray(options.projectIds);
  const projectRows = (await sql`
    select
      id,
      name,
      netsuite_project_id,
      netsuite_project_manager_id,
      netsuite_project_manager_name,
      procore_project_id,
      source_system
    from project_catalog
    where (${!netSuiteProjectManagerId} or netsuite_project_manager_id = ${netSuiteProjectManagerId})
      and (
        ${!hasProjectIdFilter}
        or id in (
          select value
          from jsonb_array_elements_text(${JSON.stringify(filteredProjectIds)}::jsonb)
        )
      )
    order by lower(name), id
  `) as ProjectCatalogProjectRow[];

  const syncStateRows = (await sql`
    select synced_at
    from project_catalog_sync_state
    where key = ${PROJECT_CATALOG_SYNC_STATE_KEY}
    limit 1
  `) as ProjectCatalogSyncStateRow[];

  if (projectRows.length === 0) {
    if (!netSuiteProjectManagerId && !hasProjectIdFilter) {
      return null;
    }

    return {
      syncedAt: toIsoDateString(syncStateRows[0]?.synced_at) ?? new Date().toISOString(),
      projects: []
    } satisfies ProjectCatalog;
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
    from project_pay_items
    where project_id in (
      select value
      from jsonb_array_elements_text(${JSON.stringify(projectIds)}::jsonb)
    )
    order by project_id, sort_order, lower(code), lower(name), id
  `) as ProjectCatalogPayItemRow[];
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
  } satisfies ProjectCatalog;
}

function filterProjectCatalog(cache: ProjectCatalog | null, options: ProjectCatalogReadOptions) {
  if (!cache) {
    return null;
  }

  const projectIds = normalizeProjectIdFilter(options.projectIds);
  const projectIdSet = new Set(projectIds);
  const hasProjectIdFilter = Array.isArray(options.projectIds);
  const netSuiteProjectManagerId = options.netSuiteProjectManagerId?.trim() ?? "";

  if (!hasProjectIdFilter && !netSuiteProjectManagerId) {
    return cache;
  }

  return {
    ...cache,
    projects: cache.projects.filter((project) => {
      if (hasProjectIdFilter && !projectIdSet.has(project.id)) {
        return false;
      }

      return !netSuiteProjectManagerId || project.netSuiteProjectManagerId === netSuiteProjectManagerId;
    })
  };
}

async function writeProjectCatalogTables(projects: Project[], syncedAt: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureProjectCatalogTables();

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
      insert into project_catalog (
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
      delete from project_catalog
      where id not in (
        select value
        from jsonb_array_elements_text(${JSON.stringify(projectIds)}::jsonb)
      )
    `;
  } else {
    await sql`delete from project_catalog`;
  }

  if (payItemRows.length > 0) {
    await sql`
      insert into project_pay_items (
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
        delete from project_pay_items
        where project_id = ${project.id}
          and id not in (
            select value
            from jsonb_array_elements_text(${JSON.stringify(payItemIds)}::jsonb)
          )
      `;
    } else {
      await sql`
        delete from project_pay_items
        where project_id = ${project.id}
      `;
    }
  }

  await sql`
    insert into project_catalog_sync_state (key, synced_at, updated_at)
    values (${PROJECT_CATALOG_SYNC_STATE_KEY}, ${toIsoDateString(syncedAt) ?? new Date().toISOString()}, now())
    on conflict (key) do update
    set synced_at = excluded.synced_at,
        updated_at = now()
  `;

  return {
    syncedAt: toIsoDateString(syncedAt) ?? new Date().toISOString(),
    projects: normalizedProjects
  } satisfies ProjectCatalog;
}

async function ensureProjectCatalogTables() {
  const sql = getSql();

  if (!sql || projectCatalogTablesReady) {
    return;
  }

  await sql`
    create table if not exists project_catalog (
      id text primary key,
      name text not null,
      netsuite_project_id text,
      netsuite_project_manager_id text,
      netsuite_project_manager_name text,
      procore_project_id text,
      source_system text not null default 'netsuite',
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table project_catalog add column if not exists netsuite_project_id text`;
  await sql`alter table project_catalog add column if not exists netsuite_project_manager_id text`;
  await sql`alter table project_catalog add column if not exists netsuite_project_manager_name text`;
  await sql`alter table project_catalog add column if not exists procore_project_id text`;
  await sql`alter table project_catalog add column if not exists source_system text not null default 'netsuite'`;

  await sql`
    create table if not exists project_pay_items (
      project_id text not null references project_catalog(id) on delete cascade,
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
    create table if not exists project_catalog_sync_state (
      key text primary key,
      synced_at timestamptz not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists project_catalog_name_idx on project_catalog (lower(name))`;
  await sql`create index if not exists project_pay_items_project_idx on project_pay_items (project_id)`;
  await sql`create index if not exists project_pay_items_project_code_idx on project_pay_items (project_id, lower(code))`;

  await migrateLegacyProcoreCatalogTables();

  projectCatalogTablesReady = true;
}

async function migrateLegacyProcoreCatalogTables() {
  const sql = getSql();

  if (!sql || !(await tableExists("procore_projects"))) {
    return;
  }

  await sql`alter table procore_projects add column if not exists netsuite_project_id text`;
  await sql`alter table procore_projects add column if not exists netsuite_project_manager_id text`;
  await sql`alter table procore_projects add column if not exists netsuite_project_manager_name text`;
  await sql`alter table procore_projects add column if not exists procore_project_id text`;
  await sql`alter table procore_projects add column if not exists source_system text not null default 'procore'`;

  await sql`
    insert into project_catalog (
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
      coalesce(procore_project_id, id),
      coalesce(source_system, 'procore'),
      updated_at
    from procore_projects
    on conflict (id) do update
    set name = excluded.name,
        netsuite_project_id = excluded.netsuite_project_id,
        netsuite_project_manager_id = excluded.netsuite_project_manager_id,
        netsuite_project_manager_name = excluded.netsuite_project_manager_name,
        procore_project_id = excluded.procore_project_id,
        source_system = excluded.source_system,
        updated_at = greatest(project_catalog.updated_at, excluded.updated_at)
  `;

  if (await tableExists("procore_pay_items")) {
    await sql`
      insert into project_pay_items (
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
        updated_at
      from procore_pay_items
      on conflict (project_id, id) do update
      set code = excluded.code,
          name = excluded.name,
          budgeted_quantity = excluded.budgeted_quantity,
          unit_of_measure = excluded.unit_of_measure,
          sort_order = excluded.sort_order,
          raw_data = excluded.raw_data,
          updated_at = greatest(project_pay_items.updated_at, excluded.updated_at)
    `;
  }

  if (await tableExists("procore_sync_state")) {
    await sql`
      insert into project_catalog_sync_state (key, synced_at, updated_at)
      select ${PROJECT_CATALOG_SYNC_STATE_KEY}, synced_at, updated_at
      from procore_sync_state
      where key = ${LEGACY_PROCORE_CACHE_SETTING_KEY}
      order by updated_at desc
      limit 1
      on conflict (key) do update
      set synced_at = excluded.synced_at,
          updated_at = greatest(project_catalog_sync_state.updated_at, excluded.updated_at)
    `;
  }
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

function normalizeProjectIdFilter(projectIds: string[] | undefined) {
  return readStringList(projectIds);
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

type ProjectCatalogProjectRow = {
  id: string;
  name: string;
  netsuite_project_id: string | null;
  netsuite_project_manager_id: string | null;
  netsuite_project_manager_name: string | null;
  procore_project_id: string | null;
  source_system: string | null;
};

type ProjectCatalogPayItemRow = {
  project_id: string;
  id: string;
  code: string;
  name: string;
  budgeted_quantity: string | number;
  unit_of_measure: string;
  sort_order: number;
};

type ProjectCatalogSyncStateRow = {
  synced_at: string | Date;
};

function readSourceSystem(value: unknown) {
  return value === "netsuite" ? "netsuite" : "procore";
}
