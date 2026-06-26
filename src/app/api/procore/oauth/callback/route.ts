import { NextRequest, NextResponse } from "next/server";
import { getProcoreConfig } from "@/lib/procore/config";
import { exchangeCodeForToken } from "@/lib/procore/oauth";
import { consumeOAuthState, saveProcoreTokens } from "@/lib/procore/session";

export async function GET(request: NextRequest) {
  const config = getProcoreConfig();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?procore=error&reason=${encodeURIComponent(error)}`, config.appUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?procore=missing_code", config.appUrl));
  }

  const stateIsValid = await consumeOAuthState(state);

  if (!stateIsValid) {
    return NextResponse.redirect(new URL("/?procore=invalid_state", config.appUrl));
  }

  const tokenResponse = await exchangeCodeForToken(code);
  await saveProcoreTokens(tokenResponse);

  return NextResponse.redirect(new URL("/?procore=connected", config.appUrl));
}
