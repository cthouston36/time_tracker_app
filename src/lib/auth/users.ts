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
  netsuite_project_manager_id: string | null;
  netsuite_project_manager_name: string | null;
  role: string;
  password_hash: string;
  active: boolean;
};

type CountRow = {
  count: number | string | bigint;
};

export type ManagedAppUser = AuthUser & {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SaveAppUserInput = {
  active: boolean;
  firstName: string;
  lastName: string;
  netSuiteProjectManagerId?: string;
  netSuiteProjectManagerName?: string;
  password?: string;
  role: UserRole;
  userId: string;
};

export type ChangePasswordResult =
  | "changed"
  | "database_not_configured"
  | "invalid_current_password"
  | "invalid_new_password"
  | "invalid_user";

export type PasswordResetResult =
  | "database_not_configured"
  | "invalid_new_password"
  | "invalid_token"
  | "invalid_user"
  | "reset";

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
    select
      user_id,
      first_name,
      last_name,
      netsuite_project_manager_id,
      netsuite_project_manager_name,
      role,
      password_hash,
      active
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
    netSuiteProjectManagerId: user.netsuite_project_manager_id ?? undefined,
    netSuiteProjectManagerName: user.netsuite_project_manager_name ?? undefined,
    role: user.role
  } satisfies AuthUser;
}

export async function getActiveAppUser(userId: string) {
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId) {
    return null;
  }

  const sql = getSql();

  if (!sql) {
    const user = bootstrapUsers.find((candidate) => normalizeUserId(candidate.id) === normalizedUserId);

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

  await ensureAuthUsersTable();
  await seedBootstrapUsersIfEmpty();

  const rows = (await sql`
    select
      user_id,
      first_name,
      last_name,
      netsuite_project_manager_id,
      netsuite_project_manager_name,
      role,
      password_hash,
      active
    from app_users
    where user_id = ${normalizedUserId}
    limit 1
  `) as AuthUserRow[];
  const user = rows[0];

  if (!user?.active || !isUserRole(user.role)) {
    return null;
  }

  return {
    firstName: user.first_name,
    id: user.user_id,
    lastName: user.last_name,
    netSuiteProjectManagerId: user.netsuite_project_manager_id ?? undefined,
    netSuiteProjectManagerName: user.netsuite_project_manager_name ?? undefined,
    role: user.role
  } satisfies AuthUser;
}

export async function listAppUsers() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAuthUsersTable();
  await seedBootstrapUsersIfEmpty();

  const rows = (await sql`
    select
      user_id,
      first_name,
      last_name,
      netsuite_project_manager_id,
      netsuite_project_manager_name,
      role,
      active,
      created_at::text as created_at,
      updated_at::text as updated_at
    from app_users
    order by first_name, last_name, user_id
  `) as Array<Omit<AuthUserRow, "password_hash"> & { created_at: string | null; updated_at: string | null }>;

  return rows.flatMap((row) => {
    if (!isUserRole(row.role)) {
      return [];
    }

    return [
      {
        active: row.active,
        createdAt: row.created_at ?? undefined,
        firstName: row.first_name,
        id: row.user_id,
        lastName: row.last_name,
        netSuiteProjectManagerId: row.netsuite_project_manager_id ?? undefined,
        netSuiteProjectManagerName: row.netsuite_project_manager_name ?? undefined,
        role: row.role,
        updatedAt: row.updated_at ?? undefined
      } satisfies ManagedAppUser
    ];
  });
}

export async function saveAppUser(input: SaveAppUserInput) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAuthUsersTable();
  await seedBootstrapUsersIfEmpty();

  const userId = normalizeUserId(input.userId);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const netSuiteProjectManagerId = readOptionalText(input.netSuiteProjectManagerId);
  const netSuiteProjectManagerName = readOptionalText(input.netSuiteProjectManagerName);
  const password = normalizePassword(input.password);

  if (!userId || !firstName || !lastName || !isUserRole(input.role)) {
    return false;
  }

  const existingRows = (await sql`
    select user_id
    from app_users
    where user_id = ${userId}
    limit 1
  `) as Array<{ user_id: string }>;
  const existingUser = existingRows[0];

  if (!existingUser && !password) {
    return false;
  }

  if (password) {
    const passwordHash = await hashPassword(password);

    await sql`
      insert into app_users (
        user_id,
        first_name,
        last_name,
        netsuite_project_manager_id,
        netsuite_project_manager_name,
        role,
        password_hash,
        active,
        created_at,
        updated_at
      )
      values (
        ${userId},
        ${firstName},
        ${lastName},
        ${netSuiteProjectManagerId},
        ${netSuiteProjectManagerName},
        ${input.role},
        ${passwordHash},
        ${input.active},
        now(),
        now()
      )
      on conflict (user_id) do update
      set first_name = excluded.first_name,
          last_name = excluded.last_name,
          netsuite_project_manager_id = excluded.netsuite_project_manager_id,
          netsuite_project_manager_name = excluded.netsuite_project_manager_name,
          role = excluded.role,
          password_hash = excluded.password_hash,
          active = excluded.active,
          updated_at = now()
    `;
  } else {
    await sql`
      update app_users
      set first_name = ${firstName},
          last_name = ${lastName},
          netsuite_project_manager_id = ${netSuiteProjectManagerId},
          netsuite_project_manager_name = ${netSuiteProjectManagerName},
          role = ${input.role},
          active = ${input.active},
          updated_at = now()
      where user_id = ${userId}
    `;
  }

  return true;
}

export async function changeCurrentUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedNewPassword = normalizePassword(newPassword);

  if (!normalizedUserId) {
    return "invalid_user" satisfies ChangePasswordResult;
  }

  if (!currentPassword || !normalizedNewPassword || normalizedNewPassword.length < 8) {
    return "invalid_new_password" satisfies ChangePasswordResult;
  }

  const sql = getSql();

  if (!sql) {
    return "database_not_configured" satisfies ChangePasswordResult;
  }

  await ensureAuthUsersTable();

  const rows = (await sql`
    select
      user_id,
      first_name,
      last_name,
      netsuite_project_manager_id,
      netsuite_project_manager_name,
      role,
      password_hash,
      active
    from app_users
    where user_id = ${normalizedUserId}
    limit 1
  `) as AuthUserRow[];
  const user = rows[0];

  if (!user?.active || !isUserRole(user.role)) {
    return "invalid_user" satisfies ChangePasswordResult;
  }

  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    return "invalid_current_password" satisfies ChangePasswordResult;
  }

  const passwordHash = await hashPassword(normalizedNewPassword);

  await sql`
    update app_users
    set password_hash = ${passwordHash},
        updated_at = now()
    where user_id = ${normalizedUserId}
  `;

  return "changed" satisfies ChangePasswordResult;
}

export async function createPasswordResetToken(userId: string) {
  const normalizedUserId = normalizeUserId(userId);
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAuthUsersTable();
  await seedBootstrapUsersIfEmpty();

  if (!normalizedUserId) {
    return false;
  }

  const users = (await sql`
    select user_id
    from app_users
    where user_id = ${normalizedUserId}
      and active = true
    limit 1
  `) as Array<{ user_id: string }>;

  if (!users[0]) {
    return false;
  }

  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  const tokenHash = await hashPassword(token);
  const tokenId = crypto.randomUUID();

  await sql.transaction([
    sql`
      update app_password_reset_tokens
      set used_at = now()
      where user_id = ${normalizedUserId}
        and used_at is null
    `,
    sql`
      insert into app_password_reset_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at
      )
      values (
        ${tokenId},
        ${normalizedUserId},
        ${tokenHash},
        now() + interval '24 hours',
        now()
      )
    `
  ]);

  return {
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    token,
    userId: normalizedUserId
  };
}

export async function resetPasswordWithToken(userId: string, token: string, newPassword: string) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedToken = token.trim().toUpperCase();
  const normalizedNewPassword = normalizePassword(newPassword);

  if (!normalizedUserId || !normalizedToken) {
    return "invalid_user" satisfies PasswordResetResult;
  }

  if (!normalizedNewPassword || normalizedNewPassword.length < 8) {
    return "invalid_new_password" satisfies PasswordResetResult;
  }

  const sql = getSql();

  if (!sql) {
    return "database_not_configured" satisfies PasswordResetResult;
  }

  await ensureAuthUsersTable();

  const users = (await sql`
    select user_id
    from app_users
    where user_id = ${normalizedUserId}
      and active = true
    limit 1
  `) as Array<{ user_id: string }>;

  if (!users[0]) {
    return "invalid_user" satisfies PasswordResetResult;
  }

  const tokenRows = (await sql`
    select id, token_hash
    from app_password_reset_tokens
    where user_id = ${normalizedUserId}
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 5
  `) as Array<{ id: string; token_hash: string }>;
  let matchingTokenId = "";

  for (const tokenRow of tokenRows) {
    if (await verifyPassword(normalizedToken, tokenRow.token_hash)) {
      matchingTokenId = tokenRow.id;
      break;
    }
  }

  if (!matchingTokenId) {
    return "invalid_token" satisfies PasswordResetResult;
  }

  const passwordHash = await hashPassword(normalizedNewPassword);

  await sql.transaction([
    sql`
      update app_users
      set password_hash = ${passwordHash},
          updated_at = now()
      where user_id = ${normalizedUserId}
    `,
    sql`
      update app_password_reset_tokens
      set used_at = now()
      where id = ${matchingTokenId}
    `
  ]);

  return "reset" satisfies PasswordResetResult;
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
      netsuite_project_manager_id text,
      netsuite_project_manager_name text,
      role text not null check (role in ('standard', 'project_manager', 'admin')),
      password_hash text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table app_users add column if not exists netsuite_project_manager_id text`;
  await sql`alter table app_users add column if not exists netsuite_project_manager_name text`;

  await sql`
    create table if not exists app_password_reset_tokens (
      id text primary key,
      user_id text not null references app_users(user_id) on delete cascade,
      token_hash text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists app_users_active_idx on app_users (active)`;
  await sql`create index if not exists app_users_netsuite_project_manager_idx on app_users (netsuite_project_manager_id)`;
  await sql`create index if not exists app_password_reset_tokens_user_idx on app_password_reset_tokens (user_id, expires_at)`;

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
        netsuite_project_manager_id,
        netsuite_project_manager_name,
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
        ${null},
        ${null},
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

function readOptionalText(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUserRole(role: string): role is UserRole {
  return role === "standard" || role === "project_manager" || role === "admin";
}
