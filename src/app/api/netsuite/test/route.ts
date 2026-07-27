import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getNetSuiteConnectionTest } from "@/lib/netsuite/projects";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await getNetSuiteConnectionTest();

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to test NetSuite connection.";

    return NextResponse.json({ error: message, ok: false }, { status: 502 });
  }
}
