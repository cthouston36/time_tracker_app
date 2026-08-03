import type { CrewMember, CrewMembersByProject } from "@/features/time-allocation/types";
import { readApiJson, type OkResponse } from "@/features/time-allocation/lib/api-utils";

type CrewDataResponse = {
  crewDirectory?: CrewMember[];
  crewMembersByProject?: CrewMembersByProject;
  databaseConfigured?: boolean;
  error?: string;
};

export async function loadDatabaseCrewData() {
  try {
    const response = await fetch("/api/crew", {
      cache: "no-store"
    });
    const data = (await readApiJson(response)) as CrewDataResponse;

    if (!response.ok || !data.databaseConfigured) {
      return null;
    }

    return {
      crewDirectory: data.crewDirectory ?? [],
      crewMembersByProject: data.crewMembersByProject ?? {}
    };
  } catch {
    return null;
  }
}

export async function addDatabaseCrewMemberToProject(projectId: string, crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "add_to_project",
      crewMember,
      projectId
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to save crew member.");
  }
}

export async function updateDatabaseCrewMember(crewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "update_member",
      crewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to update crew member.");
  }
}

export async function removeDatabaseCrewMemberFromProject(projectId: string, crewMemberId: string) {
  const response = await fetch(
    `/api/crew?projectId=${encodeURIComponent(projectId)}&crewMemberId=${encodeURIComponent(crewMemberId)}`,
    {
      method: "DELETE"
    }
  );
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to remove crew member from project.");
  }
}

export async function mergeDatabaseCrewMembers(sourceCrewMemberId: string, targetCrewMember: CrewMember) {
  const response = await fetch("/api/crew", {
    body: JSON.stringify({
      action: "merge",
      sourceCrewMemberId,
      targetCrewMember
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });
  const data = (await readApiJson(response)) as OkResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to merge crew members.");
  }
}
