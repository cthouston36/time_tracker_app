import { getSql } from "@/lib/db";
import {
  rebuildDailyReportRollups,
  rebuildEntryReportRollups,
  rebuildPmSummaryRollups
} from "@/lib/report-rollups";
import {
  countResolvedFailedJobImageUploads,
  deleteResolvedFailedJobImageUploads
} from "@/lib/job-image-store";
import {
  purgeTaskQueueRecords,
  readTaskQueueMaintenanceStats,
  type TaskQueueMaintenanceStats,
  type TaskQueuePurgeResult
} from "@/lib/task-queue";

export type DataMaintenanceIssue = {
  count: number;
  detail: string;
  id: string;
  samples: string[];
  severity: "error" | "info" | "warning";
  title: string;
};

export type DataMaintenanceSummary = {
  cleanupCandidates: {
    resolvedFailedImageUploads: number;
    taskQueue: TaskQueueMaintenanceStats["cleanupCandidates"];
  };
  databaseConfigured: boolean;
  generatedAt: string;
  orphanIssues: DataMaintenanceIssue[];
  rollups: {
    crewPerformance: number;
    dailyWork: number;
    payItemProject: number;
    pmSummary: number;
  };
  taskQueue: TaskQueueMaintenanceStats;
};

export type DataMaintenanceCleanupResult = {
  resolvedFailedImageUploads: number;
  taskQueue: TaskQueuePurgeResult;
};

const RESOLVED_IMAGE_UPLOAD_RETENTION_DAYS = 30;
const COMPLETED_TASK_RETENTION_DAYS = 45;
const FAILED_TASK_RETENTION_DAYS = 90;

export async function readDataMaintenanceSummary(): Promise<DataMaintenanceSummary | null> {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const [rollups, taskQueue, resolvedFailedImageUploads, orphanIssues] = await Promise.all([
    readRollupCounts(),
    readTaskQueueMaintenanceStats({
      completedRetentionDays: COMPLETED_TASK_RETENTION_DAYS,
      failedRetentionDays: FAILED_TASK_RETENTION_DAYS
    }),
    countResolvedFailedJobImageUploads(RESOLVED_IMAGE_UPLOAD_RETENTION_DAYS),
    readOrphanIssues()
  ]);

  if (!taskQueue || resolvedFailedImageUploads === null) {
    return null;
  }

  return {
    cleanupCandidates: {
      resolvedFailedImageUploads,
      taskQueue: taskQueue.cleanupCandidates
    },
    databaseConfigured: true,
    generatedAt: new Date().toISOString(),
    orphanIssues,
    rollups,
    taskQueue
  };
}

export async function rebuildDataMaintenanceRollups() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await rebuildEntryReportRollups();
  await rebuildDailyReportRollups();
  await rebuildPmSummaryRollups();

  return readRollupCounts();
}

export async function cleanupDataMaintenanceRecords(): Promise<DataMaintenanceCleanupResult | null> {
  const [taskQueue, resolvedFailedImageUploads] = await Promise.all([
    purgeTaskQueueRecords({
      completedRetentionDays: COMPLETED_TASK_RETENTION_DAYS,
      failedRetentionDays: FAILED_TASK_RETENTION_DAYS
    }),
    deleteResolvedFailedJobImageUploads(RESOLVED_IMAGE_UPLOAD_RETENTION_DAYS)
  ]);

  if (!taskQueue || resolvedFailedImageUploads === null) {
    return null;
  }

  return {
    resolvedFailedImageUploads,
    taskQueue
  };
}

async function readRollupCounts() {
  return {
    crewPerformance: await countTableRows("crew_performance_rollups"),
    dailyWork: await countTableRows("daily_work_rollups"),
    payItemProject: await countTableRows("pay_item_project_rollups"),
    pmSummary: await countTableRows("pm_summary_rollups")
  };
}

async function readOrphanIssues() {
  const issues: DataMaintenanceIssue[] = [];

  await addDailyEntryMissingProjectIssue(issues);
  await addDailyEntryMissingPayItemIssue(issues);
  await addDailyReportMissingProjectIssue(issues);
  await addDailyReportUploadMissingProjectIssue(issues);
  await addJobImageMissingProjectIssue(issues);
  await addProjectCrewMissingProjectIssue(issues);
  await addProjectCrewMissingCrewMemberIssue(issues);
  await addEntryCrewMissingEntryIssue(issues);
  await addEntryCrewMissingCrewMemberIssue(issues);
  await addMyJobsMissingProjectIssue(issues);
  await addMyJobsMissingUserIssue(issues);
  await addArchiveMissingProjectIssue(issues);
  await addBlacklistMissingProjectIssue(issues);

  return issues;
}

async function addDailyEntryMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_entries", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_entries entry
    left join project_catalog project on project.id = entry.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select entry.project_id as sample
    from daily_entries entry
    left join project_catalog project on project.id = entry.project_id
    where project.id is null
    group by entry.project_id
    order by entry.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Saved pay item entries point to projects that are no longer in the project catalog.",
    id: "daily-entries-missing-project",
    samples,
    severity: "warning",
    title: "Daily entries missing projects"
  });
}

async function addDailyEntryMissingPayItemIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_entries", "project_pay_items"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_entries entry
    left join project_pay_items pay_item
      on pay_item.project_id = entry.project_id
      and (pay_item.id = entry.pay_item_id or lower(pay_item.code) = lower(entry.pay_item_code))
    where pay_item.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(entry.project_id, ': ', entry.pay_item_code) as sample
    from daily_entries entry
    left join project_pay_items pay_item
      on pay_item.project_id = entry.project_id
      and (pay_item.id = entry.pay_item_id or lower(pay_item.code) = lower(entry.pay_item_code))
    where pay_item.id is null
    group by entry.project_id, entry.pay_item_code
    order by entry.project_id, entry.pay_item_code
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Saved pay item entries use codes that are not currently in the project catalog.",
    id: "daily-entries-missing-pay-items",
    samples,
    severity: "warning",
    title: "Daily entries missing pay items"
  });
}

async function addDailyReportMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_reports", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_reports report
    left join project_catalog project on project.id = report.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(report.project_id, '|', to_char(report.work_date, 'YYYY-MM-DD')) as sample
    from daily_reports report
    left join project_catalog project on project.id = report.project_id
    where project.id is null
    order by report.work_date desc, report.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Saved daily reports point to projects that are no longer in the project catalog.",
    id: "daily-reports-missing-project",
    samples,
    severity: "warning",
    title: "Daily reports missing projects"
  });
}

async function addDailyReportUploadMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_report_uploads", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_report_uploads upload
    left join project_catalog project on project.id = upload.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(upload.project_id, '|', to_char(upload.work_date, 'YYYY-MM-DD')) as sample
    from daily_report_uploads upload
    left join project_catalog project on project.id = upload.project_id
    where project.id is null
    order by upload.work_date desc, upload.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Daily report upload records point to projects that are no longer in the project catalog.",
    id: "daily-report-uploads-missing-project",
    samples,
    severity: "warning",
    title: "Daily upload records missing projects"
  });
}

async function addJobImageMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["job_image_uploads", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from job_image_uploads upload
    left join project_catalog project on project.id = upload.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(upload.project_id, '|', to_char(upload.work_date, 'YYYY-MM-DD')) as sample
    from job_image_uploads upload
    left join project_catalog project on project.id = upload.project_id
    where project.id is null
    group by upload.project_id, upload.work_date
    order by upload.work_date desc, upload.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Image upload records point to projects that are no longer in the project catalog.",
    id: "job-images-missing-project",
    samples,
    severity: "warning",
    title: "Image records missing projects"
  });
}

async function addProjectCrewMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["project_crew_members", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from project_crew_members assignment
    left join project_catalog project on project.id = assignment.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select assignment.project_id as sample
    from project_crew_members assignment
    left join project_catalog project on project.id = assignment.project_id
    where project.id is null
    group by assignment.project_id
    order by assignment.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Project crew assignments point to projects that are no longer in the project catalog.",
    id: "project-crew-missing-project",
    samples,
    severity: "warning",
    title: "Crew assignments missing projects"
  });
}

async function addProjectCrewMissingCrewMemberIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["project_crew_members", "crew_members"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from project_crew_members assignment
    left join crew_members member on member.id = assignment.crew_member_id
    where member.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(assignment.project_id, ': ', assignment.crew_member_id) as sample
    from project_crew_members assignment
    left join crew_members member on member.id = assignment.crew_member_id
    where member.id is null
    group by assignment.project_id, assignment.crew_member_id
    order by assignment.project_id, assignment.crew_member_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Project crew assignments point to crew records that no longer exist.",
    id: "project-crew-missing-member",
    samples,
    severity: "warning",
    title: "Crew assignments missing crew members"
  });
}

async function addEntryCrewMissingEntryIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_entry_crew_allocations", "daily_entries"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_entry_crew_allocations allocation
    left join daily_entries entry on entry.id = allocation.entry_id
    where entry.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select allocation.entry_id as sample
    from daily_entry_crew_allocations allocation
    left join daily_entries entry on entry.id = allocation.entry_id
    where entry.id is null
    group by allocation.entry_id
    order by allocation.entry_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Crew allocation rows point to daily entries that no longer exist.",
    id: "entry-crew-missing-entry",
    samples,
    severity: "error",
    title: "Crew allocations missing entries"
  });
}

async function addEntryCrewMissingCrewMemberIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["daily_entry_crew_allocations", "crew_members"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from daily_entry_crew_allocations allocation
    left join crew_members member on member.id = allocation.crew_member_id
    where member.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(allocation.crew_member_name, ' (', allocation.crew_member_id, ')') as sample
    from daily_entry_crew_allocations allocation
    left join crew_members member on member.id = allocation.crew_member_id
    where member.id is null
    group by allocation.crew_member_name, allocation.crew_member_id
    order by allocation.crew_member_name, allocation.crew_member_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Saved crew allocation history references crew members that are no longer in the crew directory.",
    id: "entry-crew-missing-member",
    samples,
    severity: "warning",
    title: "Entry allocations missing crew members"
  });
}

async function addMyJobsMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["my_jobs", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from my_jobs job
    left join project_catalog project on project.id = job.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(job.user_id, ': ', job.project_id) as sample
    from my_jobs job
    left join project_catalog project on project.id = job.project_id
    where project.id is null
    group by job.user_id, job.project_id
    order by job.user_id, job.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "My Projects or Field assignments point to projects that are no longer in the project catalog.",
    id: "my-jobs-missing-project",
    samples,
    severity: "warning",
    title: "Assigned projects missing catalog records"
  });
}

async function addMyJobsMissingUserIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["my_jobs", "app_users"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from my_jobs job
    left join app_users app_user on app_user.user_id = job.user_id
    where app_user.user_id is null
  `);
  const samples = await sampleFromQuery(sql`
    select concat(job.user_id, ': ', job.project_id) as sample
    from my_jobs job
    left join app_users app_user on app_user.user_id = job.user_id
    where app_user.user_id is null
    group by job.user_id, job.project_id
    order by job.user_id, job.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Project assignments point to user accounts that no longer exist.",
    id: "my-jobs-missing-user",
    samples,
    severity: "warning",
    title: "Project assignments missing users"
  });
}

async function addArchiveMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["project_archive", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from project_archive archive
    left join project_catalog project on project.id = archive.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select archive.project_id as sample
    from project_archive archive
    left join project_catalog project on project.id = archive.project_id
    where project.id is null
    order by archive.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Archived project flags point to projects that are no longer in the project catalog.",
    id: "archive-missing-project",
    samples,
    severity: "info",
    title: "Archive flags missing projects"
  });
}

async function addBlacklistMissingProjectIssue(issues: DataMaintenanceIssue[]) {
  if (!(await requiredTablesExist(["project_blacklist", "project_catalog"]))) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  const count = await countFromQuery(sql`
    select count(*)::int as count
    from project_blacklist blacklist
    left join project_catalog project on project.id = blacklist.project_id
    where project.id is null
  `);
  const samples = await sampleFromQuery(sql`
    select blacklist.project_id as sample
    from project_blacklist blacklist
    left join project_catalog project on project.id = blacklist.project_id
    where project.id is null
    order by blacklist.project_id
    limit 5
  `);

  addIssue(issues, {
    count,
    detail: "Blacklisted project flags point to projects that are no longer in the project catalog.",
    id: "blacklist-missing-project",
    samples,
    severity: "info",
    title: "Blacklist flags missing projects"
  });
}

async function countTableRows(tableName: RollupTableName) {
  const sql = getSql();

  if (!sql || !(await tableExists(tableName))) {
    return 0;
  }

  if (tableName === "crew_performance_rollups") {
    return countFromQuery(sql`select count(*)::int as count from crew_performance_rollups`);
  }

  if (tableName === "daily_work_rollups") {
    return countFromQuery(sql`select count(*)::int as count from daily_work_rollups`);
  }

  if (tableName === "pay_item_project_rollups") {
    return countFromQuery(sql`select count(*)::int as count from pay_item_project_rollups`);
  }

  return countFromQuery(sql`select count(*)::int as count from pm_summary_rollups`);
}

async function requiredTablesExist(tableNames: string[]) {
  const checks = await Promise.all(tableNames.map(tableExists));
  return checks.every(Boolean);
}

async function tableExists(tableName: string) {
  const sql = getSql();

  if (!sql || !VALID_TABLE_NAMES.has(tableName)) {
    return false;
  }

  const rows = (await sql`
    select to_regclass(${`public.${tableName}`}) is not null as exists
  `) as Array<{ exists: boolean }>;

  return Boolean(rows[0]?.exists);
}

async function countFromQuery(query: Promise<Array<Record<string, unknown>>>) {
  const rows = await query;
  return Number(rows[0]?.count ?? 0) || 0;
}

async function sampleFromQuery(query: Promise<Array<Record<string, unknown>>>) {
  const rows = await query;
  return rows.map((row) => String(row.sample ?? "").trim()).filter(Boolean);
}

function addIssue(issues: DataMaintenanceIssue[], issue: DataMaintenanceIssue) {
  if (issue.count > 0) {
    issues.push(issue);
  }
}

type RollupTableName =
  | "crew_performance_rollups"
  | "daily_work_rollups"
  | "pay_item_project_rollups"
  | "pm_summary_rollups";

const VALID_TABLE_NAMES = new Set([
  "app_users",
  "crew_members",
  "crew_performance_rollups",
  "daily_entries",
  "daily_entry_crew_allocations",
  "daily_report_uploads",
  "daily_reports",
  "daily_work_rollups",
  "job_image_uploads",
  "my_jobs",
  "pay_item_project_rollups",
  "pm_summary_rollups",
  "project_archive",
  "project_blacklist",
  "project_catalog",
  "project_pay_items",
  "project_crew_members"
]);
