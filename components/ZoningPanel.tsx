import { Scale } from "lucide-react";
import { Panel, StatusPill, type PillTone } from "@/components/Panel";
import { InfoTip } from "@/components/InfoTip";
import { GLOSSARY } from "@/lib/glossary";
import type { SourcedValue } from "@/lib/provenance";
import {
  ZONING_DISCLAIMER,
  type ZoningAnalysis,
  type ZoningAnswer,
  type ZoningVerdict,
} from "@/lib/zoning/service";

const VERDICT: Record<ZoningVerdict, { tone: PillTone; label: string }> = {
  "likely yes": { tone: "good", label: "likely yes" },
  conditional: { tone: "watch", label: "conditional" },
  "check with county": { tone: "neutral", label: "check with county" },
  no: { tone: "alert", label: "no" },
};

function standardTip(label: string): string | null {
  if (/setback/i.test(label)) return GLOSSARY.setback;
  if (/lot area/i.test(label)) return GLOSSARY.minLotArea;
  return null;
}

function AnswerRow({ answer }: { answer: ZoningAnswer }) {
  const v = VERDICT[answer.verdict];
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-pw-ink">{answer.question}</span>
        <StatusPill tone={v.tone}>{v.label}</StatusPill>
      </div>
      <p className="mt-1 text-sm text-pw-sub">{answer.explanation}</p>
      <p className="mt-1 text-xs tabular-nums text-pw-faint">{answer.citation}</p>
    </li>
  );
}

export function ZoningPanel({ sourced }: { sourced: SourcedValue<ZoningAnalysis> }) {
  const z = sourced.value;
  return (
    <Panel title="What can I do here?" icon={Scale} sourced={sourced}>
      {!z ? (
        <p className="text-sm text-pw-faint">Zoning data unavailable.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-pw-sub">
            {z.zoneCode} · {z.zoneName}
          </p>

          <ul className="divide-y-[0.5px] divide-pw-divider">
            {z.answers.map((a) => (
              <AnswerRow key={a.question} answer={a} />
            ))}
          </ul>

          {z.standards.length > 0 && (
            <dl className="mt-3 divide-y-[0.5px] divide-pw-divider border-t-[0.5px] border-pw-divider">
              {z.standards.map((s) => (
                <div
                  key={s.label}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <dt className="text-pw-sub">
                    {s.label}
                    {standardTip(s.label) && (
                      <InfoTip label={s.label} text={standardTip(s.label)!} />
                    )}
                  </dt>
                  <dd className="text-right font-medium tabular-nums text-pw-ink">
                    {s.value}
                    <span className="block text-xs font-normal tabular-nums text-pw-faint">
                      {s.citation}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {z.notes.map((n) => (
            <p key={n} className="mt-3 text-xs text-pw-sub">
              {n}
            </p>
          ))}

          <p className="mt-3 border-t-[0.5px] border-pw-divider pt-3 text-xs text-pw-faint">
            {ZONING_DISCLAIMER}
          </p>
        </>
      )}
    </Panel>
  );
}
