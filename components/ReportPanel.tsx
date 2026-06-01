import type { ReactNode } from "react";
import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import type { SourcedValue } from "@/lib/provenance";

/**
 * A baseline-report panel. Every panel carries a provenance badge for the
 * source its data came from — provenance is first-class, never an afterthought.
 */
export function ReportPanel<T>({
  title,
  sourced,
  children,
}: {
  title: string;
  sourced: SourcedValue<T>;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-gray-200 p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <ProvenanceBadgeFor sourced={sourced} />
      </div>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </section>
  );
}

/**
 * A single datum row. When the value is missing we say so explicitly — never
 * invent a plausible-looking placeholder.
 */
export function Field({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number | null | undefined;
  suffix?: string;
}) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">
        {has ? (
          <>
            {value}
            {suffix ? <span className="text-gray-400"> {suffix}</span> : null}
          </>
        ) : (
          <span className="font-normal italic text-gray-400">Not available</span>
        )}
      </dd>
    </div>
  );
}
