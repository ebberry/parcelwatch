import { CloudOff } from "lucide-react";

/**
 * A *designed* unavailable state: when a government source is unreachable we say
 * so calmly and name it, rather than showing a bare "Not available" that reads
 * as broken. Reinforces the trust thesis — degradation is honest, not a failure.
 */
export function Unavailable({ source }: { source?: string | null }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-pw-inset px-3 py-2.5">
      <CloudOff
        className="mt-0.5 h-4 w-4 shrink-0 text-pw-faint"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="text-sm text-pw-sub">
        We couldn&apos;t reach{" "}
        {source ? <span className="text-pw-ink">{source}</span> : "this source"} just
        now. This is usually temporary — we keep checking, and it&apos;ll fill in
        once the source is back.
      </p>
    </div>
  );
}
