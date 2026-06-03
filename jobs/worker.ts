import { Worker } from "bullmq";
import {
  connection,
  WATCH_QUEUE,
  scheduleWatchPolling,
  enqueuePollNow,
} from "@/lib/watches/queue";
import { runAllWatches } from "@/lib/watches/engine";
import { ingestResBldg } from "@/lib/ingest/resbldg";
import { runDueDigests } from "@/lib/digest/service";

/**
 * Watch poller worker. Run with: `npm run worker`.
 * Processes "poll" jobs by running every watch (fetch → diff → alert), registers
 * the repeatable 6-hour schedule, and ingests the weekly Assessor EXTR_ResBldg
 * extract (living-area sqft) on startup + once a day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Send monthly "what changed" digests to users who are due. Non-fatal. */
async function tickDigests() {
  try {
    const r = await runDueDigests();
    console.log(`[digest] ${JSON.stringify(r)}`);
  } catch (err) {
    console.error("[digest] run failed (will retry tomorrow):", (err as Error).message);
  }
}

/** Refresh living-area sqft from the weekly bulk extract. Non-fatal on failure. */
async function refreshResBldg() {
  try {
    const r = await ingestResBldg();
    console.log(`[ingest] EXTR_ResBldg: ${r.rows} rows (${(r.durationMs / 1000).toFixed(0)}s) · ${r.sourceDate}`);
  } catch (err) {
    console.error("[ingest] EXTR_ResBldg failed (will retry tomorrow):", (err as Error).message);
  }
}

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

  // Ingest living-area sqft now (non-blocking) and daily thereafter.
  void refreshResBldg();
  setInterval(() => void refreshResBldg(), DAY_MS).unref();

  // Tick the monthly digest daily — per-user lastDigestAt enforces cadence, so
  // a daily tick only emails users who are actually due.
  void tickDigests();
  setInterval(() => void tickDigests(), DAY_MS).unref();
}

main().catch((err) => {
  console.error("Watch worker failed to start:", err);
  process.exit(1);
});
