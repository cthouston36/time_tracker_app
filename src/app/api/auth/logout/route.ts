import { NextResponse } from "next/server";
import { clearCurrentUser } from "@/lib/auth/session";

export async function POST() {
  await clearCurrentUser();
  return NextResponse.json({ ok: true });
}
