import {
  AlertTriangle,
  Smartphone,
  WifiOff,
  X,
  type LucideIcon
} from "lucide-react";
import type { NetworkStatus } from "@/features/time-allocation/hooks/use-network-status";

type NetworkNotice = {
  icon: LucideIcon;
  message: string;
  tone: "offline" | "weak";
  title: string;
};

export function MobileInstallPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mobile-install-prompt">
      <Smartphone aria-hidden="true" size={18} />
      <div>
        <strong>Install Chinchor Daily</strong>
        <span>On iPhone/iPad: tap Share, then Add to Home Screen for faster field access.</span>
      </div>
      <button className="icon-button" aria-label="Dismiss install prompt" onClick={onDismiss} type="button">
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

export function NetworkStatusBanner({ status }: { status: NetworkStatus }) {
  const notice = getNetworkNotice(status);

  if (!notice) {
    return null;
  }

  const NoticeIcon = notice.icon;

  return (
    <div className={`network-status-banner ${notice.tone}`}>
      <NoticeIcon aria-hidden="true" size={18} />
      <div>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
    </div>
  );
}

function getNetworkNotice(status: NetworkStatus): NetworkNotice | null {
  if (!status.checked) {
    return null;
  }

  if (!status.online) {
    return {
      icon: WifiOff,
      message: "Reconnect before saving, syncing, or uploading. Unsaved form input should stay on screen until you leave the page.",
      title: "Offline",
      tone: "offline"
    };
  }

  const effectiveType = status.effectiveType?.toLowerCase() ?? "";
  const weakEffectiveType = effectiveType === "slow-2g" || effectiveType === "2g";
  const weakDownlink = typeof status.downlink === "number" && status.downlink > 0 && status.downlink < 0.75;

  if (status.saveData || weakEffectiveType || weakDownlink) {
    return {
      icon: AlertTriangle,
      message: "Connection looks weak. Large Procore uploads may take longer; keep this page open until confirmation appears.",
      title: "Weak signal",
      tone: "weak"
    };
  }

  return null;
}
