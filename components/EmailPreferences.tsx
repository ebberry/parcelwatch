import { Mail } from "lucide-react";
import { setDigestPreference, sendTestDigest } from "@/app/dashboard/actions";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Email digest preferences on the dashboard — turn the monthly summary on/off
 * and send yourself a test copy (the activation check). Server-action forms, no
 * client JS.
 */
export function EmailPreferences({
  optOut,
  lastDigestAt,
}: {
  optOut: boolean;
  lastDigestAt: Date | null;
}) {
  const last = fmtDate(lastDigestAt);
  return (
    <section className="mt-9 rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-pw-ink">
        <Mail className="h-[18px] w-[18px] text-pw-accent" strokeWidth={1.75} aria-hidden="true" />
        Email digest
      </h2>
      <p className="mt-1.5 text-sm text-pw-sub">
        {optOut
          ? "Off — you won't get the monthly summary of what changed."
          : "On — a monthly summary of what changed around your property."}
        {last ? ` Last sent ${last}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form action={setDigestPreference}>
          <input type="hidden" name="optOut" value={optOut ? "false" : "true"} />
          <button
            type="submit"
            className="rounded-lg border-[0.5px] border-pw-green px-3 py-1.5 text-sm font-medium text-pw-green hover:bg-pw-accent/10"
          >
            {optOut ? "Turn on monthly emails" : "Turn off monthly emails"}
          </button>
        </form>
        <form action={sendTestDigest}>
          <button type="submit" className="text-sm text-pw-green hover:underline">
            Send me a test digest now
          </button>
        </form>
      </div>
    </section>
  );
}
