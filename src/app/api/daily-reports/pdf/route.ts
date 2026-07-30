import { NextRequest, NextResponse } from "next/server";
import { userCanAccessProjectId } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDailyReportPdf, buildDailyReportPdfFileName, type DailyReportPdfPayload } from "@/lib/daily-report-pdf";
import { getProjects } from "@/lib/procore/projects";

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

    const projectId = payload.project.id;
    const projects = await getProjects();
    const project = projects.find((candidate) => candidate.id === projectId);

    if (!projectId || !project) {
      return NextResponse.json({ error: "Provide a valid project." }, { status: 400 });
    }

    if (!userCanAccessProjectId(user, projectId, projects)) {
      return NextResponse.json({ error: "You do not have access to download daily reports for this project." }, { status: 403 });
    }

    const pdf = await buildDailyReportPdf({ ...payload, project });
    const fileName = buildDailyReportPdfFileName(project.name, payload.date);

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
