import { getSql } from "@/lib/db";

export type StoredCrewMember = {
  id: string;
  name: string;
  jobTitle: string;
};

export type StoredCrewMembersByProject = Record<string, StoredCrewMember[]>;

type CrewMemberRow = {
  id: string;
  name: string;
  job_title: string;
};

type ProjectCrewMemberRow = {
  project_id: string;
  crew_member_id: string;
  crew_member_name: string;
  job_title: string;
};

let crewTablesReady = false;

export async function readCrewData() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureCrewTables();

  const crewRows = (await sql`
    select id, name, job_title
    from crew_members
    order by lower(name), lower(job_title), id
  `) as CrewMemberRow[];

  const projectCrewRows = (await sql`
    select project_id, crew_member_id, crew_member_name, job_title
    from project_crew_members
    order by project_id, lower(crew_member_name), lower(job_title), crew_member_id
  `) as ProjectCrewMemberRow[];

  const crewDirectory = crewRows.map((row) => ({
    id: row.id,
    name: row.name,
    jobTitle: row.job_title
  }));
  const crewMembersByProject: StoredCrewMembersByProject = {};

  for (const row of projectCrewRows) {
    crewMembersByProject[row.project_id] = crewMembersByProject[row.project_id] ?? [];
    crewMembersByProject[row.project_id].push({
      id: row.crew_member_id,
      name: row.crew_member_name,
      jobTitle: row.job_title
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
        raw_data,
        updated_at
      )
      values (
        ${crewMember.id},
        ${crewMember.name},
        ${crewMember.jobTitle},
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
          raw_data,
          updated_at
        )
        values (
          ${projectId},
          ${crewMember.id},
          ${crewMember.name},
          ${crewMember.jobTitle},
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
      raw_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (project_id, crew_member_id)
    )
  `;

  await sql`create index if not exists crew_members_name_idx on crew_members (lower(name))`;
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
    jobTitle: readString(record.jobTitle),
    name
  };
}

function sortCrewMembers(crewMembers: StoredCrewMember[]) {
  return [...crewMembers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.jobTitle.localeCompare(b.jobTitle, undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
