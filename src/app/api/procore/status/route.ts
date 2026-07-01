import { NextResponse } from "next/server";
import { getProcoreIntegrationStatus } from "@/lib/procore/session";

export async function GET() {
  const status = await getProcoreIntegrationStatus();

  return NextResponse.json({
    connected: status.connected,
    connectedAt: status.connectedAt,
    connectedBy: status.connectedBy
  });
}
