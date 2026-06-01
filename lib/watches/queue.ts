import { Queue, type ConnectionOptions } from "bullmq";

/**
 * BullMQ wiring for the scheduled watch pollers. The queue holds "poll" jobs;
 * the worker (jobs/worker.ts) processes them by running every watch.
 *
 * We pass connection OPTIONS (not an ioredis instance) so BullMQ owns its own
 * client — avoids dual-ioredis version clashes.
 */

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  // Required by BullMQ for its blocking connections.
  maxRetriesPerRequest: null,
};

export const WATCH_QUEUE = "watch-poll";

export const watchQueue = new Queue(WATCH_QUEUE, { connection });

const EVERY_6H = 6 * 60 * 60 * 1000;

/** Register the repeatable poll job (idempotent — same jobId replaces). */
export async function scheduleWatchPolling(): Promise<void> {
  await watchQueue.add(
    "poll",
    {},
    {
      repeat: { every: EVERY_6H },
      jobId: "watch-poll-repeatable",
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
}

/** Enqueue a single immediate poll (for startup/testing). */
export async function enqueuePollNow(): Promise<void> {
  await watchQueue.add("poll", {}, { removeOnComplete: 50, removeOnFail: 50 });
}
