import { useEffect } from "react";
import type { AuthUser } from "@/lib/auth/types";
import { loadCurrentUserSession } from "@/features/time-allocation/lib/api-client";

type CurrentUserSessionBootstrapOptions = {
  onAuthCheckedChange: (checked: boolean) => void;
  onCurrentUserChange: (user: AuthUser | null) => void;
};

export function useCurrentUserSessionBootstrap({
  onAuthCheckedChange,
  onCurrentUserChange
}: CurrentUserSessionBootstrapOptions) {
  useEffect(() => {
    async function loadCurrentUser() {
      const data = await loadCurrentUserSession();

      onCurrentUserChange(data.user);
      onAuthCheckedChange(true);
    }

    void loadCurrentUser();
  }, [onAuthCheckedChange, onCurrentUserChange]);
}
