import { ChevronRight, Check } from "lucide-react";
import type { Finding, FindingTone } from "@/lib/report/summary";

/**
 * "What matters here" — the report's lead. Synthesizes the few findings worth
 * the owner's attention into a scannable, linked list, instead of leaving them
 * scattered across a flat panel stack. A single "clear" finding renders as a
 * calm all-clear strip.
 */

const DOT: Record<FindingTone, string> = {
  opportunity: "bg-pw-green",
  attention: "bg-pw-amber",
  info: "bg-pw-sub/50",
  clear: "bg-pw-green",
};

export function ReportSummary({ findings }: { findings: Finding[] }) {
  const onlyClear = findings.length === 1 && findings[0].tone === "clear";

  if (onlyClear) {
    return (
      <section
        aria-label="What matters here"
        className="flex items-center gap-2.5 rounded-xl border-[0.5px] border-pw-border bg-pw-card px-4 py-3"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pw-green/10">
          <Check className="h-3 w-3 text-pw-green" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <p className="text-sm text-pw-sub">{findings[0].title}</p>
      </section>
    );
  }

  return (
    <section
      aria-label="What matters here"
      className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-4"
    >
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-pw-faint">
        What matters here
      </h2>
      <ul className="divide-y-[0.5px] divide-pw-divider">
        {findings.map((f) => {
          const body = (
            <>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[f.tone]}`} aria-hidden="true" />
              <span className="flex-1 text-sm text-pw-ink">{f.title}</span>
              {f.href && (
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-pw-faint"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
            </>
          );
          return (
            <li key={f.id}>
              {f.href ? (
                <a
                  href={f.href}
                  className="flex items-start gap-2.5 py-2 hover:bg-pw-inset/60 -mx-2 px-2 rounded-md transition-colors"
                >
                  {body}
                </a>
              ) : (
                <div className="flex items-start gap-2.5 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
