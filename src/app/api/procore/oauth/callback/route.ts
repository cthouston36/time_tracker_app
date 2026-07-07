import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProcoreConfig } from "@/lib/procore/config";
import { exchangeCodeForToken } from "@/lib/procore/oauth";
import { consumeOAuthState, saveProcoreIntegrationTokens } from "@/lib/procore/session";

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

  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.redirect(new URL("/?procore=admin_required", config.appUrl));
  }

  const stateIsValid = await consumeOAuthState(state);

  if (!stateIsValid) {
    return NextResponse.redirect(new URL("/?procore=invalid_state", config.appUrl));
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code);
    await saveProcoreIntegrationTokens(tokenResponse, {
      connectedBy: `${user.firstName} ${user.lastName}`.trim() || user.id
    });
  } catch (callbackError) {
    console.error("Procore OAuth callback failed", callbackError);
    return NextResponse.redirect(new URL("/?procore=callback_failed", config.appUrl));
  }

  return NextResponse.redirect(new URL("/?procore=connected", config.appUrl));
}
