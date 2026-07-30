import { NextRequest, NextResponse } from "next/server";
import { canAccessReports, getAccessibleProjectsForUser } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/session";
import { listAppUsers } from "@/lib/auth/users";
import { getAuditRequestMetadata, recordAuditLog } from "@/lib/audit-log";
import {
  insertSyncLogEntry,
  readProjectControls,
  replaceMyJobsForUser,
  replaceProjectControls,
  setProjectArchive,
  setProjectBlacklist,
  type StoredMyJobsByUser,
  type StoredProjectArchiveById,
  type StoredProjectBlacklistById,
  type StoredSyncLogEntry
} from "@/lib/project-controls-store";
import { getProjects } from "@/lib/procore/projects";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before loading project controls." }, { status: 401 });
  }

  const projectControls = await readProjectControls();

  if (!projectControls) {
    return NextResponse.json({
      databaseConfigured: false,
      myJobsByUser: {},
      projectArchiveById: {},
      projectBlacklistById: {},
      syncLog: []
    });
  }

  if (user.role !== "admin" && canAccessReports(user)) {
    const allProjects = await getProjects();
    const accessibleProjectIds = new Set(
      getAccessibleProjectsForUser(user, allProjects, {
        assignedProjectIdsByUser: projectControls.myJobsByUser
      }).map((project) => project.id)
    );
    const scopedMyJobsByUser = Object.fromEntries(
      Object.entries(projectControls.myJobsByUser)
        .map(([userId, projectIds]) => [
          userId,
          projectIds.filter((projectId) => accessibleProjectIds.has(projectId))
        ])
        .filter(([, projectIds]) => projectIds.length > 0)
    );

    return NextResponse.json({
      databaseConfigured: true,
      myJobsByUser: scopedMyJobsByUser,
      projectArchiveById: projectControls.projectArchiveById,
      projectBlacklistById: projectControls.projectBlacklistById,
      syncLog: []
    });
  }

  if (user.role !== "admin") {
    return NextResponse.json({
      databaseConfigured: true,
      myJobsByUser: {
        [user.id]: projectControls.myJobsByUser[user.id] ?? []
      },
      projectArchiveById: projectControls.projectArchiveById,
      projectBlacklistById: projectControls.projectBlacklistById,
      syncLog: []
    });
  }

  return NextResponse.json({
    ...projectControls,
    databaseConfigured: true
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving project controls." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access is required to replace all project controls." }, { status: 403 });
  }

  const body = (await request.json()) as {
    myJobsByUser?: StoredMyJobsByUser;
    projectArchiveById?: StoredProjectArchiveById;
    projectBlacklistById?: StoredProjectBlacklistById;
    syncLog?: StoredSyncLogEntry[];
  };

  if (!body || !isRecord(body.myJobsByUser) || !isRecord(body.projectBlacklistById) || !Array.isArray(body.syncLog)) {
    return NextResponse.json({ error: "Missing project controls." }, { status: 400 });
  }

  const result = await replaceProjectControls(
    body.myJobsByUser,
    isRecord(body.projectArchiveById) ? body.projectArchiveById : {},
    body.projectBlacklistById,
    body.syncLog
  );

  if (!result) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  await recordAuditLog({
    action: "project_controls.replaced",
    actor: user,
    metadata: {
      myJobsUserCount: Object.keys(body.myJobsByUser).length,
      projectArchiveCount: isRecord(body.projectArchiveById) ? Object.keys(body.projectArchiveById).length : 0,
      projectBlacklistCount: Object.keys(body.projectBlacklistById).length,
      syncLogCount: body.syncLog.length
    },
    targetType: "project_controls",
    ...getAuditRequestMetadata(request.headers)
  });

  return NextResponse.json({
    databaseConfigured: true,
    ok: true,
    ...result
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before saving project controls." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    archived?: boolean;
    blacklisted?: boolean;
    projectId?: string;
    projectIds?: unknown;
    syncLogEntry?: StoredSyncLogEntry;
    userId?: string;
  };

  let result: boolean | null;

  if (body.action === "save_my_jobs") {
    const userId = body.userId?.trim() ?? "";

    if (user.role === "project_manager" || user.role === "executive") {
      return NextResponse.json({ error: "My Projects are managed automatically for this role." }, { status: 403 });
    }

    if (!userId || !Array.isArray(body.projectIds)) {
      return NextResponse.json({ error: "Provide userId and projectIds." }, { status: 400 });
    }

    if (user.id !== userId && user.role !== "admin") {
      return NextResponse.json({ error: "You can only update your own My Jobs list." }, { status: 403 });
    }

    result = await replaceMyJobsForUser(userId, body.projectIds.filter((projectId) => typeof projectId === "string"));
  } else if (body.action === "assign_field_projects") {
    const userId = body.userId?.trim().toLowerCase() ?? "";

    if (user.role !== "admin" && user.role !== "executive" && user.role !== "project_manager") {
      return NextResponse.json({ error: "Only PM, Executive, or Admin users can assign Field projects." }, { status: 403 });
    }

    if (!userId || !Array.isArray(body.projectIds)) {
      return NextResponse.json({ error: "Provide field userId and projectIds." }, { status: 400 });
    }

    const users = await listAppUsers();
    const targetUser = users?.find((candidate) => candidate.id === userId);

    if (!targetUser || targetUser.role !== "standard" || targetUser.active === false) {
      return NextResponse.json({ error: "Select an active Field user." }, { status: 400 });
    }

    const projectControls = await readProjectControls();
    const assignedProjectIdsByUser = projectControls?.myJobsByUser ?? {};
    const allProjects = await getProjects();
    const accessibleProjectIds = new Set(
      getAccessibleProjectsForUser(user, allProjects, { assignedProjectIdsByUser }).map((project) => project.id)
    );
    const requestedProjectIds = Array.from(
      new Set(body.projectIds.filter((projectId) => typeof projectId === "string").map((projectId) => projectId.trim()).filter(Boolean))
    );

    if (requestedProjectIds.some((projectId) => !accessibleProjectIds.has(projectId))) {
      return NextResponse.json({ error: "You can only assign projects you can access." }, { status: 403 });
    }

    const existingProjectIds = assignedProjectIdsByUser[userId] ?? [];
    const preservedProjectIds = existingProjectIds.filter((projectId) => !accessibleProjectIds.has(projectId));
    const assignedProjectIds = Array.from(new Set([...preservedProjectIds, ...requestedProjectIds]));

    result = await replaceMyJobsForUser(userId, assignedProjectIds);

    if (result === null) {
      return NextResponse.json({
        databaseConfigured: false,
        ok: true
      });
    }

    if (!result) {
      return NextResponse.json({ error: "Invalid field assignment payload." }, { status: 400 });
    }

    await recordAuditLog({
      action: "field_user.projects_assigned",
      actor: user,
      metadata: {
        assignedProjectCount: assignedProjectIds.length,
        changedScopeProjectCount: requestedProjectIds.length,
        preservedProjectCount: preservedProjectIds.length
      },
      targetId: userId,
      targetType: "app_user",
      ...getAuditRequestMetadata(request.headers)
    });

    return NextResponse.json({
      assignedProjectIds,
      databaseConfigured: true,
      ok: true
    });
  } else if (body.action === "set_blacklist") {
    const projectId = body.projectId?.trim() ?? "";

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can update the project blacklist." }, { status: 403 });
    }

    if (!projectId || typeof body.blacklisted !== "boolean") {
      return NextResponse.json({ error: "Provide projectId and blacklisted." }, { status: 400 });
    }

    result = await setProjectBlacklist(projectId, body.blacklisted);
  } else if (body.action === "set_archive") {
    const projectId = body.projectId?.trim() ?? "";

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can update the project archive." }, { status: 403 });
    }

    if (!projectId || typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "Provide projectId and archived." }, { status: 400 });
    }

    result = await setProjectArchive(projectId, body.archived);
  } else if (body.action === "add_sync_log") {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can add sync log entries." }, { status: 403 });
    }

    if (!isRecord(body.syncLogEntry)) {
      return NextResponse.json({ error: "Missing sync log entry." }, { status: 400 });
    }

    result = await insertSyncLogEntry(body.syncLogEntry as StoredSyncLogEntry);
  } else {
    return NextResponse.json({ error: "Unsupported project controls action." }, { status: 400 });
  }

  if (result === null) {
    return NextResponse.json({
      databaseConfigured: false,
      ok: true
    });
  }

  if (!result) {
    return NextResponse.json({ error: "Invalid project controls payload." }, { status: 400 });
  }

  if (body.action === "save_my_jobs") {
    await recordAuditLog({
      action: "user.my_jobs_updated",
      actor: user,
      metadata: {
        projectCount: Array.isArray(body.projectIds) ? body.projectIds.length : 0,
        updatedByAdmin: user.id !== body.userId
      },
      targetId: body.userId,
      targetType: "app_user",
      ...getAuditRequestMetadata(request.headers)
    });
  } else if (body.action === "set_blacklist") {
    await recordAuditLog({
      action: body.blacklisted ? "project.blacklisted" : "project.unblacklisted",
      actor: user,
      metadata: {
        blacklisted: body.blacklisted
      },
      targetId: body.projectId,
      targetType: "project",
      ...getAuditRequestMetadata(request.headers)
    });
  } else if (body.action === "set_archive") {
    await recordAuditLog({
      action: body.archived ? "project.archived" : "project.unarchived",
      actor: user,
      metadata: {
        archived: body.archived
      },
      targetId: body.projectId,
      targetType: "project",
      ...getAuditRequestMetadata(request.headers)
    });
  }

  return NextResponse.json({
    databaseConfigured: true,
    ok: true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
