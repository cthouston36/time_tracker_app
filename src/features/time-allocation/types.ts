import type { AuthUser } from "@/lib/auth/types";
import type { AllocationEntry, CrewLaborType, Project } from "@/lib/domain/types";

export type ProjectSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skippedExisting: number;
  failedProjects: string[];
  autoArchivedProjects?: number;
  autoUnarchivedProjects?: number;
  dailyReportOnlyProjects?: number;
  eligibleProjects?: number;
  inactiveNetSuiteProjects?: number;
  payItemProjects?: number;
  remainingNewProjects?: number;
  skippedMissingProcoreProjectId?: number;
  skippedNoPayItems?: number;
  totalNetSuiteProjects?: number;
};

export type ProjectsResponse = {
  projectArchiveById?: ProjectArchiveById;
  projects: Project[];
  syncedAt?: string | null;
  summary?: ProjectSyncSummary;
  error?: string;
};

export type SyncLogEntry = {
  id: string;
  action: string;
  status: "success" | "warning" | "error";
  createdAt: string;
  message: string;
  summary?: ProjectSyncSummary;
};

export type SharedAppState = {
  crewDirectory: CrewMember[];
  crewMembersByProject: CrewMembersByProject;
  dailyReportUploadsByKey: DailyReportUploadsByKey;
  dailyReportsByKey: DailyReportsByKey;
  dayEntryNotesByKey: DayEntryNotesByKey;
  daySubmissions: DaySubmissionsByKey;
  entries: AllocationEntry[];
  myJobsByUser: MyJobsByUser;
  projectArchiveById: ProjectArchiveById;
  projectBlacklistById: ProjectBlacklistById;
  syncLog: SyncLogEntry[];
};

export type CrewMember = {
  id: string;
  name: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  netSuiteVendorEntityId?: string;
  netSuiteVendorId?: string;
};

export type CrewMembersByProject = Record<string, CrewMember[]>;

export type CrewSummaryRow = {
  crewMemberId: string;
  name: string;
  jobTitle: string;
  laborType?: CrewLaborType;
  subcontractorCompany?: string;
  hours: number;
};

export type PayItemDraft = {
  hours: string;
  quantity: string;
  crewMemberIds: string[];
  crewHours: Record<string, string>;
};

export type DraftsByPayItem = Record<string, PayItemDraft>;

export type DaySubmission = {
  status: "draft" | "submitted";
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAt?: string;
};

export type DaySubmissionsByKey = Record<string, DaySubmission>;

export type DayEntryNotes = {
  inventory: string;
  notes: string;
  updatedAt?: string;
};

export type DayEntryNotesByKey = Record<string, DayEntryNotes>;

export type DailyReportAnswers = {
  employeeRows: DailyReportEmployeeRow[];
  payItemRows: DailyReportPayItemRow[];
  quantitiesTurnedIn: string;
  inspectorName: string;
  inspectorQuantityDetails: string;
  workDescription: string;
  planSheetNumbers: string;
  workDetails: string;
  incidentOccurred: string;
  incidentDetails: string;
  accidentReportFiled: string;
  motSigns: string;
  conesBarrels: string;
  typeIISidewalkBarricades: string;
  typeIIIBarricades: string;
  lcdCount: string;
  lcdFootage: string;
  arrowBoards: string;
  vmsBoards: string;
  fdotIndex: string;
  itsfmRows: DailyReportItsfmRow[];
  itsfmAbovegroundEquipment: string;
  itsfmCabinetEquipment: string;
  twoSeriesEquipmentTools: string;
  twoSeriesSafetyIssues: string;
  twoSeriesDelayReasons: string;
  twoSeriesDeliveries: string;
};

export type DailyReportEmployeeRow = {
  employeeClassification: string;
  truckNumber: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  productionCode1: string;
  productionHours1: string;
  productionCode2: string;
  productionHours2: string;
  totalHours: string;
  driver: boolean;
  passenger: boolean;
};

export type DailyReportTimeField = "timeIn" | "lunchOut" | "lunchIn" | "timeOut";

export type DailyReportPayItemRow = {
  notes: string;
  payItemId: string;
  quantity: string;
};

export type DailyReportItsfmRow = {
  itemKey: string;
  modelNumber: string;
  serialNumber: string;
  location: string;
};

export type DailyReportItsfmItem = {
  group: "Aboveground Equipment" | "Cabinet Equipment";
  key: string;
  label: string;
};

export type DailyReport = DailyReportAnswers & {
  projectId: string;
  date: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyReportsByKey = Record<string, DailyReport>;

export type DailyReportUploadStatus = "failed" | "uploaded";

export type DailyReportUpload = {
  attemptedAt?: string;
  companyId?: string;
  error?: string;
  fileName: string;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  procoreFileId?: string;
  status?: DailyReportUploadStatus;
  uploadedAt?: string;
};

export type DailyReportUploadsByKey = Record<string, DailyReportUpload>;

export type DailyReportProcoreStatus = {
  className: string;
  href?: string;
  label: string;
  message: string;
};

export type JobImageUploadStatus = "failed" | "uploaded";

export type JobImageUpload = {
  attemptedAt?: string;
  caption?: string;
  clientId?: string;
  contentType?: string;
  date: string;
  error?: string;
  fileName: string;
  fileSizeBytes?: number;
  folderId?: string;
  folderPath: string;
  folderUrl?: string;
  id: string;
  originalFileName?: string;
  procoreFileId?: string;
  projectId: string;
  status: JobImageUploadStatus;
  uploadedAt?: string;
  uploadedByName?: string;
  uploadedByUserId?: string;
};

export type JobImageUploadsByDay = Record<string, JobImageUpload[]>;

export type JobImageQueueItem = {
  caption: string;
  error?: string;
  file: File;
  id: string;
  originalName: string;
  previewUrl: string;
  size: number;
  status: "failed" | "queued" | "uploaded" | "uploading";
  uploadedFileName?: string;
};

export type MyJobsByUser = Record<string, string[]>;
export type ProjectBlacklistById = Record<string, true>;
export type ProjectArchiveById = Record<string, true>;
export type VendorBlacklistById = Record<string, true>;

export type NetSuiteVendor = {
  id: string;
  name: string;
  entityId?: string;
  companyName?: string;
  defaultAddress: string;
};

export type ManagedAppUser = AuthUser & {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type NetSuiteProjectManagerOption = {
  id: string;
  name: string;
};

export type CalendarStatusMode = "entry_status" | "daily_reports";
