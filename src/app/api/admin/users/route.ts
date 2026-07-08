import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import { listAppUsers, saveAppUser, type ManagedAppUser, type SaveAppUserInput } from "@/lib/auth/users";
import type { AuthUser, UserRole } from "@/lib/auth/types";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const users = await listAppUsers();

  if (!users) {
    return NextResponse.json({
      databaseConfigured: false,
      users: []
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    users
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as Partial<SaveAppUserInput>;
  const userId = body.userId?.trim().toLowerCase() ?? "";
  const role = body.role;
  const active = body.active ?? true;
  const existingUsers = await listAppUsers();
  const existingUser = existingUsers?.find((user) => user.id === userId);

  if (!userId || !body.firstName?.trim() || !body.lastName?.trim() || !isUserRole(role)) {
    return NextResponse.json({ error: "Provide user ID, first name, last name, and role." }, { status: 400 });
  }

  if (userId === currentUser.id && (!active || role !== "admin")) {
    return NextResponse.json({ error: "You cannot deactivate yourself or remove your own admin role." }, { status: 400 });
  }

  const result = await saveAppUser({
    active,
    firstName: body.firstName,
    lastName: body.lastName,
    password: body.password,
    role,
    userId
  });

  if (result === null) {
    return NextResponse.json({ error: "Database is not configured for user management." }, { status: 503 });
  }

  if (!result) {
    return NextResponse.json({ error: "New users require a password." }, { status: 400 });
  }

  await recordUserAuditEvents({
    active,
    currentUser,
    existingUser,
    firstName: body.firstName,
    lastName: body.lastName,
    passwordChanged: typeof body.password === "string" && body.password.length > 0,
    request,
    role,
    userId
  });

  const users = await listAppUsers();

  return NextResponse.json({
    databaseConfigured: true,
    ok: true,
    users: users ?? []
  });
}

function isUserRole(role: unknown): role is UserRole {
  return role === "standard" || role === "project_manager" || role === "admin";
}

async function recordUserAuditEvents({
  active,
  currentUser,
  existingUser,
  firstName,
  lastName,
  passwordChanged,
  request,
  role,
  userId
}: {
  active: boolean;
  currentUser: AuthUser;
  existingUser?: ManagedAppUser;
  firstName: string;
  lastName: string;
  passwordChanged: boolean;
  request: NextRequest;
  role: UserRole;
  userId: string;
}) {
  const requestMetadata = getAuditRequestMetadata(request.headers);
  const baseAuditLog = {
    actor: currentUser,
    targetId: userId,
    targetType: "app_user",
    ...requestMetadata
  };
  const nextUserMetadata = {
    active,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role
  };

  if (!existingUser) {
    await recordAuditLog({
      ...baseAuditLog,
      action: "user.created",
      metadata: {
        ...nextUserMetadata,
        temporaryPasswordSet: passwordChanged
      }
    });
    return;
  }

  const auditEvents = [];

  if (existingUser.role !== role) {
    auditEvents.push({
      action: "user.role_changed",
      metadata: {
        from: existingUser.role,
        to: role
      }
    });
  }

  if (existingUser.active !== active) {
    auditEvents.push({
      action: active ? "user.reactivated" : "user.deactivated",
      metadata: {
        from: existingUser.active,
        to: active
      }
    });
  }

  if (passwordChanged) {
    auditEvents.push({
      action: "user.password_reset",
      metadata: {
        resetByAdmin: true
      }
    });
  }

  if (
    existingUser.firstName !== firstName.trim() ||
    existingUser.lastName !== lastName.trim() ||
    auditEvents.length === 0
  ) {
    auditEvents.push({
      action: "user.updated",
      metadata: {
        from: {
          active: existingUser.active,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role
        },
        to: nextUserMetadata
      }
    });
  }

  for (const event of auditEvents) {
    await recordAuditLog({
      ...baseAuditLog,
      action: event.action,
      metadata: event.metadata
    });
  }
}
