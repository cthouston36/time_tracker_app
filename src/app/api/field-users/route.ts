import { NextResponse } from "next/server";
import { canAccessReports } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { listAppUsers } from "@/lib/auth/users";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Sign in before loading Field users." }, { status: 401 });
  }

  if (!canAccessReports(currentUser)) {
    return NextResponse.json({ error: "PM, Executive, or Admin access is required." }, { status: 403 });
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
    users: users
      .filter((user) => user.role === "standard" && user.active !== false)
      .map((user) => ({
        firstName: user.firstName,
        id: user.id,
        lastName: user.lastName,
        role: user.role
      }))
  });
}
