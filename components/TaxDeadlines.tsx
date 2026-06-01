import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import type { SourcedValue } from "@/lib/provenance";
import type { TaxCalendar, Deadline } from "@/lib/tax/service";

function timing(d: Deadline): string {
  if (d.daysAway === 0) return "Due today";
  if (d.passed) return "Passed";
  if (d.daysAway === 1) return "In 1 day";
  return `In ${d.daysAway} days`;
}

function DeadlineRow({
  deadline,
  highlight = false,
}: {
  deadline: Deadline;
  highlight?: boolean;
}) {
  return (
    <li
      className={`py-3 ${highlight ? "rounded-lg bg-sky-50 px-3" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-gray-900">{deadline.label}</span>
        <span
          className={`shrink-0 text-sm ${
            deadline.passed ? "text-gray-400" : "text-confidence-live"
          }`}
        >
          {timing(deadline)}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-gray-600">
        {deadline.dateLabel}
        <span className="text-gray-400"> · {deadline.citation}</span>
      </div>
      {deadline.note && (
        <p className="mt-1 text-xs text-gray-400">{deadline.note}</p>
      )}
    </li>
  );
}

/**
 * Taxes & deadlines panel. Dates are computed from statute (confidence
 * "confirmed"); the badge names the rules. Informational, not legal advice.
 */
export function TaxDeadlines({
  sourced,
}: {
  sourced: SourcedValue<TaxCalendar>;
}) {
  const cal = sourced.value;
  return (
    <section
      aria-label="Taxes and deadlines"
      className="rounded-xl border border-gray-200 p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Taxes &amp; deadlines</h2>
        <ProvenanceBadgeFor sourced={sourced} />
      </div>

      {!cal ? (
        <p className="text-sm italic text-gray-400">Not available</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            <DeadlineRow deadline={cal.next} highlight />
            {cal.next.label !== cal.firstHalf.label && (
              <DeadlineRow deadline={cal.firstHalf} />
            )}
            {cal.next.label !== cal.secondHalf.label && (
              <DeadlineRow deadline={cal.secondHalf} />
            )}
            <DeadlineRow deadline={cal.appeal} />
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            Informational only — these are statutory rules, not your specific
            bill. Confirm exact amounts and dates with King County Treasury.
          </p>
        </>
      )}
    </section>
  );
}
