import { NextResponse } from "next/server";
import { buildProcoreAuthorizationUrl } from "@/lib/procore/oauth";
import { createOAuthState } from "@/lib/procore/session";

export async function GET() {
  const state = await createOAuthState();
  const authorizationUrl = buildProcoreAuthorizationUrl(state);

  return NextResponse.redirect(authorizationUrl);
}
