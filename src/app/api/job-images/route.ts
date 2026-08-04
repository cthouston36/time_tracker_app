import { NextRequest, NextResponse } from "next/server";
import { requestUserCanAccessProjectId } from "@/lib/auth/project-access-server";
import { getCurrentUser } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/day-key";
import { readJobImageUploads } from "@/lib/job-image-store";
import { getProjects } from "@/lib/project-catalog/projects";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading job image uploads." }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";

  if (!projectId || !isIsoDate(date)) {
    return NextResponse.json({ error: "Provide projectId and date." }, { status: 400 });
  }

  if (!(await requestUserCanAccessProjectId(user, projectId, await getProjects()))) {
    return NextResponse.json({ error: "You do not have access to load images for this project." }, { status: 403 });
  }

  const uploads = await readJobImageUploads(projectId, date);

  if (!uploads) {
    return NextResponse.json({
      databaseConfigured: false,
      uploads: []
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    uploads
  });
}
