import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { InfoTip } from "@/components/InfoTip";
import type { SourcedValue } from "@/lib/provenance";

/**
 * "Calm civic" layout primitives (see /docs/design-system.md). White cards with
 * a 0.5px green border, a titled header (small green outline icon + optional
 * status pill), plain content, and the recessed provenance line at the bottom.
 * Two font weights only (400 / 500) — never heavier. Sentence case everywhere.
 */

export function Panel({
  title,
  icon: Icon,
  pill,
  sourced,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  pill?: ReactNode;
  /** When provided, renders the provenance line in the footer. */
  sourced?: SourcedValue<unknown>;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-pw-ink">
          {Icon && (
            <Icon
              className="h-[18px] w-[18px] shrink-0 text-pw-accent"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          )}
          {title}
        </h2>
        {pill ? <div className="shrink-0">{pill}</div> : null}
      </div>

      <div>{children}</div>

      {sourced ? (
        <div className="mt-4 border-t-[0.5px] border-pw-divider pt-3">
          <ProvenanceBadgeFor sourced={sourced} />
        </div>
      ) : null}
    </section>
  );
}

/** A muted label above a large tabular number, on the warm inset surface. */
export function MetricTile({
  label,
  value,
  sub,
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  tip?: string;
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-pw-border bg-pw-inset p-4">
      <div className="flex items-center text-xs text-pw-sub">
        {label}
        {tip ? <InfoTip label={label} text={tip} /> : null}
      </div>
      <div className="mt-1 text-2xl font-medium tabular-nums text-pw-ink">{value}</div>
      {sub ? <div className="mt-0.5 text-xs tabular-nums text-pw-faint">{sub}</div> : null}
    </div>
  );
}

export type PillTone = "good" | "watch" | "neutral" | "alert";

const PILL_TONE: Record<PillTone, string> = {
  good: "border-pw-border bg-pw-inset text-pw-green",
  watch: "border-pw-amber/30 bg-[#FBF4E8] text-pw-amber",
  neutral: "border-pw-border bg-pw-inset text-pw-sub",
  alert: "border-red-200 bg-red-50 text-red-700",
};

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-[0.5px] px-2.5 py-0.5 text-xs font-medium ${PILL_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/** A single data row: secondary-grey label, ink value, "Not available" when missing. */
export function Field({
  label,
  value,
  suffix,
  tip,
}: {
  label: string;
  value: string | number | null | undefined;
  suffix?: string;
  tip?: string;
}) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-pw-sub">
        {label}
        {tip ? <InfoTip label={label} text={tip} /> : null}
      </dt>
      <dd className="text-right font-medium tabular-nums text-pw-ink">
        {has ? (
          <>
            {value}
            {suffix ? <span className="font-normal text-pw-faint"> {suffix}</span> : null}
          </>
        ) : (
          <span className="font-normal text-pw-faint">Not available</span>
        )}
      </dd>
    </div>
  );
}

/**
 * A reassuring "all clear" line for quiet states — designed to feel like a clean
 * bill of health, never like the app failed to load.
 */
export function QuietNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-pw-green">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-pw-accent"
        strokeWidth={2}
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  );
}

/** Ambient overall-state band near the top of the report. */
export function StatusStrip({
  tone,
  children,
}: {
  tone: "clear" | "attention";
  children: ReactNode;
}) {
  const dot = tone === "clear" ? "bg-pw-accent" : "bg-pw-amber";
  return (
    <div className="flex items-center gap-2.5 rounded-xl border-[0.5px] border-pw-border bg-pw-accent/10 px-4 py-3 text-sm text-pw-ink">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
