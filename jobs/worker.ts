import { Worker } from "bullmq";
import {
  connection,
  WATCH_QUEUE,
  scheduleWatchPolling,
  enqueuePollNow,
} from "@/lib/watches/queue";
import { runAllWatches } from "@/lib/watches/engine";

/**
 * Watch poller worker. Run with: `npm run worker`.
 * Processes "poll" jobs by running every watch (fetch → diff → alert), and
 * registers the repeatable 6-hour schedule on startup.
 */

const worker = new Worker(
  WATCH_QUEUE,
  async () => {
    const results = await runAllWatches();
    console.log(`[watch-poll] ${JSON.stringify(results)}`);
    return results;
  },
  { connection },
);

worker.on("completed", (job) => console.log(`[watch-poll] job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[watch-poll] job ${job?.id} failed:`, err));

async function main() {
  await scheduleWatchPolling();
  await enqueuePollNow(); // run once on startup
  console.log("Watch worker started — repeatable poll every 6h registered.");
}

main().catch((err) => {
  console.error("Watch worker failed to start:", err);
  process.exit(1);
});
