import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProcoreIntegrationStatus } from "@/lib/procore/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading Procore status." }, { status: 401 });
  }

  const status = await getProcoreIntegrationStatus();

  return NextResponse.json({
    connected: status.connected,
    connectedAt: status.connectedAt,
    connectedBy: status.connectedBy
  });
}
