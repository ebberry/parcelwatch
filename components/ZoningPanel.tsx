import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import type { SourcedValue } from "@/lib/provenance";
import {
  ZONING_DISCLAIMER,
  type ZoningAnalysis,
  type ZoningAnswer,
  type ZoningVerdict,
} from "@/lib/zoning/service";

const VERDICT_STYLE: Record<ZoningVerdict, { dot: string; text: string; label: string }> = {
  "likely yes": { dot: "bg-confidence-confirmed", text: "text-confidence-confirmed", label: "Likely yes" },
  conditional: { dot: "bg-confidence-stale", text: "text-confidence-stale", label: "Conditional" },
  "check with county": { dot: "bg-confidence-unavailable", text: "text-gray-500", label: "Check with county" },
  no: { dot: "bg-red-600", text: "text-red-700", label: "No" },
};

function VerdictPill({ verdict }: { verdict: ZoningVerdict }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

function AnswerRow({ answer }: { answer: ZoningAnswer }) {
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-gray-900">{answer.question}</span>
        <VerdictPill verdict={answer.verdict} />
      </div>
      <p className="mt-1 text-sm text-gray-600">{answer.explanation}</p>
      <p className="mt-1 text-xs text-gray-400">{answer.citation}</p>
    </li>
  );
}

/**
 * "What can I do here?" panel. Verdicts are computed from the King County Code
 * with citations; always informational, never a legal determination.
 */
export function ZoningPanel({
  sourced,
}: {
  sourced: SourcedValue<ZoningAnalysis>;
}) {
  const z = sourced.value;
  return (
    <section
      aria-label="What you can do here (zoning)"
      className="rounded-xl border border-gray-200 p-5"
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">What can I do here?</h2>
        <ProvenanceBadgeFor sourced={sourced} />
      </div>

      {!z ? (
        <p className="mt-2 text-sm italic text-gray-400">
          Zoning data unavailable.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">
            {z.zoneCode} · {z.zoneName}
          </p>

          <ul className="divide-y divide-gray-100">
            {z.answers.map((a) => (
              <AnswerRow key={a.question} answer={a} />
            ))}
          </ul>

          {z.standards.length > 0 && (
            <dl className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {z.standards.map((s) => (
                <div key={s.label} className="flex justify-between gap-4 py-2 text-sm">
                  <dt className="text-gray-500">{s.label}</dt>
                  <dd className="text-right font-medium text-gray-900">
                    {s.value}
                    <span className="block text-xs font-normal text-gray-400">
                      {s.citation}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {z.notes.map((n) => (
            <p key={n} className="mt-3 text-xs text-gray-500">
              {n}
            </p>
          ))}

          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
            {ZONING_DISCLAIMER}
          </p>
        </>
      )}
    </section>
  );
}
