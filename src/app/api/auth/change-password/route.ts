import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { changeCurrentUserPassword } from "@/lib/auth/users";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Sign in before changing your password." }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  const result = await changeCurrentUserPassword(currentUser.id, currentPassword, newPassword);

  if (result === "database_not_configured") {
    return NextResponse.json({ error: "Password changes require the production database." }, { status: 503 });
  }

  if (result === "invalid_current_password") {
    return NextResponse.json({ error: "Current password is not correct." }, { status: 400 });
  }

  if (result === "invalid_new_password") {
    return NextResponse.json({ error: "Enter your current password and a new password with at least 8 characters." }, { status: 400 });
  }

  if (result === "invalid_user") {
    return NextResponse.json({ error: "Your account is no longer active." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
