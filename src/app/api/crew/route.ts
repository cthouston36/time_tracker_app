import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  addCrewMemberToProject,
  mergeCrewMember,
  readCrewData,
  removeCrewMemberFromProject,
  replaceCrewData,
  updateCrewMember,
  upsertCrewMember,
  type StoredCrewMember,
  type StoredCrewMembersByProject
} from "@/lib/crew-store";

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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving crew data." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    crewMember?: StoredCrewMember;
    projectId?: string;
  };

  if (!body || !body.crewMember) {
    return NextResponse.json({ error: "Missing crew member." }, { status: 400 });
  }

  const result =
    body.action === "add_to_project"
      ? await addCrewMemberToProject(body.projectId ?? "", body.crewMember)
      : await upsertCrewMember(body.crewMember);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid crew member or project." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving crew data." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    crewMember?: StoredCrewMember;
    sourceCrewMemberId?: string;
    targetCrewMember?: StoredCrewMember;
  };

  const result =
    body.action === "merge"
      ? await mergeCrewMember(body.sourceCrewMemberId ?? "", body.targetCrewMember as StoredCrewMember)
      : await updateCrewMember(body.crewMember as StoredCrewMember);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid crew member merge or update." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting crew data." }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
  const crewMemberId = request.nextUrl.searchParams.get("crewMemberId")?.trim();

  if (!projectId || !crewMemberId) {
    return NextResponse.json({ error: "Provide projectId and crewMemberId." }, { status: 400 });
  }

  const result = await removeCrewMemberFromProject(projectId, crewMemberId);

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid project or crew member." }, { status: 400 });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}
