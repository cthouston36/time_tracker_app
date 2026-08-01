import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/features/time-allocation/components/ui";

export type ConfirmationTone = "default" | "warning" | "danger";

export type ConfirmationOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  details?: string[];
  title: string;
  tone?: ConfirmationTone;
};

const confirmationToneConfig = {
  default: {
    className: "confirm-dialog-default",
    confirmVariant: "primary" as const,
    icon: Info
  },
  warning: {
    className: "confirm-dialog-warning",
    confirmVariant: "primary" as const,
    icon: AlertTriangle
  },
  danger: {
    className: "confirm-dialog-danger",
    confirmVariant: "danger" as const,
    icon: ShieldAlert
  }
};

export function useConfirmationDialog() {
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const resolveConfirmationRef = useRef<((confirmed: boolean) => void) | null>(null);

  const closeConfirmation = useCallback((confirmed: boolean) => {
    resolveConfirmationRef.current?.(confirmed);
    resolveConfirmationRef.current = null;
    setConfirmation(null);
  }, []);

  const confirmAction = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        resolveConfirmationRef.current?.(false);
        resolveConfirmationRef.current = resolve;
        setConfirmation(options);
      }),
    []
  );

  const confirmationDialog = useMemo(() => {
    if (!confirmation) {
      return null;
    }

    const tone = confirmation.tone ?? "default";
    const toneConfig = confirmationToneConfig[tone];
    const Icon = toneConfig.icon;

    return (
      <ConfirmDialog
        cancelLabel={confirmation.cancelLabel ?? "Cancel"}
        className={toneConfig.className}
        confirmLabel={confirmation.confirmLabel ?? "Confirm"}
        confirmVariant={toneConfig.confirmVariant}
        title={confirmation.title}
        onCancel={() => closeConfirmation(false)}
        onConfirm={() => closeConfirmation(true)}
      >
        <div className="confirm-dialog-content">
          <span className="confirm-dialog-icon">
            <Icon aria-hidden="true" size={20} />
          </span>
          <div>
            {confirmation.description ? <p>{confirmation.description}</p> : null}
            {confirmation.details?.length ? (
              <ul>
                {confirmation.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </ConfirmDialog>
    );
  }, [closeConfirmation, confirmation]);

  return {
    confirmAction,
    confirmationDialog
  };
}
