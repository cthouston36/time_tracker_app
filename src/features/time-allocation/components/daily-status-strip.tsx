export type DailyStatusProcoreState = {
  className: string;
  label: string;
};

export function DailyStatusStrip({
  dailyReportExists,
  dayIsSubmitted,
  draftEntryCount,
  entryCount,
  procoreStatus,
  showEntryStatus,
  uploadedImageCount
}: {
  dailyReportExists: boolean;
  dayIsSubmitted: boolean;
  draftEntryCount: number;
  entryCount: number;
  procoreStatus: DailyStatusProcoreState;
  showEntryStatus: boolean;
  uploadedImageCount: number;
}) {
  return (
    <div className={`daily-status-strip ${showEntryStatus ? "" : "daily-status-strip-compact"}`} aria-label="Daily status">
      {showEntryStatus ? (
        <>
          <DailyStatusItem
            label="Entries"
            tone={dayIsSubmitted ? "success" : entryCount > 0 ? "warning" : draftEntryCount > 0 ? "warning" : "neutral"}
            value={dayIsSubmitted ? "Submitted" : entryCount > 0 ? "Draft" : draftEntryCount > 0 ? "Unsaved" : "Not Started"}
          />
          <DailyStatusItem
            label="Day"
            tone={dayIsSubmitted ? "success" : entryCount > 0 ? "warning" : "neutral"}
            value={dayIsSubmitted ? "Submitted" : entryCount > 0 ? "Draft" : "Not Started"}
          />
        </>
      ) : null}
      <DailyStatusItem
        label="Daily Report"
        tone={dailyReportExists ? "success" : "neutral"}
        value={dailyReportExists ? "Saved" : "Not created"}
      />
      <DailyStatusItem
        label="Procore"
        tone={
          procoreStatus.className === "uploaded"
            ? "success"
            : procoreStatus.className === "failed"
              ? "error"
              : procoreStatus.className === "pending"
                ? "warning"
                : "neutral"
        }
        value={procoreStatus.label}
      />
      <DailyStatusItem
        label="Images"
        tone={uploadedImageCount > 0 ? "success" : "neutral"}
        value={uploadedImageCount > 0 ? `${uploadedImageCount} uploaded` : "None"}
      />
    </div>
  );
}

function DailyStatusItem({
  label,
  tone,
  value
}: {
  label: string;
  tone: "error" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <div className={`daily-status-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
