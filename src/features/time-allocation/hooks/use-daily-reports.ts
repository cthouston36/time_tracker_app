import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, Project } from "@/lib/domain/types";
import { getDailyReportTemplateForProject } from "@/lib/daily-report-templates";
import { downloadBlob } from "@/features/time-allocation/lib/browser-actions";
import {
  buildFailedDailyReportUploadStatus,
  deleteDatabaseDailyReportUpload,
  downloadDailyReportPdfFile,
  loadDatabaseDailyReportData,
  saveDatabaseDailyReport,
  saveDatabaseDailyReportUpload,
  uploadDailyReportPdfToProcore
} from "@/features/time-allocation/lib/api-client";
import {
  clearAllDailyReportAutosaveDrafts,
  clearDailyReportAutosaveDraft,
  clearPendingDailyReportAutosaveTimeout,
  readDailyReportAutosaveDraft,
  writeDailyReportAutosaveDraft
} from "@/features/time-allocation/lib/client-storage";
import {
  createEmptyDailyReportAnswers,
  dailyReportEmployeeRowHasContent,
  dailyReportPayItemRowHasContent,
  findPreviousDailyReportWithCrewTime,
  formatDailyReportValidationMessage,
  getDailyReportAnswers,
  normalizeDailyReportAnswersForSave,
  validateDailyReportAnswers
} from "@/features/time-allocation/lib/daily-report-helpers";
import {
  applyDailyReportEmployeeRowChange,
  applyDailyReportEmployeeTimeNormalization,
  applyDailyReportFieldChange,
  applyDailyReportItsfmRowChange,
  applyDailyReportPayItemRowChange,
  buildDailyReportWorkRowsFromSavedEntries,
  buildPreviousDailyReportCrewRows
} from "@/features/time-allocation/lib/daily-report-draft-updates";
import { buildDailyReportConflictSignature } from "@/features/time-allocation/lib/conflict-helpers";
import { formatDate, formatStatusDateTime, formatStatusTime, getDayKey, parseDayKey } from "@/features/time-allocation/lib/date-helpers";
import { getDailyReportProcoreStatus } from "@/features/time-allocation/lib/status-helpers";
import { formatUserName } from "@/features/time-allocation/lib/auth-ui-helpers";
import type { ConfirmationOptions } from "@/features/time-allocation/hooks/use-confirmation-dialog";
import type {
  DailyReport,
  DailyReportAnswers,
  DailyReportEmployeeRow,
  DailyReportItsfmRow,
  DailyReportPayItemRow,
  DailyReportsByKey,
  DailyReportTimeField,
  DailyReportUploadsByKey,
  DayEntryNotes,
  DayEntryNotesByKey
} from "@/features/time-allocation/types";

type DailyReportNotice = { message: string; status: "success" | "error" } | null;

type ReplaceDailyReportDataOptions = {
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
};

type ResetDailyReportStateOptions = {
  clearAutosaves?: boolean;
};

type UseDailyReportsOptions = {
  confirmAction: (options: ConfirmationOptions) => Promise<boolean>;
  currentDayEntryNotes: DayEntryNotes;
  currentUser: AuthUser | null;
  dayEntryNotesByKey: DayEntryNotesByKey;
  projects: Project[];
  selectedProject: Project | undefined;
  setEntryNotice: (message: string) => void;
  userIsOffline: boolean;
  visibleEntries: AllocationEntry[];
  workDate: string;
};

export function useDailyReports({
  confirmAction,
  currentDayEntryNotes,
  currentUser,
  dayEntryNotesByKey,
  projects,
  selectedProject,
  setEntryNotice,
  userIsOffline,
  visibleEntries,
  workDate
}: UseDailyReportsOptions) {
  const [dailyReportsByKey, setDailyReportsByKey] = useState<DailyReportsByKey>({});
  const [dailyReportUploadsByKey, setDailyReportUploadsByKey] = useState<DailyReportUploadsByKey>({});
  const [dailyReportDraft, setDailyReportDraft] = useState<DailyReportAnswers>(() => createEmptyDailyReportAnswers());
  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [dailyReportDraftNotice, setDailyReportDraftNotice] = useState("");
  const [downloadingDailyReportPdf, setDownloadingDailyReportPdf] = useState(false);
  const [uploadingDailyReport, setUploadingDailyReport] = useState(false);
  const [retryingDailyReportUploadKey, setRetryingDailyReportUploadKey] = useState("");
  const [dailyReportUploadNotice, setDailyReportUploadNotice] = useState<DailyReportNotice>(null);

  const dailyReportDraftAutosaveTimeoutRef = useRef<number | null>(null);
  const currentDayKey = selectedProject ? getDayKey(selectedProject.id, workDate) : "";
  const currentDailyReport = selectedProject ? dailyReportsByKey[currentDayKey] : undefined;
  const currentDailyReportUpload = selectedProject ? dailyReportUploadsByKey[currentDayKey] : undefined;
  const currentDailyReportProcoreStatus = getDailyReportProcoreStatus(
    currentDailyReport,
    currentDailyReportUpload,
    selectedProject?.id,
    currentUser?.role ?? "standard"
  );
  const dailyReportUploadPending = currentDailyReportUpload?.status === "queued" || currentDailyReportUpload?.status === "processing";
  const dailyReportNeedsUpload = Boolean(
    currentDailyReport && currentDailyReportProcoreStatus.className !== "uploaded" && !dailyReportUploadPending
  );
  const previousDailyReportCrewTime = useMemo(
    () => (selectedProject ? findPreviousDailyReportWithCrewTime(dailyReportsByKey, selectedProject.id, workDate) : null),
    [dailyReportsByKey, selectedProject, workDate]
  );
  const dailyReportUploadRetryQueue = useMemo(
    () =>
      Object.entries(dailyReportUploadsByKey)
        .flatMap(([dayKey, upload]) => {
          if (upload.status !== "failed") {
            return [];
          }

          const dayKeyParts = parseDayKey(dayKey);
          const report = dailyReportsByKey[dayKey];
          const project = dayKeyParts ? projects.find((candidate) => candidate.id === dayKeyParts.projectId) : undefined;

          if (!dayKeyParts || !report || !project) {
            return [];
          }

          return [
            {
              date: dayKeyParts.date,
              dayKey,
              project,
              report,
              upload
            }
          ];
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.project.name.localeCompare(b.project.name)),
    [dailyReportUploadsByKey, dailyReportsByKey, projects]
  );
  const showDailyReportDetails = Boolean(
    currentDailyReport ||
      dailyReportUploadNotice ||
      uploadingDailyReport ||
      downloadingDailyReportPdf ||
      dailyReportUploadRetryQueue.length > 0
  );

  const replaceDailyReportData = useCallback(
    ({ dailyReportUploadsByKey, dailyReportsByKey }: ReplaceDailyReportDataOptions) => {
      setDailyReportsByKey(dailyReportsByKey);
      setDailyReportUploadsByKey(dailyReportUploadsByKey);
    },
    []
  );

  const resetDailyReportState = useCallback(({ clearAutosaves = false }: ResetDailyReportStateOptions = {}) => {
    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);

    if (clearAutosaves) {
      clearAllDailyReportAutosaveDrafts();
    }

    setDailyReportsByKey({});
    setDailyReportUploadsByKey({});
    setDailyReportDraft(createEmptyDailyReportAnswers());
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
    setDailyReportUploadNotice(null);
    setDownloadingDailyReportPdf(false);
    setUploadingDailyReport(false);
    setRetryingDailyReportUploadKey("");
  }, []);

  const clearDailyReportDraftForCurrentContext = useCallback(() => {
    if (selectedProject && currentUser) {
      clearDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    }

    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
  }, [currentUser, selectedProject, workDate]);

  const ensureDailyReportIsCurrent = useCallback(
    async (projectId: string, date: string) => {
      const databaseDailyReportData = await loadDatabaseDailyReportData();

      if (!databaseDailyReportData) {
        return true;
      }

      const dayKey = getDayKey(projectId, date);
      const databaseDailyReport = databaseDailyReportData.dailyReportsByKey[dayKey];
      const currentDailyReportForDay = dailyReportsByKey[dayKey];

      if (
        !databaseDailyReport ||
        buildDailyReportConflictSignature(databaseDailyReport) === buildDailyReportConflictSignature(currentDailyReportForDay)
      ) {
        return true;
      }

      replaceDailyReportData(databaseDailyReportData);
      setDailyReportDraft(getDailyReportAnswers(databaseDailyReport));
      setDailyReportDraftNotice("This daily report was changed by another user. Review the latest saved version before saving again.");
      setEntryNotice("This daily report was changed by another user. Review the latest saved version before saving again.");
      return false;
    },
    [dailyReportsByKey, replaceDailyReportData, setEntryNotice]
  );

  useEffect(() => {
    if (!dailyReportModalOpen || !currentUser || !selectedProject) {
      clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
      return;
    }

    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);

    const draftToSave = dailyReportDraft;
    const projectId = selectedProject.id;
    const date = workDate;
    const userId = currentUser.id;

    function saveDraft(showNotice: boolean) {
      const updatedAt = new Date().toISOString();

      writeDailyReportAutosaveDraft({
        date,
        draft: draftToSave,
        projectId,
        updatedAt,
        userId
      });

      if (showNotice) {
        setDailyReportDraftNotice(`Draft autosaved ${formatStatusTime(updatedAt)}.`);
      }
    }

    function saveDraftBeforeUnload() {
      saveDraft(false);
    }

    dailyReportDraftAutosaveTimeoutRef.current = window.setTimeout(() => {
      saveDraft(true);
      dailyReportDraftAutosaveTimeoutRef.current = null;
    }, 700);
    window.addEventListener("beforeunload", saveDraftBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", saveDraftBeforeUnload);
      clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    };
  }, [currentUser, dailyReportDraft, dailyReportModalOpen, selectedProject, workDate]);

  const openDailyReportModal = useCallback(() => {
    if (!selectedProject || !currentUser) {
      return;
    }

    const autosavedDraft = readDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    const defaultDailyReportAnswers = createEmptyDailyReportAnswers();

    setDailyReportDraft(
      autosavedDraft
        ? autosavedDraft.draft
        : currentDailyReport
        ? getDailyReportAnswers(currentDailyReport)
        : {
            ...defaultDailyReportAnswers,
            workDetails: currentDayEntryNotes.notes,
            itsfmCabinetEquipment: currentDayEntryNotes.inventory
          }
    );
    setDailyReportDraftNotice(
      autosavedDraft
        ? `Restored autosaved draft from ${formatStatusDateTime(autosavedDraft.updatedAt)}.`
        : "Draft autosaves while this form is open."
    );
    setDailyReportModalOpen(true);
  }, [currentDailyReport, currentDayEntryNotes.inventory, currentDayEntryNotes.notes, currentUser, selectedProject, workDate]);

  const closeDailyReportModal = useCallback(async () => {
    if (
      !(await confirmAction({
        cancelLabel: "Continue editing",
        confirmLabel: "Discard edits",
        description: "Close the daily report without saving? Unsaved report edits will be discarded.",
        title: "Discard daily report edits",
        tone: "warning"
      }))
    ) {
      return;
    }

    clearDailyReportDraftForCurrentContext();
  }, [clearDailyReportDraftForCurrentContext, confirmAction]);

  const updateDailyReportDraft = useCallback((field: keyof DailyReportAnswers, value: string) => {
    setDailyReportDraft((current) => applyDailyReportFieldChange(current, field, value));
  }, []);

  const updateDailyReportEmployeeDraft = useCallback(
    (rowIndex: number, field: keyof DailyReportEmployeeRow, value: string | boolean) => {
      setDailyReportDraft((current) => applyDailyReportEmployeeRowChange(current, rowIndex, field, value));
    },
    []
  );

  const normalizeDailyReportEmployeeTimeDraft = useCallback((rowIndex: number, field: DailyReportTimeField) => {
    setDailyReportDraft((current) => applyDailyReportEmployeeTimeNormalization(current, rowIndex, field));
  }, []);

  const updateDailyReportPayItemDraft = useCallback((rowIndex: number, field: keyof DailyReportPayItemRow, value: string) => {
    setDailyReportDraft((current) => applyDailyReportPayItemRowChange(current, rowIndex, field, value));
  }, []);

  const updateDailyReportItsfmDraft = useCallback(
    (itemKey: string, field: keyof Omit<DailyReportItsfmRow, "itemKey">, value: string) => {
      setDailyReportDraft((current) => applyDailyReportItsfmRowChange(current, itemKey, field, value));
    },
    []
  );

  const copyPreviousDailyReportCrewTime = useCallback(async () => {
    if (!previousDailyReportCrewTime) {
      setEntryNotice("No previous crew/time setup found for this job.");
      return;
    }

    const currentHasCrewTime = dailyReportDraft.employeeRows.some(dailyReportEmployeeRowHasContent);
    if (
      currentHasCrewTime &&
      !(await confirmAction({
        cancelLabel: "Keep current rows",
        confirmLabel: "Replace crew/time",
        description: `Replace current crew/time rows with the setup from ${formatDate(previousDailyReportCrewTime.date)}?`,
        title: "Replace crew/time rows",
        tone: "warning"
      }))
    ) {
      return;
    }

    setDailyReportDraft((current) => ({
      ...current,
      employeeRows: buildPreviousDailyReportCrewRows(previousDailyReportCrewTime.report)
    }));
    setEntryNotice(`Copied crew/time from ${formatDate(previousDailyReportCrewTime.date)}.`);
  }, [confirmAction, dailyReportDraft.employeeRows, previousDailyReportCrewTime, setEntryNotice]);

  const copySavedEntriesToDailyReportWorkRows = useCallback(async () => {
    if (!selectedProject || visibleEntries.length === 0) {
      setDailyReportDraftNotice("No saved pay item entries are available for this job/day.");
      return;
    }

    const currentHasWorkRows = dailyReportDraft.payItemRows.some(dailyReportPayItemRowHasContent);

    if (
      currentHasWorkRows &&
      !(await confirmAction({
        cancelLabel: "Keep current rows",
        confirmLabel: "Replace work rows",
        description: "Replace current Work Performed pay item rows with the saved entries for this job/day?",
        title: "Replace Work Performed rows",
        tone: "warning"
      }))
    ) {
      return;
    }

    const savedEntryRows = buildDailyReportWorkRowsFromSavedEntries(selectedProject, visibleEntries);

    setDailyReportDraft((current) => ({
      ...current,
      payItemRows: savedEntryRows.payItemRows
    }));
    setDailyReportDraftNotice(
      savedEntryRows.sourceEntryCount > savedEntryRows.maxRows
        ? "Copied the first 8 saved pay item entries. Add remaining items manually if needed."
        : "Copied saved pay item entries into Work Performed rows."
    );
  }, [confirmAction, dailyReportDraft.payItemRows, selectedProject, visibleEntries]);

  const saveDailyReport = useCallback(async () => {
    if (!selectedProject || !currentUser) {
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      return;
    }

    const dayKey = getDayKey(selectedProject.id, workDate);
    const existingReport = dailyReportsByKey[dayKey];
    const now = new Date().toISOString();
    const normalizedDraft = normalizeDailyReportAnswersForSave(dailyReportDraft);
    const dailyReport: DailyReport = {
      ...(existingReport ?? {
        projectId: selectedProject.id,
        date: workDate,
        createdByUserId: currentUser.id,
        createdByName: formatUserName(currentUser),
        createdAt: now
      }),
      ...normalizedDraft,
      updatedAt: now
    };
    const hadUploadedDailyReport = Boolean(dailyReportUploadsByKey[dayKey]);

    setDailyReportsByKey((current) => ({
      ...current,
      [dayKey]: dailyReport
    }));
    setDailyReportUploadsByKey((current) => {
      if (!current[dayKey]) {
        return current;
      }

      const remainingUploads = { ...current };
      delete remainingUploads[dayKey];

      return remainingUploads;
    });
    void saveDatabaseDailyReport(selectedProject.id, workDate, dailyReport).catch((error) => {
      setEntryNotice(error instanceof Error ? error.message : "Daily report saved locally, but did not sync.");
    });
    if (hadUploadedDailyReport) {
      void deleteDatabaseDailyReportUpload(selectedProject.id, workDate).catch((error) => {
        setEntryNotice(error instanceof Error ? error.message : "Daily upload status cleared locally, but did not sync.");
      });
    }
    clearDailyReportAutosaveDraft(currentUser.id, selectedProject.id, workDate);
    clearPendingDailyReportAutosaveTimeout(dailyReportDraftAutosaveTimeoutRef);
    setDailyReportModalOpen(false);
    setDailyReportDraftNotice("");
    setDailyReportUploadNotice(null);
    setEntryNotice("Daily report saved.");
  }, [
    currentUser,
    dailyReportDraft,
    dailyReportUploadsByKey,
    dailyReportsByKey,
    ensureDailyReportIsCurrent,
    selectedProject,
    setEntryNotice,
    workDate
  ]);

  const downloadDailyReportPdf = useCallback(async () => {
    if (!selectedProject || !currentDailyReport) {
      setDailyReportUploadNotice({
        message: "Create and save a daily report before downloading the PDF.",
        status: "error"
      });
      return;
    }

    if (userIsOffline) {
      setDailyReportUploadNotice({
        message: "You appear to be offline. Reconnect before downloading the daily report PDF.",
        status: "error"
      });
      return;
    }

    const validation = validateDailyReportAnswers(currentDailyReport, selectedProject.payItems, {
      template: getDailyReportTemplateForProject(selectedProject)
    });

    if (validation.errors.length > 0) {
      setDailyReportUploadNotice({
        message: formatDailyReportValidationMessage(validation.errors),
        status: "error"
      });
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      setDailyReportUploadNotice({
        message: "The daily report changed in the database. Review the latest version before downloading.",
        status: "error"
      });
      return;
    }

    setDownloadingDailyReportPdf(true);
    setDailyReportUploadNotice(null);

    try {
      const { blob, fileName } = await downloadDailyReportPdfFile({
        date: workDate,
        dayNotes: currentDayEntryNotes,
        project: selectedProject,
        report: currentDailyReport
      });

      downloadBlob(blob, fileName);
      setDailyReportUploadNotice({
        message: `Downloaded ${fileName}.`,
        status: "success"
      });
    } catch (error) {
      setDailyReportUploadNotice({
        message: error instanceof Error ? error.message : "Unable to download daily report PDF.",
        status: "error"
      });
    } finally {
      setDownloadingDailyReportPdf(false);
    }
  }, [currentDailyReport, currentDayEntryNotes, ensureDailyReportIsCurrent, selectedProject, userIsOffline, workDate]);

  const showDailyReportUploadMessage = useCallback(
    (message: string, status: "error" | "success", showCurrentDayNotice: boolean) => {
      if (showCurrentDayNotice) {
        setDailyReportUploadNotice({
          message,
          status
        });
        return;
      }

      setEntryNotice(message);
    },
    [setEntryNotice]
  );

  const uploadDailyReportForDay = useCallback(
    async ({
      date,
      dayNotes,
      project,
      report,
      showCurrentDayNotice
    }: {
      date: string;
      dayNotes: DayEntryNotes;
      project: Project;
      report: DailyReport;
      showCurrentDayNotice: boolean;
    }) => {
      const dayKey = getDayKey(project.id, date);
      const validation = validateDailyReportAnswers(report, project.payItems, {
        template: getDailyReportTemplateForProject(project)
      });

      if (validation.errors.length > 0) {
        showDailyReportUploadMessage(formatDailyReportValidationMessage(validation.errors), "error", showCurrentDayNotice);
        return;
      }

      try {
        const { data, upload: dailyReportUpload } = await uploadDailyReportPdfToProcore({
          date,
          dayNotes,
          project,
          report
        });

        setDailyReportUploadsByKey((current) => ({
          ...current,
          [dayKey]: dailyReportUpload
        }));
        try {
          await saveDatabaseDailyReportUpload(project.id, date, dailyReportUpload);
        } catch (syncError) {
          showDailyReportUploadMessage(
            syncError instanceof Error ? syncError.message : "Daily uploaded, but upload status did not sync.",
            "error",
            showCurrentDayNotice
          );
          return;
        }
        showDailyReportUploadMessage(
          data.queued
            ? "Daily report upload queued. It will retry automatically if Procore is busy."
            : getDailyReportProcoreStatus(report, dailyReportUpload, project.id, currentUser?.role ?? "standard").message,
          "success",
          showCurrentDayNotice
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload daily report to Procore.";
        const failedDailyReportUpload = buildFailedDailyReportUploadStatus(project, date, message);

        setDailyReportUploadsByKey((current) => ({
          ...current,
          [dayKey]: failedDailyReportUpload
        }));
        try {
          await saveDatabaseDailyReportUpload(project.id, date, failedDailyReportUpload);
        } catch (syncError) {
          showDailyReportUploadMessage(
            syncError instanceof Error ? syncError.message : "Upload failed, but failure status did not sync.",
            "error",
            showCurrentDayNotice
          );
          return;
        }
        showDailyReportUploadMessage(message, "error", showCurrentDayNotice);
      }
    },
    [currentUser?.role, showDailyReportUploadMessage]
  );

  const uploadDailyReportToProcoreDocuments = useCallback(async () => {
    if (!selectedProject || !currentDailyReport) {
      setDailyReportUploadNotice({
        message: "Create and save a daily report before uploading to Procore.",
        status: "error"
      });
      return;
    }

    if (userIsOffline) {
      setDailyReportUploadNotice({
        message: "You appear to be offline. Reconnect before uploading the daily report to Procore.",
        status: "error"
      });
      return;
    }

    const validation = validateDailyReportAnswers(currentDailyReport, selectedProject.payItems, {
      template: getDailyReportTemplateForProject(selectedProject)
    });

    if (validation.errors.length > 0) {
      setDailyReportUploadNotice({
        message: formatDailyReportValidationMessage(validation.errors),
        status: "error"
      });
      return;
    }

    if (!(await ensureDailyReportIsCurrent(selectedProject.id, workDate))) {
      setDailyReportUploadNotice({
        message: "The daily report changed in the database. Review the latest version before uploading to Procore.",
        status: "error"
      });
      return;
    }

    setUploadingDailyReport(true);
    setDailyReportUploadNotice(null);

    try {
      await uploadDailyReportForDay({
        date: workDate,
        dayNotes: currentDayEntryNotes,
        project: selectedProject,
        report: currentDailyReport,
        showCurrentDayNotice: true
      });
    } finally {
      setUploadingDailyReport(false);
    }
  }, [
    currentDailyReport,
    currentDayEntryNotes,
    ensureDailyReportIsCurrent,
    selectedProject,
    uploadDailyReportForDay,
    userIsOffline,
    workDate
  ]);

  const retryDailyReportUpload = useCallback(
    async (dayKey: string) => {
      const dayKeyParts = parseDayKey(dayKey);

      if (!dayKeyParts) {
        return;
      }

      const project = projects.find((candidate) => candidate.id === dayKeyParts.projectId);
      const report = dailyReportsByKey[dayKey];

      if (!project || !report) {
        setEntryNotice("Unable to retry upload because the report or project is no longer available.");
        return;
      }

      if (userIsOffline) {
        setEntryNotice("You appear to be offline. Reconnect before saving, syncing, or uploading.");
        return;
      }

      if (!(await ensureDailyReportIsCurrent(project.id, dayKeyParts.date))) {
        return;
      }

      setRetryingDailyReportUploadKey(dayKey);
      setEntryNotice("");

      try {
        await uploadDailyReportForDay({
          date: dayKeyParts.date,
          dayNotes: dayEntryNotesByKey[dayKey] ?? { inventory: "", notes: "" },
          project,
          report,
          showCurrentDayNotice: selectedProject?.id === project.id && workDate === dayKeyParts.date
        });
      } finally {
        setRetryingDailyReportUploadKey("");
      }
    },
    [
      dailyReportsByKey,
      dayEntryNotesByKey,
      ensureDailyReportIsCurrent,
      projects,
      selectedProject?.id,
      setEntryNotice,
      uploadDailyReportForDay,
      userIsOffline,
      workDate
    ]
  );

  return {
    clearDailyReportDraftForCurrentContext,
    closeDailyReportModal,
    copyPreviousDailyReportCrewTime,
    copySavedEntriesToDailyReportWorkRows,
    currentDailyReport,
    currentDailyReportProcoreStatus,
    dailyReportDraft,
    dailyReportDraftNotice,
    dailyReportModalOpen,
    dailyReportNeedsUpload,
    dailyReportUploadPending,
    dailyReportsByKey,
    dailyReportUploadNotice,
    dailyReportUploadRetryQueue,
    dailyReportUploadsByKey,
    downloadDailyReportPdf,
    downloadingDailyReportPdf,
    normalizeDailyReportEmployeeTimeDraft,
    openDailyReportModal,
    previousDailyReportCrewTime,
    replaceDailyReportData,
    resetDailyReportState,
    retryDailyReportUpload,
    retryingDailyReportUploadKey,
    saveDailyReport,
    setDailyReportUploadNotice,
    showDailyReportDetails,
    updateDailyReportDraft,
    updateDailyReportEmployeeDraft,
    updateDailyReportItsfmDraft,
    updateDailyReportPayItemDraft,
    uploadDailyReportToProcoreDocuments,
    uploadingDailyReport
  };
}
