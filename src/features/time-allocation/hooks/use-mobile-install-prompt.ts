import { useCallback, useEffect, useState } from "react";
import {
  dismissMobileInstallPrompt,
  hasDismissedMobileInstallPrompt
} from "@/features/time-allocation/lib/client-storage";

function isInstalledStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function useMobileInstallPrompt(enabled: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setVisible(false);
      return;
    }

    const isMobileWidth = window.matchMedia("(max-width: 820px)").matches;
    setVisible(isMobileWidth && !hasDismissedMobileInstallPrompt() && !isInstalledStandalone());
  }, [enabled]);

  const dismiss = useCallback(() => {
    dismissMobileInstallPrompt();
    setVisible(false);
  }, []);

  return { dismiss, visible };
}
