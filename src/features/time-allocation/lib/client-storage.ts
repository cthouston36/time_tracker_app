import type { DailyReportAnswers } from "@/features/time-allocation/types";
import { readLocalJson } from "@/features/time-allocation/lib/app-state-storage";
import { normalizeDailyReportDraftAnswers } from "@/features/time-allocation/lib/daily-report-helpers";

const PENDING_PROCORE_RETURN_KEY = "pending-procore-return";
const DAILY_REPORT_DRAFT_STORAGE_PREFIX = "daily-report-draft";
const MOBILE_INSTALL_PROMPT_DISMISSED_KEY = "mobile-install-prompt-dismissed";

export type ViewMode = "dashboard" | "entry" | "calendar" | "reports";

export type PendingProcoreReturn = {
  date?: string;
  intent?: "connect" | "upload_daily";
  mobilePayItemId?: string;
  projectId?: string;
  viewMode?: ViewMode;
};

export type DailyReportAutosaveDraft = {
  date: string;
  draft: DailyReportAnswers;
  projectId: string;
  updatedAt: string;
  userId: string;
};

export function readDailyReportAutosaveDraft(
  userId: string,
  projectId: string,
  date: string
): DailyReportAutosaveDraft | null {
  const value = readLocalJson<Partial<DailyReportAutosaveDraft> | null>(
    getDailyReportDraftStorageKey(userId, projectId, date),
    null
  );

  if (!value || value.userId !== userId || value.projectId !== projectId || value.date !== date || !value.draft) {
    return null;
  }

  return {
    date,
    draft: normalizeDailyReportDraftAnswers(value.draft),
    projectId,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
    userId
  };
}

export function writeDailyReportAutosaveDraft(draft: DailyReportAutosaveDraft) {
  window.localStorage.setItem(getDailyReportDraftStorageKey(draft.userId, draft.projectId, draft.date), JSON.stringify(draft));
}

export function clearDailyReportAutosaveDraft(userId: string, projectId: string, date: string) {
  window.localStorage.removeItem(getDailyReportDraftStorageKey(userId, projectId, date));
}

export function clearAllDailyReportAutosaveDrafts() {
  const keysToClear: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(`${DAILY_REPORT_DRAFT_STORAGE_PREFIX}:`)) {
      keysToClear.push(key);
    }
  }

  for (const key of keysToClear) {
    window.localStorage.removeItem(key);
  }
}

export function getDailyReportDraftStorageKey(userId: string, projectId: string, date: string) {
  return `${DAILY_REPORT_DRAFT_STORAGE_PREFIX}:${userId}:${projectId}:${date}`;
}

export function clearPendingDailyReportAutosaveTimeout(timeoutRef: { current: number | null }) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export function readPendingProcoreReturn(): PendingProcoreReturn | null {
  const value = window.localStorage.getItem(PENDING_PROCORE_RETURN_KEY);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PendingProcoreReturn;

    return {
      date: parsed.date,
      intent: parsed.intent === "upload_daily" ? "upload_daily" : "connect",
      mobilePayItemId: parsed.mobilePayItemId,
      projectId: parsed.projectId,
      viewMode:
        parsed.viewMode === "dashboard" || parsed.viewMode === "calendar" || parsed.viewMode === "reports"
          ? parsed.viewMode
          : "entry"
    };
  } catch {
    clearPendingProcoreReturn();
    return null;
  }
}

export function writePendingProcoreReturn(returnState: PendingProcoreReturn) {
  window.localStorage.setItem(PENDING_PROCORE_RETURN_KEY, JSON.stringify(returnState));
}

export function clearPendingProcoreReturn() {
  window.localStorage.removeItem(PENDING_PROCORE_RETURN_KEY);
}

export function getLastProjectStorageKey(userId: string) {
  return `last-selected-project-${userId}`;
}

export function hasDismissedMobileInstallPrompt() {
  return window.localStorage.getItem(MOBILE_INSTALL_PROMPT_DISMISSED_KEY) === "true";
}

export function dismissMobileInstallPrompt() {
  window.localStorage.setItem(MOBILE_INSTALL_PROMPT_DISMISSED_KEY, "true");
}
