import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProcoreConfig } from "@/lib/procore/config";
import { buildProcoreAuthorizationUrl } from "@/lib/procore/oauth";
import { createOAuthState } from "@/lib/procore/session";

export async function GET() {
  const config = getProcoreConfig();
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return NextResponse.redirect(new URL("/?procore=admin_required", config.appUrl));
  }

  const state = await createOAuthState();
  const authorizationUrl = buildProcoreAuthorizationUrl(state);

  return NextResponse.redirect(authorizationUrl);
}
