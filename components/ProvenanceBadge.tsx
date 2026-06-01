import type { Confidence, SourcedValue } from "@/lib/provenance";

/**
 * The signature component. Every datum carries this quiet, recessed provenance
 * line: source · ●label · checked date. Faint grey, present without shouting —
 * the visual embodiment of "we'll always tell you where this came from."
 *
 * The dot is NEVER the only signal — a sentence-case text label always
 * accompanies it (color-blind users + clarity). See /docs/design-system.md.
 */

const CONFIDENCE_META: Record<
  Confidence,
  { dot: string; label: string; srLabel: string }
> = {
  confirmed: {
    dot: "bg-confidence-confirmed",
    label: "confirmed",
    srLabel: "confirmed — authoritatively verified",
  },
  live: {
    dot: "bg-confidence-live",
    label: "live",
    srLabel: "live — freshly pulled; verify against the source if it matters",
  },
  stale: {
    dot: "bg-confidence-stale",
    label: "needs check",
    srLabel: "needs check — past the source's update window",
  },
  unavailable: {
    dot: "bg-confidence-unavailable",
    label: "unavailable",
    srLabel: "unavailable — source could not be reached",
  },
};

function formatChecked(iso: string | null): string {
  if (!iso) return "not yet checked";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "date unknown";
  const d = new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `checked ${d}`;
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
  const checked = formatChecked(fetchedAt);

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-tight text-pw-faint ${className}`}
      aria-label={`Source: ${source}. ${meta.srLabel}. ${checked}.`}
    >
      <span>{source}</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
          aria-hidden="true"
        />
        {meta.label}
      </span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{checked}</span>
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
