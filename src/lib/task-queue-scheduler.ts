import { after } from "next/server";
import { processQueuedTasks } from "@/lib/task-queue-worker";

export function scheduleQueuedTaskProcessing({
  limit = 5,
  timeBudgetMs = 25_000
}: {
  limit?: number;
  timeBudgetMs?: number;
} = {}) {
  after(async () => {
    try {
      await processQueuedTasks({
        limit,
        timeBudgetMs
      });
    } catch (error) {
      console.error("Queued task post-response processing failed", error);
    }
  });
}
