export type JobImageFileNameInput = {
  contentType: string;
  date: string;
  imageNumber: number;
  originalFileName: string;
  projectName: string;
};

export function buildDailyReportFileName(projectName: string, date: string) {
  return `${date}_${sanitizeFileName(readProjectFilePrefix(projectName))}_Daily_Report.pdf`;
}

export function buildJobImageFileName({
  contentType,
  date,
  imageNumber,
  originalFileName,
  projectName
}: JobImageFileNameInput) {
  const paddedImageNumber = String(Math.max(1, imageNumber)).padStart(3, "0");
  const extension = readImageFileExtension(contentType, originalFileName);

  return `${date}_${sanitizeFileName(readProjectFilePrefix(projectName))}_Job_Image_${paddedImageNumber}.${extension}`;
}

export function readImageFileExtension(contentType: string, originalFileName: string) {
  const normalizedContentType = contentType.trim().toLowerCase();

  if (normalizedContentType === "image/jpeg" || normalizedContentType === "image/jpg") {
    return "jpg";
  }

  if (normalizedContentType === "image/png") {
    return "png";
  }

  if (normalizedContentType === "image/webp") {
    return "webp";
  }

  if (normalizedContentType === "image/heic") {
    return "heic";
  }

  const extension = originalFileName.split(".").pop()?.trim().toLowerCase();

  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "jpg";
}

export function readProjectFilePrefix(projectName: string) {
  return projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";
}

export function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}
