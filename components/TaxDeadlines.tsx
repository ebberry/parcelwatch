import { CalendarClock } from "lucide-react";
import { Unavailable } from "@/components/Unavailable";
import { Panel } from "@/components/Panel";
import type { SourcedValue } from "@/lib/provenance";
import type { TaxCalendar, Deadline } from "@/lib/tax/service";

function timing(d: Deadline): string {
  if (d.daysAway === 0) return "due today";
  if (d.passed) return "passed";
  if (d.daysAway === 1) return "in 1 day";
  return `in ${d.daysAway} days`;
}

function timingTone(d: Deadline): string {
  if (d.passed) return "text-pw-faint";
  if (d.daysAway <= 30) return "text-pw-amber"; // approaching
  return "text-pw-green";
}

function DeadlineRow({
  deadline,
  highlight = false,
}: {
  deadline: Deadline;
  highlight?: boolean;
}) {
  return (
    <li className={`py-3 ${highlight ? "-mx-2 rounded-lg bg-pw-inset px-2" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-pw-ink">{deadline.label}</span>
        <span className={`shrink-0 text-sm tabular-nums ${timingTone(deadline)}`}>
          {timing(deadline)}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-pw-sub">
        <span className="tabular-nums">{deadline.dateLabel}</span>
        <span className="text-pw-faint"> · {deadline.citation}</span>
      </div>
      {deadline.note && <p className="mt-1 text-xs text-pw-faint">{deadline.note}</p>}
    </li>
  );
}

export function TaxDeadlines({ sourced }: { sourced: SourcedValue<TaxCalendar> }) {
  const cal = sourced.value;
  return (
    <Panel title="Taxes & deadlines" icon={CalendarClock} sourced={sourced}>
      {!cal ? (
        <Unavailable source={sourced.source} />
      ) : (
        <>
          <ul className="divide-y-[0.5px] divide-pw-divider">
            <DeadlineRow deadline={cal.next} highlight />
            {cal.next.label !== cal.firstHalf.label && (
              <DeadlineRow deadline={cal.firstHalf} />
            )}
            {cal.next.label !== cal.secondHalf.label && (
              <DeadlineRow deadline={cal.secondHalf} />
            )}
            <DeadlineRow deadline={cal.appeal} />
          </ul>
          <p className="mt-3 text-xs text-pw-faint">
            Informational only — these are statutory rules, not your specific bill.
            Confirm exact amounts and dates with King County Treasury.
          </p>
        </>
      )}
    </Panel>
  );
}
