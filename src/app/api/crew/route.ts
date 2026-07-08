import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
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

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required to replace all crew data." }, { status: 403 });
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

  await recordAuditLog({
    action: "crew.replaced",
    actor: user,
    metadata: {
      crewDirectoryCount: body.crewDirectory.length,
      projectCrewCount: Object.keys(body.crewMembersByProject).length
    },
    targetType: "crew",
    ...getAuditRequestMetadata(request.headers)
  });

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

  await recordAuditLog({
    action: body.action === "add_to_project" ? "crew.added_to_project" : "crew.saved",
    actor: user,
    metadata: {
      crewMemberName: body.crewMember.name,
      jobTitle: body.crewMember.jobTitle,
      projectId: body.projectId
    },
    targetId: body.action === "add_to_project" ? body.projectId : body.crewMember.id,
    targetType: body.action === "add_to_project" ? "project" : "crew_member",
    ...getAuditRequestMetadata(request.headers)
  });

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

  if (body.action === "merge" && user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can merge crew members." }, { status: 403 });
  }

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

  await recordAuditLog({
    action: body.action === "merge" ? "crew.merged" : "crew.updated",
    actor: user,
    metadata:
      body.action === "merge"
        ? {
            sourceCrewMemberId: body.sourceCrewMemberId,
            targetCrewMemberId: body.targetCrewMember?.id,
            targetCrewMemberName: body.targetCrewMember?.name
          }
        : {
            crewMemberId: body.crewMember?.id,
            crewMemberName: body.crewMember?.name,
            jobTitle: body.crewMember?.jobTitle
          },
    targetId: body.action === "merge" ? body.targetCrewMember?.id : body.crewMember?.id,
    targetType: "crew_member",
    ...getAuditRequestMetadata(request.headers)
  });

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

  await recordAuditLog({
    action: "crew.removed_from_project",
    actor: user,
    metadata: {
      crewMemberId,
      projectId
    },
    targetId: projectId,
    targetType: "project",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}
