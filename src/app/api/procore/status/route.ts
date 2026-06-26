import { NextResponse } from "next/server";
import { getProcoreAccessToken } from "@/lib/procore/session";

export async function GET() {
  const accessToken = await getProcoreAccessToken();

  return NextResponse.json({
    connected: Boolean(accessToken)
  });
}
