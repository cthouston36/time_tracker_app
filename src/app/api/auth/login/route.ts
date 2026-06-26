import { NextRequest, NextResponse } from "next/server";
import { setCurrentUser } from "@/lib/auth/session";
import { validateLocalUser } from "@/lib/auth/users";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    password?: string;
  };
  const user = validateLocalUser(body.userId ?? "", body.password ?? "");

  if (!user) {
    return NextResponse.json({ error: "Invalid user ID or password." }, { status: 401 });
  }

  await setCurrentUser(user);

  return NextResponse.json({ user });
}
