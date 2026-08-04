import { useEffect, useRef } from "react";

type MyProjectsFilterDefaultOptions = {
  appStateHydrated: boolean;
  enabled: boolean;
  myProjectCount: number;
  setShowOnlyMyProjects: (showOnlyMyProjects: boolean) => void;
  showOnlyMyProjects: boolean;
  userId?: string;
};

export function useMyProjectsFilterDefault({
  appStateHydrated,
  enabled,
  myProjectCount,
  setShowOnlyMyProjects,
  showOnlyMyProjects,
  userId
}: MyProjectsFilterDefaultOptions) {
  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (myProjectCount === 0 && showOnlyMyProjects) {
      setShowOnlyMyProjects(false);
    }
  }, [myProjectCount, setShowOnlyMyProjects, showOnlyMyProjects]);

  useEffect(() => {
    if (!enabled || !appStateHydrated) {
      return;
    }

    if (myProjectCount === 0) {
      setShowOnlyMyProjects(false);
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      setShowOnlyMyProjects(true);
    }
  }, [appStateHydrated, enabled, myProjectCount, setShowOnlyMyProjects]);
}
