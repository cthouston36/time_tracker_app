"use client";

import { useEffect, useState } from "react";

export type NetworkStatus = {
  checked: boolean;
  downlink?: number;
  effectiveType?: string;
  online: boolean;
  saveData?: boolean;
};

type NetworkInformationLike = EventTarget & {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
};

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => ({
    checked: false,
    online: true
  }));

  useEffect(() => {
    function refreshNetworkStatus() {
      const connection = getBrowserConnection();

      setNetworkStatus({
        checked: true,
        downlink: connection?.downlink,
        effectiveType: connection?.effectiveType,
        online: navigator.onLine,
        saveData: connection?.saveData
      });
    }

    const connection = getBrowserConnection();

    refreshNetworkStatus();
    window.addEventListener("online", refreshNetworkStatus);
    window.addEventListener("offline", refreshNetworkStatus);
    connection?.addEventListener("change", refreshNetworkStatus);

    return () => {
      window.removeEventListener("online", refreshNetworkStatus);
      window.removeEventListener("offline", refreshNetworkStatus);
      connection?.removeEventListener("change", refreshNetworkStatus);
    };
  }, []);

  return networkStatus;
}

function getBrowserConnection() {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };

  return (
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection ??
    null
  );
}
