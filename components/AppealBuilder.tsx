"use client";

import { useState } from "react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { APPEAL_REASONS } from "@/lib/appeals";
import type { Confidence } from "@/lib/provenance";
import type { CompSet } from "@/lib/comps/service";

interface ParcelFacts {
  pin: string;
  address: string | null;
  land: number | null;
  improvements: number | null;
  total: number | null;
  taxYear: number | null;
}

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

export function AppealBuilder({
  parcel,
  comp,
  compProvenance,
  suggestedNarrative,
  eAppealsUrl,
  boeFormsUrl,
}: {
  parcel: ParcelFacts;
  comp: CompSet | null;
  compProvenance: { source: string; fetchedAt: string | null; confidence: Confidence };
  suggestedNarrative: string | null;
  eAppealsUrl: string;
  boeFormsUrl: string;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [contact, setContact] = useState("");
  const [opinion, setOpinion] = useState("");
  const [reasons, setReasons] = useState<Set<string>>(
    new Set(suggestedNarrative ? ["uniformity"] : []),
  );
  const [explanation, setExplanation] = useState(suggestedNarrative ?? "");

  function toggleReason(key: string) {
    setReasons((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const checkedLabels = APPEAL_REASONS.filter((r) => reasons.has(r.key)).map(
    (r) => r.label,
  );

  return (
    <div className="mt-6">
      {/* Comparable-assessment evidence */}
      {comp && (
        <section className="no-print rounded-xl border border-gray-200 p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Comparable assessments</h2>
            <ProvenanceBadge {...compProvenance} />
          </div>
          <p className="text-sm text-gray-600">
            {comp.appearsHigh ? (
              <>
                This property is assessed about{" "}
                <span className="font-semibold text-confidence-stale">
                  {comp.subjectVsMedianPct}% above
                </span>{" "}
                the median of {comp.comps.length} comparable nearby properties (per
                lot square foot) — which may support an appeal.
              </>
            ) : (
              <>
                This property is assessed in line with comparable nearby
                properties ({comp.subjectVsMedianPct != null
                  ? `${comp.subjectVsMedianPct > 0 ? "+" : ""}${comp.subjectVsMedianPct}% vs median`
                  : "no clear difference"}
                ). An appeal may be harder to support on uniformity grounds.
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Per-lot-square-foot is a rough screen — it doesn&apos;t account for
            building size or condition. Not a formal appraisal.
          </p>
        </section>
      )}

      {/* Form */}
      <form className="no-print mt-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Your details</h2>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Owner name (as on the deed)</span>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            autoComplete="name"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Contact (mailing address, phone, email)</span>
          <textarea
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">
            Your opinion of the property&apos;s value
            {comp?.medianAssessedTotal != null && (
              <span className="text-gray-400">
                {" "}
                (comparable median: {usd(comp.medianAssessedTotal)})
              </span>
            )}
          </span>
          <input
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            inputMode="numeric"
            placeholder="$"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1 text-gray-600">Reasons for the appeal</legend>
          <div className="flex flex-col gap-2">
            {APPEAL_REASONS.map((r) => (
              <label key={r.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={reasons.has(r.key)}
                  onChange={() => toggleReason(r.key)}
                  className="mt-1"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">
            Explanation / grounds (edit freely)
          </span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </form>

      {/* Petition preview (this is what prints) */}
      <div className="print-area mt-8 rounded-xl border border-gray-300 p-6">
        <h2 className="text-xl font-bold">
          Taxpayer Petition — King County Board of Equalization
        </h2>
        <p className="text-sm text-gray-500">
          Draft prepared by ParcelWatch · review before filing
        </p>

        <PetitionRow label="Property address" value={parcel.address ?? "—"} />
        <PetitionRow label="Parcel number (PIN)" value={parcel.pin} />
        <PetitionRow label="Taxpayer" value={ownerName || "—"} />
        <PetitionRow label="Contact" value={contact || "—"} />

        <h3 className="mt-4 font-semibold">Assessor&apos;s determination</h3>
        <PetitionRow label="Land" value={usd(parcel.land)} />
        <PetitionRow label="Improvements" value={usd(parcel.improvements)} />
        <PetitionRow label="Total assessed value" value={usd(parcel.total)} />
        <PetitionRow label="Assessment / tax year" value={parcel.taxYear?.toString() ?? "—"} />

        <h3 className="mt-4 font-semibold">Taxpayer&apos;s opinion of value</h3>
        <PetitionRow label="Your estimate of value" value={opinion || "—"} />

        <h3 className="mt-4 font-semibold">Reasons</h3>
        {checkedLabels.length ? (
          <ul className="ml-5 list-disc text-sm">
            {checkedLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}

        <h3 className="mt-4 font-semibold">Explanation &amp; evidence</h3>
        <p className="whitespace-pre-wrap text-sm">{explanation || "—"}</p>

        {comp && comp.comps.length > 0 && (
          <>
            <h3 className="mt-4 font-semibold">
              Comparable assessments (within ~1 mile, same use)
            </h3>
            <table className="mt-1 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-gray-500">
                  <th className="py-1">Address</th>
                  <th className="py-1 text-right">Lot sq ft</th>
                  <th className="py-1 text-right">Assessed</th>
                  <th className="py-1 text-right">$/lot sf</th>
                </tr>
              </thead>
              <tbody>
                {comp.comps.map((c) => (
                  <tr key={c.pin} className="border-b border-gray-100">
                    <td className="py-1">{c.address ?? c.pin}</td>
                    <td className="py-1 text-right">{c.lotSqFt?.toLocaleString() ?? "—"}</td>
                    <td className="py-1 text-right">{usd(c.assessedTotal)}</td>
                    <td className="py-1 text-right">{usd(c.perLotSqFt)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1">This property</td>
                  <td className="py-1 text-right">{comp.subject.lotSqFt?.toLocaleString() ?? "—"}</td>
                  <td className="py-1 text-right">{usd(comp.subject.assessedTotal)}</td>
                  <td className="py-1 text-right">{usd(comp.subject.perLotSqFt)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-gray-500">
              Source: {compProvenance.source}. Comparable median ≈{" "}
              {usd(comp.medianAssessedTotal)} total, {usd(comp.medianPerLotSqFt)} per lot sq ft.
            </p>
          </>
        )}
      </div>

      {/* Actions + hand-off */}
      <div className="no-print mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-base font-medium text-white"
        >
          Print / Save as PDF
        </button>
        <a
          href={eAppealsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-900 px-4 py-2 text-base font-medium text-gray-900"
        >
          File it on King County eAppeals <span aria-hidden="true">↗</span>
        </a>
        <p className="text-xs text-gray-500">
          You file the petition yourself through King County&apos;s portal (or by
          mail using the{" "}
          <a href={boeFormsUrl} target="_blank" rel="noopener noreferrer" className="underline">
            official petition form
          </a>
          ). Deadline: within 60 days of your value notice, or July 1 — whichever
          is later. This tool is informational and not legal advice.
        </p>
      </div>
    </div>
  );
}

function PetitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
