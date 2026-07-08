import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDailyReportPdf, buildDailyReportPdfFileName, type DailyReportPdfPayload } from "@/lib/daily-report-pdf";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before downloading daily reports." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as DailyReportPdfPayload;

    if (!payload?.project?.name || !payload.date || !payload.report) {
      return NextResponse.json({ error: "Missing daily report data." }, { status: 400 });
    }

    const pdf = await buildDailyReportPdf(payload);
    const fileName = buildDailyReportPdfFileName(payload.project.name, payload.date);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate daily report PDF." },
      { status: 500 }
    );
  }
}
