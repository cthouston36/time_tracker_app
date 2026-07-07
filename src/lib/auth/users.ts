import { getSql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import type { AuthUser, UserRole } from "@/lib/auth/types";

type BootstrapUser = AuthUser & {
  password?: string;
};

type AuthUserRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  password_hash: string;
  active: boolean;
};

type CountRow = {
  count: number | string | bigint;
};

const bootstrapUsers: BootstrapUser[] = [
  {
    id: "caleb",
    firstName: "Caleb",
    lastName: "Houston",
    password: process.env.LOCAL_ADMIN_PASSWORD,
    role: "admin"
  },
  {
    id: "calebpm",
    firstName: "Caleb",
    lastName: "Houston",
    password: process.env.LOCAL_PM_PASSWORD,
    role: "project_manager"
  },
  {
    id: "field",
    firstName: "Field",
    lastName: "User",
    password: process.env.LOCAL_FIELD_PASSWORD,
    role: "standard"
  },
  {
    id: "calebuser",
    firstName: "Caleb",
    lastName: "Houston",
    password: process.env.LOCAL_USER_PASSWORD,
    role: "standard"
  }
];

let authUsersTableReady = false;
let bootstrapAttempted = false;

export async function validateUserCredentials(userId: string, password: string) {
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId || !password) {
    return null;
  }

  const sql = getSql();

  if (!sql) {
    return validateBootstrapUser(normalizedUserId, password);
  }

  await ensureAuthUsersTable();
  await seedBootstrapUsersIfEmpty();

  const rows = (await sql`
    select user_id, first_name, last_name, role, password_hash, active
    from app_users
    where user_id = ${normalizedUserId}
    limit 1
  `) as AuthUserRow[];
  const user = rows[0];

  if (!user?.active || !isUserRole(user.role)) {
    return null;
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  return {
    firstName: user.first_name,
    id: user.user_id,
    lastName: user.last_name,
    role: user.role
  } satisfies AuthUser;
}

async function ensureAuthUsersTable() {
  const sql = getSql();

  if (!sql || authUsersTableReady) {
    return;
  }

  await sql`
    create table if not exists app_users (
      user_id text primary key,
      first_name text not null,
      last_name text not null,
      role text not null check (role in ('standard', 'project_manager', 'admin')),
      password_hash text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists app_users_active_idx on app_users (active)`;

  authUsersTableReady = true;
}

async function seedBootstrapUsersIfEmpty() {
  const sql = getSql();

  if (!sql || bootstrapAttempted) {
    return;
  }

  bootstrapAttempted = true;

  const rows = (await sql`select count(*)::int as count from app_users`) as CountRow[];
  const userCount = Number(rows[0]?.count ?? 0);

  if (userCount > 0) {
    return;
  }

  const usersToSeed = bootstrapUsers
    .map((user) => ({
      ...user,
      id: normalizeUserId(user.id),
      password: normalizePassword(user.password)
    }))
    .filter((user): user is BootstrapUser & { password: string } => Boolean(user.id && user.password));

  if (usersToSeed.length === 0) {
    return;
  }

  const queries = [];

  for (const user of usersToSeed) {
    const passwordHash = await hashPassword(user.password);

    queries.push(sql`
      insert into app_users (
        user_id,
        first_name,
        last_name,
        role,
        password_hash,
        active,
        created_at,
        updated_at
      )
      values (
        ${user.id},
        ${user.firstName},
        ${user.lastName},
        ${user.role},
        ${passwordHash},
        true,
        now(),
        now()
      )
      on conflict (user_id) do nothing
    `);
  }

  await sql.transaction(queries);
}

function validateBootstrapUser(userId: string, password: string): AuthUser | null {
  const user = bootstrapUsers.find(
    (candidate) => normalizeUserId(candidate.id) === userId && candidate.password && candidate.password === password
  );

  if (!user) {
    return null;
  }

  return {
    firstName: user.firstName,
    id: normalizeUserId(user.id),
    lastName: user.lastName,
    role: user.role
  };
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

function normalizePassword(password: string | undefined) {
  return typeof password === "string" && password.length > 0 ? password : undefined;
}

function isUserRole(role: string): role is UserRole {
  return role === "standard" || role === "project_manager" || role === "admin";
}
