import type { Confidence, SourcedValue } from "@/lib/provenance";

/**
 * Provenance is a first-class UI component, not a tooltip afterthought.
 * It renders: source name + last-refreshed date + a confidence dot.
 * Used consistently everywhere a datum appears. No naked numbers in the app.
 *
 * Accessibility: the dot has a text label for screen readers; the whole badge
 * is a single labelled element so it reads as one unit.
 */

const CONFIDENCE_META: Record<
  Confidence,
  { dot: string; label: string; srLabel: string }
> = {
  confirmed: {
    dot: "bg-confidence-confirmed",
    label: "Confirmed",
    srLabel: "Confirmed — authoritatively verified",
  },
  live: {
    dot: "bg-confidence-live",
    label: "Live",
    srLabel: "Live — fresh within the source's update window",
  },
  stale: {
    dot: "bg-confidence-stale",
    label: "Unverified",
    srLabel: "Stale — past the source's update window, not yet re-verified",
  },
  unavailable: {
    dot: "bg-confidence-unavailable",
    label: "Unavailable",
    srLabel: "Unavailable — source could not be reached",
  },
};

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "no data yet";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "unknown date";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface ProvenanceBadgeProps {
  source: string;
  fetchedAt: string | null;
  confidence: Confidence;
  className?: string;
}

export function ProvenanceBadge({
  source,
  fetchedAt,
  confidence,
  className = "",
}: ProvenanceBadgeProps) {
  const meta = CONFIDENCE_META[confidence];
  const dateLabel = formatFetchedAt(fetchedAt);
  const human = `${source} · ${meta.label} · updated ${dateLabel}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 ${className}`}
      aria-label={`Source: ${source}. ${meta.srLabel}. Last updated ${dateLabel}.`}
      title={human}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
        aria-hidden="true"
      />
      <span className="font-medium">{source}</span>
      <span className="text-gray-400" aria-hidden="true">
        ·
      </span>
      <span>{meta.label}</span>
      <span className="text-gray-400" aria-hidden="true">
        ·
      </span>
      <span className="tabular-nums">{dateLabel}</span>
    </span>
  );
}

/** Convenience: render straight from a SourcedValue. */
export function ProvenanceBadgeFor<T>({
  sourced,
  className,
}: {
  sourced: SourcedValue<T>;
  className?: string;
}) {
  return (
    <ProvenanceBadge
      source={sourced.source}
      fetchedAt={sourced.fetchedAt}
      confidence={sourced.confidence}
      className={className}
    />
  );
}
