import type { AuthUser } from "@/lib/auth/types";
import type {
  JobImageUpload,
  ManagedAppUser
} from "@/features/time-allocation/types";

export type DailyReportUploadResponse = {
  companyId?: string;
  error?: string;
  fileName?: string;
  folderId?: string;
  folderPath?: string;
  folderUrl?: string;
  procoreFileId?: string;
  procoreUpload?: {
    createFilePath?: string;
    createFilePayload?: string;
    createUploadPath?: string;
  };
};

export type JobImageUploadResponse = {
  databaseConfigured?: boolean;
  error?: string;
  failedCount?: number;
  folderId?: string;
  folderPath?: string;
  folderUrl?: string;
  ok?: boolean;
  uploadedCount?: number;
  uploadedImageCount?: number;
  uploadedImageLimit?: number;
  uploads?: JobImageUpload[];
};

export type AdminUsersResponse = {
  databaseConfigured?: boolean;
  error?: string;
  users?: ManagedAppUser[];
};

export type AuthResponse = {
  error?: string;
  user: AuthUser | null;
};

export type ChangePasswordResponse = {
  error?: string;
  ok?: boolean;
};

export type ProcoreStatusResponse = {
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
};
