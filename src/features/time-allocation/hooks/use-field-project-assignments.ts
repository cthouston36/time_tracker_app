import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { canAccessReports } from "@/lib/auth/project-access";
import type { AuthUser } from "@/lib/auth/types";
import {
  loadAssignableFieldUsers,
  saveDatabaseProjectFieldUsers
} from "@/features/time-allocation/lib/api-client";
import type { MyJobsByUser } from "@/features/time-allocation/types";

type Notice = { message: string; status: "success" | "error" } | null;

export function useFieldProjectAssignments({
  currentUser,
  setMyJobsByUser
}: {
  currentUser: AuthUser | null;
  setMyJobsByUser: Dispatch<SetStateAction<MyJobsByUser>>;
}) {
  const [fieldUsers, setFieldUsers] = useState<AuthUser[]>([]);
  const [fieldAssignmentNotice, setFieldAssignmentNotice] = useState<Notice>(null);
  const [savingFieldAssignmentProjectId, setSavingFieldAssignmentProjectId] = useState("");

  useEffect(() => {
    if (!currentUser || !canAccessReports(currentUser)) {
      setFieldUsers([]);
      setFieldAssignmentNotice(null);
      setSavingFieldAssignmentProjectId("");
      return;
    }

    let cancelled = false;

    async function loadFieldUsers() {
      try {
        const users = await loadAssignableFieldUsers();

        if (!cancelled) {
          setFieldUsers(users);
        }
      } catch (error) {
        if (!cancelled) {
          setFieldAssignmentNotice({
            message: error instanceof Error ? error.message : "Unable to load Field users.",
            status: "error"
          });
        }
      }
    }

    void loadFieldUsers();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function saveFieldProjectAssignments(projectId: string, fieldUserIds: string[]) {
    if (!currentUser || !canAccessReports(currentUser)) {
      return;
    }

    setSavingFieldAssignmentProjectId(projectId);
    setFieldAssignmentNotice(null);

    try {
      const assignedFieldUserIds = await saveDatabaseProjectFieldUsers(projectId, fieldUserIds);
      const assignedFieldUserIdSet = new Set(assignedFieldUserIds);

      setMyJobsByUser((current) => ({
        ...fieldUsers.reduce<MyJobsByUser>((next, fieldUser) => {
          const currentProjectIds = next[fieldUser.id] ?? [];
          const nextProjectIds = currentProjectIds.filter((candidateProjectId) => candidateProjectId !== projectId);

          if (assignedFieldUserIdSet.has(fieldUser.id)) {
            nextProjectIds.push(projectId);
          }

          next[fieldUser.id] = Array.from(new Set(nextProjectIds));

          return next;
        }, { ...current })
      }));
      setFieldAssignmentNotice({
        message: "Field project access updated.",
        status: "success"
      });
    } catch (error) {
      setFieldAssignmentNotice({
        message: error instanceof Error ? error.message : "Unable to save Field project access.",
        status: "error"
      });
    } finally {
      setSavingFieldAssignmentProjectId("");
    }
  }

  return {
    fieldAssignmentNotice,
    fieldUsers,
    saveFieldProjectAssignments,
    savingFieldAssignmentProjectId
  };
}
