import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readCrewData, replaceCrewData, type StoredCrewMember, type StoredCrewMembersByProject } from "@/lib/crew-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading crew data." }, { status: 401 });
  }

  const crewData = await readCrewData();

  if (!crewData) {
    return NextResponse.json({
      crewDirectory: [],
      crewMembersByProject: {},
      databaseConfigured: false
    });
  }

  return NextResponse.json({
    ...crewData,
    databaseConfigured: true
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving crew data." }, { status: 401 });
  }

  const body = (await request.json()) as {
    crewDirectory?: StoredCrewMember[];
    crewMembersByProject?: StoredCrewMembersByProject;
  };

  if (!body || !Array.isArray(body.crewDirectory) || !body.crewMembersByProject) {
    return NextResponse.json({ error: "Missing crew data." }, { status: 400 });
  }

  const result = await replaceCrewData(body.crewDirectory, body.crewMembersByProject);

  if (!result) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true,
    ...result
  });
}
