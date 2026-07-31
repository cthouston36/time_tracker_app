export function getEntryNoticeClassName(message: string) {
  return entryNoticeIsError(message) ? "inline-alert" : entryNoticeIsProgress(message) ? "status-alert" : "success-alert";
}

function entryNoticeIsProgress(message: string) {
  return ["Deleting", "Removing", "Reopening", "Saving", "Submitting"].some((prefix) => message.startsWith(prefix));
}

function entryNoticeIsError(message: string) {
  return [
    "Add at least",
    "A crew member",
    "Crew member is already",
    "Crew allocated",
    "Enter both",
    "Enter valid",
    "Select an existing",
    "One selected",
    "Remove duplicate",
    "Select at least",
    "Select both",
    "Select two different",
    "This daily report",
    "This day status",
    "This job/day"
  ].some((prefix) => message.startsWith(prefix)) || message.includes(" is already saved to this job.");
}

export function entryNoticeIsCrewRelated(message: string) {
  return (
    message.startsWith("A crew member") ||
    message.startsWith("Crew member is already") ||
    message.startsWith("Enter both crew member") ||
    message.startsWith("Select an existing") ||
    message.includes(" is already saved to this job.") ||
    message.includes(" added to ") ||
    message.includes(" updated across saved days") ||
    message.includes(" merged into ") ||
    message.startsWith("Select both crew members") ||
    message.startsWith("Select two different crew members")
  );
}
