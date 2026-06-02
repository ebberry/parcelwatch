/**
 * Loading placeholder that mirrors a Panel card, shown while a panel's data
 * streams in. Keeps layout stable (no jump) and reads as "loading", not broken.
 */
export function PanelSkeleton({ title, lines = 3 }: { title?: string; lines?: number }) {
  return (
    <section
      aria-hidden="true"
      className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="h-[18px] w-[18px] rounded bg-pw-divider" />
        {title ? (
          <h2 className="text-[15px] font-medium text-pw-faint">{title}</h2>
        ) : (
          <div className="h-4 w-40 rounded bg-pw-divider" />
        )}
      </div>
      <div className="animate-pulse space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-pw-divider"
            style={{ width: `${[92, 78, 85, 64, 70][i % 5]}%` }}
          />
        ))}
      </div>
    </section>
  );
}

/** A slimmer skeleton for the "What matters here" synthesis card. */
export function SummarySkeleton() {
  return (
    <section
      aria-hidden="true"
      className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
    >
      <div className="mb-3 h-3 w-32 rounded bg-pw-divider" />
      <div className="animate-pulse space-y-3.5">
        {[88, 80, 72].map((w, i) => (
          <div key={i} className="h-3.5 rounded bg-pw-divider" style={{ width: `${w}%` }} />
        ))}
      </div>
    </section>
  );
}
