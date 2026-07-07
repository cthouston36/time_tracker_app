import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listAppUsers, saveAppUser, type SaveAppUserInput } from "@/lib/auth/users";
import type { UserRole } from "@/lib/auth/types";

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
