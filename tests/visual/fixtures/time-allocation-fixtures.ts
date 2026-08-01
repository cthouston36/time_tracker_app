import type { Page, Route } from "@playwright/test";
import type { AuthUser } from "../../../src/lib/auth/types";
import type { AllocationEntry, Project } from "../../../src/lib/domain/types";
import type {
  CrewMember,
  DailyReport,
  DailyReportUpload,
  DaySubmission,
  JobImageUpload,
  SyncLogEntry
} from "../../../src/features/time-allocation/types";

export const VISUAL_TEST_DATE = "2026-07-29";
export const VISUAL_TEST_DATETIME = "2026-07-29T14:30:00.000Z";
export const VISUAL_PROJECT_ID = "visual-project-525";
export const VISUAL_ELECTRICAL_PROJECT_ID = "visual-project-225";
export const VISUAL_DAY_KEY = `${VISUAL_PROJECT_ID}|${VISUAL_TEST_DATE}`;

export const visualUsers: Record<"admin" | "field" | "projectManager", AuthUser> = {
  admin: {
    firstName: "Caleb",
    id: "visual-admin",
    lastName: "Houston",
    netSuiteProjectManagerId: "pm-visual",
    netSuiteProjectManagerName: "Mike Mott",
    role: "admin"
  },
  field: {
    firstName: "Dixie",
    id: "visual-field",
    lastName: "Normus",
    role: "standard"
  },
  projectManager: {
    firstName: "Mike",
    id: "visual-pm",
    lastName: "Mott",
    netSuiteProjectManagerId: "pm-visual",
    netSuiteProjectManagerName: "Mike Mott",
    role: "project_manager"
  }
};

export const visualProjects: Project[] = [
  {
    id: VISUAL_PROJECT_ID,
    name: "525ACC04 Signal Demo Project",
    netSuiteProjectId: "5251",
    netSuiteProjectManagerId: "pm-visual",
    netSuiteProjectManagerName: "Mike Mott",
    payItems: [
      {
        budgetedQuantity: 1,
        code: "101.1",
        id: "pi-101-1",
        name: "MOBILIZATION",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 500,
        code: "630.2.11",
        id: "pi-630-2-11",
        name: "CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 800,
        code: "630.2.12",
        id: "pi-630-2-12",
        name: "CONDUIT, FURNISH & INSTALL, DIRECTIONAL BORE",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 10,
        code: "632.7.1",
        id: "pi-632-7-1",
        name: "SIGNAL CABLE- NEW OR RECONSTRUCTED INTERSECTION, FURNISH & INSTALL",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 20,
        code: "635.2.11",
        id: "pi-635-2-11",
        name: "PULL & SPLICE BOX, F&I, 13 X 24 COVER SIZE",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 12,
        code: "700.1111",
        id: "pi-700-1111",
        name: "SINGLE COLUMN GROUND SIGN ASSEMBLY, F&I GROUND MOUNT, LESS THAN 12 SF",
        unitOfMeasure: ""
      },
      {
        budgetedQuantity: 4,
        code: "715.500.3",
        id: "pi-715-500-3",
        name: "POLE CABLE DISTRIBUTION SYSTEM, FURNISH AND INSTALL",
        unitOfMeasure: ""
      }
    ],
    procoreProjectId: "598134326001001",
    sourceSystem: "netsuite"
  },
  {
    id: VISUAL_ELECTRICAL_PROJECT_ID,
    name: "225WSI04 Electrical Demo Project",
    netSuiteProjectId: "2251",
    netSuiteProjectManagerId: "pm-visual",
    netSuiteProjectManagerName: "Mike Mott",
    payItems: [],
    procoreProjectId: "598134326001002",
    sourceSystem: "netsuite"
  }
];

export const visualCrewMembers: CrewMember[] = [
  {
    id: "crew-barry",
    jobTitle: "Foreman",
    laborType: "chinchor_employee",
    name: "Barry Bonds"
  },
  {
    id: "crew-sub",
    jobTitle: "",
    laborType: "subcontractor",
    name: "Masci General Contractor INC",
    subcontractorCompany: "Masci General Contractor INC"
  },
  {
    id: "crew-spider",
    jobTitle: "Super(hero)",
    laborType: "temp_employee",
    name: "Spiderman"
  }
];

export const visualEntries: AllocationEntry[] = [
  {
    crewAllocations: [
      {
        crewMemberId: "crew-barry",
        crewMemberName: "Barry Bonds",
        hours: 4,
        jobTitle: "Foreman",
        laborType: "chinchor_employee"
      },
      {
        crewMemberId: "crew-sub",
        crewMemberName: "Masci General Contractor INC",
        hours: 9,
        jobTitle: "",
        laborType: "subcontractor",
        subcontractorCompany: "Masci General Contractor INC"
      },
      {
        crewMemberId: "crew-spider",
        crewMemberName: "Spiderman",
        hours: 1,
        jobTitle: "Super(hero)",
        laborType: "temp_employee"
      }
    ],
    date: VISUAL_TEST_DATE,
    hours: 14,
    id: "entry-open-trench",
    payItemBudgetedQuantity: 500,
    payItemCode: "630.2.11",
    payItemId: "pi-630-2-11",
    payItemName: "CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
    projectId: VISUAL_PROJECT_ID,
    projectName: "525ACC04 Signal Demo Project",
    quantityCompleted: 115,
    savedAt: VISUAL_TEST_DATETIME,
    savedByName: "Mike Mott",
    savedByUserId: "visual-pm"
  },
  {
    crewAllocations: [
      {
        crewMemberId: "crew-barry",
        crewMemberName: "Barry Bonds",
        hours: 3,
        jobTitle: "Foreman",
        laborType: "chinchor_employee"
      },
      {
        crewMemberId: "crew-sub",
        crewMemberName: "Masci General Contractor INC",
        hours: 4,
        jobTitle: "",
        laborType: "subcontractor",
        subcontractorCompany: "Masci General Contractor INC"
      },
      {
        crewMemberId: "crew-spider",
        crewMemberName: "Spiderman",
        hours: 6,
        jobTitle: "Super(hero)",
        laborType: "temp_employee"
      }
    ],
    date: VISUAL_TEST_DATE,
    hours: 13,
    id: "entry-bore",
    payItemBudgetedQuantity: 800,
    payItemCode: "630.2.12",
    payItemId: "pi-630-2-12",
    payItemName: "CONDUIT, FURNISH & INSTALL, DIRECTIONAL BORE",
    projectId: VISUAL_PROJECT_ID,
    projectName: "525ACC04 Signal Demo Project",
    quantityCompleted: 200,
    savedAt: VISUAL_TEST_DATETIME,
    savedByName: "Mike Mott",
    savedByUserId: "visual-pm"
  },
  {
    crewAllocations: [
      {
        crewMemberId: "crew-sub",
        crewMemberName: "Masci General Contractor INC",
        hours: 3,
        jobTitle: "",
        laborType: "subcontractor",
        subcontractorCompany: "Masci General Contractor INC"
      }
    ],
    date: VISUAL_TEST_DATE,
    hours: 3,
    id: "entry-pull-box",
    payItemBudgetedQuantity: 20,
    payItemCode: "635.2.11",
    payItemId: "pi-635-2-11",
    payItemName: "PULL & SPLICE BOX, F&I, 13 X 24 COVER SIZE",
    projectId: VISUAL_PROJECT_ID,
    projectName: "525ACC04 Signal Demo Project",
    quantityCompleted: 2,
    savedAt: VISUAL_TEST_DATETIME,
    savedByName: "Mike Mott",
    savedByUserId: "visual-pm"
  }
];

const visualDaySubmission: DaySubmission = {
  status: "submitted",
  submittedAt: VISUAL_TEST_DATETIME,
  submittedByName: "Mike Mott",
  submittedByUserId: "visual-pm"
};

const visualDailyReport: DailyReport = {
  accidentReportFiled: "",
  arrowBoards: "1",
  conesBarrels: "2",
  createdAt: VISUAL_TEST_DATETIME,
  createdByName: "Mike Mott",
  createdByUserId: "visual-pm",
  date: VISUAL_TEST_DATE,
  employeeRows: [
    {
      driver: true,
      employeeClassification: "Barry Bonds",
      lunchIn: "12:30",
      lunchOut: "12:00",
      passenger: false,
      productionCode1: "G",
      productionCode2: "I",
      productionHours1: "5.00",
      productionHours2: "4.50",
      timeIn: "7:00",
      timeOut: "17:00",
      totalHours: "9.50",
      truckNumber: "1234"
    },
    {
      driver: false,
      employeeClassification: "Spiderman",
      lunchIn: "12:30",
      lunchOut: "12:00",
      passenger: true,
      productionCode1: "S",
      productionCode2: "",
      productionHours1: "8.50",
      productionHours2: "",
      timeIn: "7:00",
      timeOut: "16:00",
      totalHours: "8.50",
      truckNumber: "1345"
    }
  ],
  fdotIndex: "102-600",
  incidentDetails: "",
  incidentOccurred: "no",
  inspectorName: "Inspector Demo",
  inspectorQuantityDetails: "Turned in conduit and pull box quantities.",
  itsfmAbovegroundEquipment: "",
  itsfmCabinetEquipment: "",
  itsfmRows: [],
  lcdCount: "9",
  lcdFootage: "27",
  motSigns: "4",
  payItemRows: [
    {
      notes: "Open trench conduit installed along the east shoulder.",
      payItemId: "pi-630-2-11",
      quantity: "115"
    },
    {
      notes: "Directional bore completed at crossing.",
      payItemId: "pi-630-2-12",
      quantity: "200"
    }
  ],
  planSheetNumbers: "IT-2 through IT-4",
  projectId: VISUAL_PROJECT_ID,
  quantitiesTurnedIn: "yes",
  typeIIIBarricades: "0",
  typeIISidewalkBarricades: "0",
  twoSeriesDelayReasons: "",
  twoSeriesDeliveries: "",
  twoSeriesEquipmentTools: "",
  twoSeriesSafetyIssues: "",
  updatedAt: VISUAL_TEST_DATETIME,
  vmsBoards: "0",
  workDescription: "Installed conduit and pull boxes. Quantity notes reference the pay item rows.",
  workDetails: "Traffic control remained in place throughout the shift."
};

const visualDailyReportUpload: DailyReportUpload = {
  attemptedAt: VISUAL_TEST_DATETIME,
  companyId: "598134325538800",
  fileName: "2026-07-29_525ACC04_Daily_Report.pdf",
  folderId: "598134547659423",
  folderPath: "Daily Reports",
  folderUrl:
    "https://us02.procore.com/webclients/host/companies/598134325538800/projects/598134326001001/tools/documents?folder_id=598134547659423",
  procoreFileId: "visual-file-1",
  status: "uploaded",
  uploadedAt: VISUAL_TEST_DATETIME
};

const visualImageUploads: JobImageUpload[] = [
  {
    caption: "Conduit trench before backfill.",
    contentType: "image/jpeg",
    date: VISUAL_TEST_DATE,
    fileName: "2026-07-29_525ACC04_Job_Image_001.jpg",
    fileSizeBytes: 650_000,
    folderId: "visual-image-folder",
    folderPath: "Daily Reports / Job Images",
    folderUrl:
      "https://us02.procore.com/webclients/host/companies/598134325538800/projects/598134326001001/tools/documents?folder_id=visual-image-folder",
    id: "visual-image-1",
    originalFileName: "IMG_1001.jpeg",
    procoreFileId: "visual-image-file-1",
    projectId: VISUAL_PROJECT_ID,
    status: "uploaded",
    uploadedAt: VISUAL_TEST_DATETIME,
    uploadedByName: "Mike Mott",
    uploadedByUserId: "visual-pm"
  }
];

const visualSyncLog: SyncLogEntry[] = [
  {
    action: "Nightly NetSuite Sync",
    createdAt: VISUAL_TEST_DATETIME,
    id: "sync-nightly",
    message: "Nightly NetSuite sync: projects 2 synced, 0 failed, 0 archived inactive.",
    status: "success",
    summary: {
      attempted: 2,
      failed: 0,
      failedProjects: [],
      skippedExisting: 0,
      synced: 2
    }
  }
];

export async function mockTimeAllocationApis(page: Page, user: AuthUser = visualUsers.admin) {
  await page.addInitScript(
    ({ fixedDate, projectId, userId }) => {
      const fixedTime = Date.parse(`${fixedDate}T12:00:00-04:00`);
      const RealDate = Date;

      function MockDate(this: Date, ...args: unknown[]) {
        if (this instanceof MockDate) {
          if (args.length === 0) {
            return new RealDate(fixedTime);
          }

          if (args.length === 1) {
            return new RealDate(args[0] as string | number | Date);
          }

          return new RealDate(
            args[0] as number,
            args[1] as number,
            args[2] as number | undefined,
            args[3] as number | undefined,
            args[4] as number | undefined,
            args[5] as number | undefined,
            args[6] as number | undefined
          );
        }

        return RealDate();
      }

      Object.setPrototypeOf(MockDate, RealDate);
      MockDate.prototype = RealDate.prototype;
      Object.defineProperty(MockDate.prototype, "constructor", {
        value: MockDate,
        writable: true
      });
      Object.assign(MockDate, {
        now: () => fixedTime,
        parse: RealDate.parse,
        UTC: RealDate.UTC
      });
      window.Date = MockDate as unknown as DateConstructor;
      window.localStorage.setItem("mobile-install-prompt-dismissed", "true");
      window.localStorage.setItem(`last-selected-project-${userId}`, projectId);
    },
    {
      fixedDate: VISUAL_TEST_DATE,
      projectId: VISUAL_PROJECT_ID,
      userId: user.id
    }
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === "/api/auth/me") {
      return fulfillJson(route, { user });
    }

    if (pathname === "/api/procore/status") {
      return fulfillJson(route, {
        connected: true,
        connectedAt: VISUAL_TEST_DATETIME,
        connectedBy: "Caleb Houston"
      });
    }

    if (pathname === "/api/project-catalog/projects") {
      return fulfillJson(route, {
        projects: visualProjects,
        syncedAt: VISUAL_TEST_DATETIME
      });
    }

    if (pathname === "/api/entries") {
      return fulfillJson(route, {
        databaseConfigured: true,
        entries: visualEntries,
        ok: true
      });
    }

    if (pathname === "/api/crew") {
      return fulfillJson(route, {
        crewDirectory: visualCrewMembers,
        crewMembersByProject: {
          [VISUAL_PROJECT_ID]: visualCrewMembers,
          [VISUAL_ELECTRICAL_PROJECT_ID]: visualCrewMembers.slice(0, 2)
        },
        databaseConfigured: true,
        ok: true
      });
    }

    if (pathname === "/api/daily-reports") {
      return fulfillJson(route, {
        dailyReportUploadsByKey: {
          [VISUAL_DAY_KEY]: visualDailyReportUpload
        },
        dailyReportsByKey: {
          [VISUAL_DAY_KEY]: visualDailyReport
        },
        databaseConfigured: true,
        ok: true
      });
    }

    if (pathname === "/api/day-records") {
      return fulfillJson(route, {
        databaseConfigured: true,
        dayEntryNotesByKey: {},
        daySubmissions: {
          [VISUAL_DAY_KEY]: visualDaySubmission
        },
        ok: true
      });
    }

    if (pathname === "/api/job-images") {
      return fulfillJson(route, {
        databaseConfigured: true,
        ok: true,
        uploads: visualImageUploads
      });
    }

    if (pathname === "/api/project-controls") {
      return fulfillJson(route, {
        databaseConfigured: true,
        myJobsByUser: {
          [visualUsers.admin.id]: [VISUAL_PROJECT_ID, VISUAL_ELECTRICAL_PROJECT_ID],
          [visualUsers.field.id]: [VISUAL_PROJECT_ID],
          [visualUsers.projectManager.id]: [VISUAL_PROJECT_ID, VISUAL_ELECTRICAL_PROJECT_ID]
        },
        ok: true,
        projectArchiveById: {},
        projectBlacklistById: {},
        syncLog: visualSyncLog
      });
    }

    if (pathname === "/api/netsuite/vendors") {
      return fulfillJson(route, {
        allVendors: [
          {
            defaultAddress: "100 Main St",
            entityId: "V100",
            id: "vendor-100",
            name: "Masci General Contractor INC"
          }
        ],
        databaseConfigured: true,
        ok: true,
        syncedAt: VISUAL_TEST_DATETIME,
        vendorBlacklistById: {},
        vendors: [
          {
            defaultAddress: "100 Main St",
            entityId: "V100",
            id: "vendor-100",
            name: "Masci General Contractor INC"
          }
        ]
      });
    }

    if (pathname === "/api/field-users") {
      return fulfillJson(route, {
        databaseConfigured: true,
        users: [visualUsers.field]
      });
    }

    if (pathname === "/api/admin/users") {
      return fulfillJson(route, {
        databaseConfigured: true,
        users: [
          {
            ...visualUsers.admin,
            active: true
          },
          {
            ...visualUsers.projectManager,
            active: true
          },
          {
            ...visualUsers.field,
            active: true
          }
        ]
      });
    }

    if (pathname === "/api/admin/failed-uploads") {
      return fulfillJson(route, {
        dailyReports: [],
        databaseConfigured: true,
        jobImages: []
      });
    }

    if (pathname === "/api/admin/audit-log") {
      return fulfillJson(route, {
        auditLog: [
          {
            action: "daily_report.saved",
            actorName: "Mike Mott",
            actorRole: "project_manager",
            actorUserId: "visual-pm",
            createdAt: VISUAL_TEST_DATETIME,
            id: "audit-1",
            metadata: {
              projectName: "525ACC04 Signal Demo Project"
            },
            targetId: VISUAL_DAY_KEY,
            targetType: "project_day"
          }
        ],
        databaseConfigured: true
      });
    }

    if (pathname === "/api/reports" && method === "POST") {
      const requestBody = request.postDataJSON() as { mode?: string } | undefined;

      return fulfillJson(route, buildReportResponse(requestBody?.mode ?? "summary"));
    }

    if (pathname === "/api/reports/export" && method === "POST") {
      return route.fulfill({
        body: "pay_item,entries,hours,quantity\n630.2.11,1,14,115\n",
        contentType: "text/csv",
        status: 200
      });
    }

    return fulfillJson(route, {
      databaseConfigured: true,
      ok: true
    });
  });
}

function buildReportResponse(mode: string) {
  if (mode === "crew") {
    return {
      databaseConfigured: true,
      filteredEntryCount: visualEntries.length,
      mode,
      page: 1,
      pageSize: 25,
      rows: [
        {
          crewMemberName: "Barry Bonds",
          entryCount: 2,
          excludedEntryCount: 0,
          id: "crew-barry",
          jobCount: 1,
          jobTitle: "Foreman",
          laborType: "chinchor_employee",
          payItemCount: 2,
          payItems: [],
          sampleSize: 2,
          status: "average",
          totalHours: 7,
          totalQuantity: 157.5,
          weightedVariance: 0.02
        }
      ],
      totalRows: 1
    };
  }

  if (mode === "daily_work") {
    return {
      databaseConfigured: true,
      filteredEntryCount: 1,
      mode,
      page: 1,
      pageSize: 50,
      rows: [
        {
          dailyReportCount: 1,
          detailRows: [
            {
              date: VISUAL_TEST_DATE,
              id: "daily-work-detail-1",
              notes: "Open trench conduit installed along the east shoulder.",
              quantity: 115
            }
          ],
          firstDate: VISUAL_TEST_DATE,
          id: "daily-work-1",
          lastDate: VISUAL_TEST_DATE,
          payItemCode: "630.2.11",
          payItemName: "CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
          projectId: VISUAL_PROJECT_ID,
          projectName: "525ACC04 Signal Demo Project",
          rowCount: 1,
          totalQuantity: 115
        }
      ],
      totalRows: 1
    };
  }

  if (mode === "employee_hours") {
    return {
      databaseConfigured: true,
      filteredEntryCount: 1,
      mode,
      page: 1,
      pageSize: 50,
      rows: [
        {
          daysWorked: 1,
          detailRows: [
            {
              date: VISUAL_TEST_DATE,
              employeeName: "Barry Bonds",
              hours: 9.5,
              id: "employee-hours-detail-1",
              jobName: "525ACC04 Signal Demo Project",
              projectId: VISUAL_PROJECT_ID,
              truckNumber: "1234"
            }
          ],
          employeeCount: 1,
          employeeName: "Barry Bonds",
          id: "employee-hours-1",
          jobCount: 1,
          totalHours: 9.5
        }
      ],
      totalRows: 1
    };
  }

  return {
    databaseConfigured: true,
    filteredEntryCount: visualEntries.length,
    mode: "summary",
    page: 1,
    pageSize: 25,
    payItemOptions: [
      {
        key: "630.2.11|CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
        label: "630.2.11 - CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
        query: "630.2.11"
      }
    ],
    rows: [
      {
        code: "630.2.11",
        entryCount: 1,
        excludedEntryCount: 0,
        hoursPerUnit: 0.122,
        jobRollupRows: [
          {
            entryCount: 1,
            excludedEntryCount: 0,
            hours: 14,
            hoursPerUnit: 0.122,
            id: VISUAL_PROJECT_ID,
            projectName: "525ACC04 Signal Demo Project",
            quantityCompleted: 115,
            sampleSize: 1
          }
        ],
        key: "630.2.11|CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
        name: "CONDUIT, FURNISH & INSTALL, OPEN TRENCH",
        sampleSize: 1,
        totalHours: 14,
        totalQuantity: 115
      },
      {
        code: "630.2.12",
        entryCount: 1,
        excludedEntryCount: 0,
        hoursPerUnit: 0.065,
        jobRollupRows: [
          {
            entryCount: 1,
            excludedEntryCount: 0,
            hours: 13,
            hoursPerUnit: 0.065,
            id: VISUAL_PROJECT_ID,
            projectName: "525ACC04 Signal Demo Project",
            quantityCompleted: 200,
            sampleSize: 1
          }
        ],
        key: "630.2.12|CONDUIT, FURNISH & INSTALL, DIRECTIONAL BORE",
        name: "CONDUIT, FURNISH & INSTALL, DIRECTIONAL BORE",
        sampleSize: 1,
        totalHours: 13,
        totalQuantity: 200
      }
    ],
    totalRows: 2
  };
}

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status: 200
  });
}
