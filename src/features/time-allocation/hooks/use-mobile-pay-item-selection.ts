import { useEffect } from "react";
import type { PayItem } from "@/lib/domain/types";

type MobilePayItemSelectionOptions = {
  displayedPayItems: PayItem[];
  mobileSelectedPayItemId: string;
  setMobileSelectedPayItemId: (payItemId: string) => void;
};

export function useMobilePayItemSelection({
  displayedPayItems,
  mobileSelectedPayItemId,
  setMobileSelectedPayItemId
}: MobilePayItemSelectionOptions) {
  useEffect(() => {
    if (!displayedPayItems.length) {
      if (mobileSelectedPayItemId) {
        setMobileSelectedPayItemId("");
      }
      return;
    }

    if (!displayedPayItems.some((payItem) => payItem.id === mobileSelectedPayItemId)) {
      setMobileSelectedPayItemId(displayedPayItems[0].id);
    }
  }, [displayedPayItems, mobileSelectedPayItemId, setMobileSelectedPayItemId]);
}
