import { Bell, Check, Landmark, TrendingUp, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { setWatch } from "@/app/parcel/[pin]/actions";

/**
 * "Watch this property" — the recurring-value on-ramp. Lets an owner subscribe
 * to parcel-specific change-watches (assessment, nearby sales) and local
 * government activity, right where they're reading the report. Signed-out users
 * are routed through sign-in by the server action.
 */

interface WatchOption {
  kind: "assessment" | "sales" | "council";
  icon: LucideIcon;
  title: string;
  description: string;
}

const OPTIONS: WatchOption[] = [
  {
    kind: "assessment",
    icon: Landmark,
    title: "Assessment changes",
    description: "If King County reassesses this parcel — your cue to appeal.",
  },
  {
    kind: "sales",
    icon: TrendingUp,
    title: "Nearby sales",
    description: "When a comparable home sells nearby — fresh market + appeal evidence.",
  },
  {
    kind: "council",
    icon: Building2,
    title: "County council activity",
    description: "When the County Council acts on something near here.",
  },
];

export function WatchProperty({
  parcelId,
  active,
}: {
  parcelId: string;
  active: Set<string>;
}) {
  return (
    <section
      aria-label="Watch this property"
      className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
    >
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-pw-ink">
        <Bell className="h-[18px] w-[18px] text-pw-accent" strokeWidth={1.75} aria-hidden="true" />
        Watch this property
      </h2>
      <p className="mt-1 text-sm text-pw-sub">
        Get an email + in-app alert when something changes. Free with your account.
      </p>

      <ul className="mt-3 divide-y-[0.5px] divide-pw-divider">
        {OPTIONS.map((opt) => {
          const on = active.has(opt.kind);
          return (
            <li key={opt.kind} className="flex items-start gap-3 py-3">
              <opt.icon
                className="mt-0.5 h-[18px] w-[18px] shrink-0 text-pw-sub"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-pw-ink">{opt.title}</p>
                <p className="text-sm text-pw-sub">{opt.description}</p>
              </div>
              <form action={setWatch} className="shrink-0">
                <input type="hidden" name="parcelId" value={parcelId} />
                <input type="hidden" name="kind" value={opt.kind} />
                <input type="hidden" name="enable" value={on ? "false" : "true"} />
                {on ? (
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border-[0.5px] border-pw-green bg-pw-accent/10 px-3 py-1.5 text-sm font-medium text-pw-green hover:bg-pw-accent/20"
                    aria-label={`Stop watching ${opt.title}`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                    Watching
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-lg border-[0.5px] border-pw-border px-3 py-1.5 text-sm font-medium text-pw-green hover:bg-pw-inset"
                    aria-label={`Watch ${opt.title}`}
                  >
                    Watch
                  </button>
                )}
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
