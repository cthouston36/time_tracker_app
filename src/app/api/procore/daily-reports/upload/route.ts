import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDailyReportToProcore } from "@/lib/procore/documents";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before uploading daily reports." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await uploadDailyReportToProcore(payload);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload daily report to Procore.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
