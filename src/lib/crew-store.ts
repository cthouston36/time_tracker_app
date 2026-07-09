import { getSql } from "@/lib/db";
import type { CrewLaborType } from "@/lib/procore/types";

export type StoredCrewMember = {
  id: string;
  laborType?: CrewLaborType;
  name: string;
  jobTitle: string;
  subcontractorCompany?: string;
};

export type StoredCrewMembersByProject = Record<string, StoredCrewMember[]>;

type CrewMemberRow = {
  id: string;
  labor_type: string | null;
  name: string;
  job_title: string;
  subcontractor_company: string | null;
};

type ProjectCrewMemberRow = {
  project_id: string;
  crew_member_id: string;
  crew_member_name: string;
  job_title: string;
  labor_type: string | null;
  subcontractor_company: string | null;
};

let crewTablesReady = false;
const DEFAULT_CREW_LABOR_TYPE: CrewLaborType = "chinchor_employee";

export async function readCrewData() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const crewRows = (await sql`
    select id, name, job_title, labor_type, subcontractor_company
    from crew_members
    order by lower(name), lower(job_title), id
  `) as CrewMemberRow[];

  const projectCrewRows = (await sql`
    select project_id, crew_member_id, crew_member_name, job_title, labor_type, subcontractor_company
    from project_crew_members
    order by project_id, lower(crew_member_name), lower(job_title), crew_member_id
  `) as ProjectCrewMemberRow[];

  const crewDirectory = crewRows.map((row) => ({
    id: row.id,
    laborType: normalizeCrewLaborType(row.labor_type),
    name: row.name,
    jobTitle: row.job_title,
    subcontractorCompany: row.subcontractor_company ?? undefined
  }));
  const crewMembersByProject: StoredCrewMembersByProject = {};

  for (const row of projectCrewRows) {
    crewMembersByProject[row.project_id] = crewMembersByProject[row.project_id] ?? [];
    crewMembersByProject[row.project_id].push({
      id: row.crew_member_id,
      laborType: normalizeCrewLaborType(row.labor_type),
      name: row.crew_member_name,
      jobTitle: row.job_title,
      subcontractorCompany: row.subcontractor_company ?? undefined
    });
  }

  return {
    crewDirectory,
    crewMembersByProject
  };
}

export async function replaceCrewData(crewDirectory: StoredCrewMember[], crewMembersByProject: StoredCrewMembersByProject) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedCrewDirectory = normalizeCrewDirectory(crewDirectory, crewMembersByProject);
  const normalizedCrewMembersByProject = normalizeCrewMembersByProject(crewMembersByProject, normalizedCrewDirectory);
  const queries = [sql`delete from project_crew_members`, sql`delete from crew_members`];

  for (const crewMember of normalizedCrewDirectory) {
    queries.push(sql`
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
        ${JSON.stringify(crewMember)}::jsonb,
        now()
      )
    `);
  }

  for (const [projectId, crewMembers] of Object.entries(normalizedCrewMembersByProject)) {
    for (const crewMember of crewMembers) {
      queries.push(sql`
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
          ${crewMember.id},
          ${crewMember.name},
          ${crewMember.jobTitle},
          ${crewMember.laborType},
          ${crewMember.subcontractorCompany ?? null},
          ${JSON.stringify(crewMember)}::jsonb,
          now()
        )
      `);
    }
  }

  await sql.transaction(queries);

  return {
    crewMembers: normalizedCrewDirectory.length,
    projectCrewAssignments: Object.values(normalizedCrewMembersByProject).reduce(
      (total, crewMembers) => total + crewMembers.length,
      0
    )
  };
}

export async function upsertCrewMember(crewMember: StoredCrewMember) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedCrewMember = normalizeCrewMember(crewMember);

  if (!normalizedCrewMember) {
    return false;
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
      ${normalizedCrewMember.id},
      ${normalizedCrewMember.name},
      ${normalizedCrewMember.jobTitle},
      ${normalizedCrewMember.laborType},
      ${normalizedCrewMember.subcontractorCompany ?? null},
      ${JSON.stringify(normalizedCrewMember)}::jsonb,
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

  return true;
}

export async function addCrewMemberToProject(projectId: string, crewMember: StoredCrewMember) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedProjectId = readString(projectId);
  const normalizedCrewMember = normalizeCrewMember(crewMember);

  if (!normalizedProjectId || !normalizedCrewMember) {
    return false;
  }

  await sql.transaction([
    sql`
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
        ${normalizedCrewMember.id},
        ${normalizedCrewMember.name},
        ${normalizedCrewMember.jobTitle},
        ${normalizedCrewMember.laborType},
        ${normalizedCrewMember.subcontractorCompany ?? null},
        ${JSON.stringify(normalizedCrewMember)}::jsonb,
        now()
      )
      on conflict (id) do update
      set name = excluded.name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
    `,
    sql`
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
        ${normalizedProjectId},
        ${normalizedCrewMember.id},
        ${normalizedCrewMember.name},
        ${normalizedCrewMember.jobTitle},
        ${normalizedCrewMember.laborType},
        ${normalizedCrewMember.subcontractorCompany ?? null},
        ${JSON.stringify(normalizedCrewMember)}::jsonb,
        now()
      )
      on conflict (project_id, crew_member_id) do update
      set crew_member_name = excluded.crew_member_name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
    `
  ]);

  return true;
}

export async function updateCrewMember(crewMember: StoredCrewMember) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedCrewMember = normalizeCrewMember(crewMember);

  if (!normalizedCrewMember) {
    return false;
  }

  await sql.transaction([
    sql`
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
        ${normalizedCrewMember.id},
        ${normalizedCrewMember.name},
        ${normalizedCrewMember.jobTitle},
        ${normalizedCrewMember.laborType},
        ${normalizedCrewMember.subcontractorCompany ?? null},
        ${JSON.stringify(normalizedCrewMember)}::jsonb,
        now()
      )
      on conflict (id) do update
      set name = excluded.name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
    `,
    sql`
      update project_crew_members
      set crew_member_name = ${normalizedCrewMember.name},
          job_title = ${normalizedCrewMember.jobTitle},
          labor_type = ${normalizedCrewMember.laborType},
          subcontractor_company = ${normalizedCrewMember.subcontractorCompany ?? null},
          raw_data = ${JSON.stringify(normalizedCrewMember)}::jsonb,
          updated_at = now()
      where crew_member_id = ${normalizedCrewMember.id}
    `
  ]);

  return true;
}

export async function removeCrewMemberFromProject(projectId: string, crewMemberId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedProjectId = readString(projectId);
  const normalizedCrewMemberId = readString(crewMemberId);

  if (!normalizedProjectId || !normalizedCrewMemberId) {
    return false;
  }

  await sql`
    delete from project_crew_members
    where project_id = ${normalizedProjectId}
      and crew_member_id = ${normalizedCrewMemberId}
  `;

  return true;
}

export async function mergeCrewMember(sourceCrewMemberId: string, targetCrewMember: StoredCrewMember) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const normalizedSourceCrewMemberId = readString(sourceCrewMemberId);
  const normalizedTargetCrewMember = normalizeCrewMember(targetCrewMember);

  if (
    !normalizedSourceCrewMemberId ||
    !normalizedTargetCrewMember ||
    normalizedSourceCrewMemberId === normalizedTargetCrewMember.id
  ) {
    return false;
  }

  await sql.transaction([
    sql`
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
        ${normalizedTargetCrewMember.id},
        ${normalizedTargetCrewMember.name},
        ${normalizedTargetCrewMember.jobTitle},
        ${normalizedTargetCrewMember.laborType},
        ${normalizedTargetCrewMember.subcontractorCompany ?? null},
        ${JSON.stringify(normalizedTargetCrewMember)}::jsonb,
        now()
      )
      on conflict (id) do update
      set name = excluded.name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
    `,
    sql`
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
      select
        project_id,
        ${normalizedTargetCrewMember.id},
        ${normalizedTargetCrewMember.name},
        ${normalizedTargetCrewMember.jobTitle},
        ${normalizedTargetCrewMember.laborType},
        ${normalizedTargetCrewMember.subcontractorCompany ?? null},
        ${JSON.stringify(normalizedTargetCrewMember)}::jsonb,
        now()
      from project_crew_members
      where crew_member_id = ${normalizedSourceCrewMemberId}
      on conflict (project_id, crew_member_id) do update
      set crew_member_name = excluded.crew_member_name,
          job_title = excluded.job_title,
          labor_type = excluded.labor_type,
          subcontractor_company = excluded.subcontractor_company,
          raw_data = excluded.raw_data,
          updated_at = now()
    `,
    sql`
      update project_crew_members
      set crew_member_name = ${normalizedTargetCrewMember.name},
          job_title = ${normalizedTargetCrewMember.jobTitle},
          labor_type = ${normalizedTargetCrewMember.laborType},
          subcontractor_company = ${normalizedTargetCrewMember.subcontractorCompany ?? null},
          raw_data = ${JSON.stringify(normalizedTargetCrewMember)}::jsonb,
          updated_at = now()
      where crew_member_id = ${normalizedTargetCrewMember.id}
    `,
    sql`
      delete from project_crew_members
      where crew_member_id = ${normalizedSourceCrewMemberId}
    `,
    sql`
      delete from crew_members
      where id = ${normalizedSourceCrewMemberId}
    `
  ]);

  return true;
}

async function ensureCrewTables() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  if (crewTablesReady) {
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

  await sql`alter table crew_members add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table crew_members add column if not exists subcontractor_company text`;
  await sql`alter table project_crew_members add column if not exists labor_type text not null default 'chinchor_employee'`;
  await sql`alter table project_crew_members add column if not exists subcontractor_company text`;
  await sql`create index if not exists crew_members_name_idx on crew_members (lower(name))`;
  await sql`create index if not exists crew_members_labor_type_idx on crew_members (labor_type)`;
  await sql`create index if not exists project_crew_members_project_idx on project_crew_members (project_id)`;
  await sql`create index if not exists project_crew_members_member_idx on project_crew_members (crew_member_id)`;

  crewTablesReady = true;
}

function normalizeCrewDirectory(
  crewDirectory: StoredCrewMember[],
  crewMembersByProject: StoredCrewMembersByProject
) {
  const crewMembersById = new Map<string, StoredCrewMember>();

  for (const crewMember of crewDirectory) {
    const normalizedCrewMember = normalizeCrewMember(crewMember);

    if (normalizedCrewMember) {
      crewMembersById.set(normalizedCrewMember.id, normalizedCrewMember);
    }
  }

  for (const crewMembers of Object.values(crewMembersByProject)) {
    for (const crewMember of crewMembers) {
      const normalizedCrewMember = normalizeCrewMember(crewMember);

      if (normalizedCrewMember && !crewMembersById.has(normalizedCrewMember.id)) {
        crewMembersById.set(normalizedCrewMember.id, normalizedCrewMember);
      }
    }
  }

  return sortCrewMembers(Array.from(crewMembersById.values()));
}

function normalizeCrewMembersByProject(
  crewMembersByProject: StoredCrewMembersByProject,
  crewDirectory: StoredCrewMember[]
) {
  const crewMembersById = new Map(crewDirectory.map((crewMember) => [crewMember.id, crewMember]));
  const normalizedCrewMembersByProject: StoredCrewMembersByProject = {};

  for (const [projectId, crewMembers] of Object.entries(crewMembersByProject)) {
    if (!projectId) {
      continue;
    }

    const projectCrewMembersById = new Map<string, StoredCrewMember>();

    for (const crewMember of crewMembers) {
      const normalizedCrewMember = normalizeCrewMember(crewMember);

      if (!normalizedCrewMember) {
        continue;
      }

      projectCrewMembersById.set(normalizedCrewMember.id, crewMembersById.get(normalizedCrewMember.id) ?? normalizedCrewMember);
    }

    normalizedCrewMembersByProject[projectId] = sortCrewMembers(Array.from(projectCrewMembersById.values()));
  }

  return normalizedCrewMembersByProject;
}

function normalizeCrewMember(crewMember: StoredCrewMember | unknown) {
  if (!crewMember || typeof crewMember !== "object" || Array.isArray(crewMember)) {
    return null;
  }

  const record = crewMember as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    laborType: normalizeCrewLaborType(record.laborType),
    jobTitle: readString(record.jobTitle),
    name,
    subcontractorCompany: readString(record.subcontractorCompany) || undefined
  };
}

function sortCrewMembers(crewMembers: StoredCrewMember[]) {
  return [...crewMembers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.jobTitle.localeCompare(b.jobTitle, undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

function normalizeCrewLaborType(value: unknown): CrewLaborType {
  if (value === "subcontractor" || value === "temp_employee" || value === "chinchor_employee") {
    return value;
  }

  return DEFAULT_CREW_LABOR_TYPE;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
