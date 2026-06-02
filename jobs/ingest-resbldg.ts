import { ingestResBldg } from "@/lib/ingest/resbldg";

/**
 * One-shot ingest of King County's EXTR_ResBldg extract.
 * Run on the box:  npm run ingest:resbldg
 * (The worker also runs this weekly — see jobs/worker.ts.)
 */
async function main() {
  console.log("Ingesting EXTR_ResBldg (living-area square footage)...");
  const r = await ingestResBldg();
  console.log(
    `Done: ${r.rows.toLocaleString()} buildings in ${(r.durationMs / 1000).toFixed(1)}s · source: ${r.sourceDate}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("EXTR_ResBldg ingest failed:", e);
  process.exit(1);
});
