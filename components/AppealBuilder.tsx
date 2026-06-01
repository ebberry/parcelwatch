"use client";

import { useState } from "react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { APPEAL_REASONS, type AppealRecommendation } from "@/lib/appeals";
import { kmToMiles } from "@/lib/geo";
import type { Confidence } from "@/lib/provenance";
import type { CompSet } from "@/lib/comps/service";
import type { SaleCompSet } from "@/lib/sales/service";

const STRENGTH_COPY: Record<
  AppealRecommendation["strength"],
  { label: string; cls: string }
> = {
  strong: { label: "Strong case", cls: "bg-pw-green text-white" },
  moderate: { label: "Moderate case", cls: "bg-pw-amber/20 text-pw-ink" },
  weak: { label: "Weak case", cls: "bg-pw-inset text-pw-sub" },
  none: { label: "Little support", cls: "bg-pw-inset text-pw-sub" },
};

interface ParcelFacts {
  pin: string;
  address: string | null;
  land: number | null;
  improvements: number | null;
  total: number | null;
  taxYear: number | null;
}

interface Provenance {
  source: string;
  fetchedAt: string | null;
  confidence: Confidence;
}

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d}, ${y}` : String(y);
}
function fmtMiles(km: number | null): string {
  if (km == null) return "—";
  const mi = kmToMiles(km);
  return mi < 0.1 ? "<0.1 mi" : `${mi.toFixed(1)} mi`;
}

export function AppealBuilder({
  parcel,
  comp,
  compProvenance,
  sale,
  saleProvenance,
  recommendation,
  suggestedNarrative,
  suggestedReasons,
  eAppealsUrl,
  boeFormsUrl,
}: {
  parcel: ParcelFacts;
  comp: CompSet | null;
  compProvenance: Provenance;
  sale: SaleCompSet | null;
  saleProvenance: Provenance;
  recommendation: AppealRecommendation;
  suggestedNarrative: string | null;
  suggestedReasons: string[];
  eAppealsUrl: string;
  boeFormsUrl: string;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [contact, setContact] = useState("");
  // Default the requested value to the recommendation when the evidence supports one.
  const [opinion, setOpinion] = useState(
    recommendation.shouldAppeal && recommendation.recommendedValue != null
      ? String(recommendation.recommendedValue)
      : "",
  );
  const [reasons, setReasons] = useState<Set<string>>(new Set(suggestedReasons));
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

  const saleComps = sale?.comps ?? [];

  const rec = recommendation;
  const strength = STRENGTH_COPY[rec.strength];

  return (
    <div className="mt-6">
      {/* Recommendation — the headline: should you appeal, and to what value */}
      <section className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-medium text-pw-ink">Our recommendation</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${strength.cls}`}>
            {strength.label}
          </span>
        </div>

        {rec.shouldAppeal && rec.recommendedValue != null ? (
          <>
            <p className="text-sm text-pw-sub">
              The evidence supports appealing. Consider requesting a reduction to about
            </p>
            <p className="mt-1 font-serif text-3xl font-medium text-pw-ink">
              {usd(rec.recommendedValue)}
            </p>
            <p className="mt-1 text-sm text-pw-sub">
              from the current assessed value of{" "}
              <span className="font-medium text-pw-ink">{usd(rec.currentAssessed)}</span> — a
              reduction of about{" "}
              <span className="font-medium text-pw-amber">
                {usd(rec.reductionAmount)} ({rec.reductionPct}%)
              </span>
              . Lowering the assessed value lowers your property-tax bill roughly in proportion.
            </p>
            <p className="mt-2 text-sm text-pw-sub">
              Based on <span className="text-pw-ink">{rec.basis}</span>
              {rec.rangeLow != null && rec.rangeHigh != null && rec.rangeLow !== rec.rangeHigh && (
                <>
                  . A defensible range across the evidence is{" "}
                  <span className="text-pw-ink">{usd(rec.rangeLow)}–{usd(rec.rangeHigh)}</span>
                </>
              )}
              .
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-pw-sub">
              On the sales and ratio data, the assessed value of{" "}
              <span className="font-medium text-pw-ink">{usd(rec.currentAssessed)}</span>{" "}
              looks fair and roughly uniform with nearby homes
              {rec.recommendedValue != null && rec.reductionPct != null && (
                <> (nearest indicator ≈ {usd(rec.recommendedValue)}, about {Math.abs(rec.reductionPct)}% away)</>
              )}
              .
            </p>
            <p className="mt-2 text-sm text-pw-sub">
              That doesn&apos;t mean you can&apos;t appeal. Filing is free and low-risk, and
              you may have grounds the data can&apos;t see — <span className="text-pw-ink">damage
              or deferred maintenance, errors in the county&apos;s record, site or access
              problems, or a lower appraisal</span>. If any apply, check them below and file.
            </p>
          </>
        )}

        {rec.indicators.length > 0 && (
          <div className="mt-3 rounded-lg border-[0.5px] border-pw-border bg-pw-inset px-3 py-2">
            <p className="text-xs font-medium text-pw-sub">What the evidence indicates</p>
            <ul className="mt-1 space-y-0.5 text-xs text-pw-sub">
              {rec.indicators.map((ind) => (
                <li key={ind.key} className="flex justify-between gap-3">
                  <span className="capitalize">{ind.label}</span>
                  <span className="tabular-nums text-pw-ink">{usd(ind.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-2 text-xs text-pw-faint">
          {rec.caveats.join(" ")} Not legal advice.
        </p>
      </section>

      {/* Comparable SALES evidence (market value — strongest argument) */}
      {sale && (saleComps.length > 0 || sale.subjectSale) && (
        <section className="no-print mt-4 rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium text-pw-ink">
              Comparable homes — recent sales &amp; assessments
            </h2>
            <ProvenanceBadge {...saleProvenance} />
          </div>

          {sale.subjectSale && (
            <p className="mb-3 rounded-lg border-[0.5px] border-pw-border bg-pw-inset px-3 py-2 text-sm text-pw-sub">
              This property last sold in{" "}
              <span className="font-medium text-pw-ink">{fmtDate(sale.subjectSale.saleDate)}</span> for{" "}
              <span className="font-medium text-pw-ink">{usd(sale.subjectSale.salePrice)}</span>
              {sale.subjectSale.belowAssessedPct != null &&
                sale.subjectSale.belowAssessedPct >= 5 && (
                  <>
                    {" "}— about{" "}
                    <span className="font-medium text-pw-amber">
                      {sale.subjectSale.belowAssessedPct}% below
                    </span>{" "}
                    the assessed value. A recent purchase price is strong appeal evidence.
                  </>
                )}
            </p>
          )}

          {saleComps.length > 0 && (
            <>
              <p className="text-sm text-pw-sub">
                {sale.appearsHigh ? (
                  <>
                    The assessed value of {usd(sale.subjectAssessedTotal)} is about{" "}
                    <span className="font-medium text-pw-amber">
                      {sale.assessedVsMedianSalePct}% above
                    </span>{" "}
                    the median of {saleComps.length} recent comparable sales nearby
                    ({usd(sale.medianSalePrice)}) — which may support an appeal.
                  </>
                ) : (
                  <>
                    The assessed value of {usd(sale.subjectAssessedTotal)} is{" "}
                    {sale.assessedVsMedianSalePct != null ? (
                      <span className="font-medium">
                        {sale.assessedVsMedianSalePct > 0 ? "+" : ""}
                        {sale.assessedVsMedianSalePct}% vs
                      </span>
                    ) : (
                      "in line with"
                    )}{" "}
                    the median of {saleComps.length} recent comparable sales nearby
                    ({usd(sale.medianSalePrice)}).
                  </>
                )}
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-pw-border text-pw-faint">
                      <th className="py-1 font-medium">Sold</th>
                      <th className="py-1 font-medium">Address</th>
                      <th className="py-1 text-right font-medium">Sale price</th>
                      <th className="py-1 text-right font-medium">Assessed</th>
                      <th className="py-1 text-right font-medium">Dist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleComps.map((c) => (
                      <tr key={c.pin} className="border-b border-pw-border/50">
                        <td className="py-1.5 tabular-nums text-pw-sub">{fmtDate(c.saleDate)}</td>
                        <td className="py-1.5 text-pw-ink">{c.address ?? c.pin}</td>
                        <td className="py-1.5 text-right tabular-nums text-pw-ink">{usd(c.salePrice)}</td>
                        <td className="py-1.5 text-right tabular-nums text-pw-sub">{usd(c.assessedTotal)}</td>
                        <td className="py-1.5 text-right tabular-nums text-pw-sub">{fmtMiles(c.distanceKm)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-1.5 text-pw-sub" colSpan={2}>
                        Median
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-pw-ink">{usd(sale.medianSalePrice)}</td>
                      <td className="py-1.5 text-right tabular-nums text-pw-ink">{usd(sale.medianAssessedTotal)}</td>
                      <td className="py-1.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-pw-faint">
                Each home&apos;s recorded sale price next to the county&apos;s current
                assessed value.
                {sale.medianAssessedToSalePct != null && (
                  <> Nearby homes are assessed at a median of about{" "}
                  <span className="font-medium text-pw-sub">
                    {sale.medianAssessedToSalePct}% of their sale price
                  </span>.</>
                )}{" "}
                Arm&apos;s-length sales, same use, within ~1 mile, last 3 years; sale
                and assessment dates may differ. A market screen, not a formal appraisal.
              </p>
            </>
          )}
        </section>
      )}

      {/* Comparable-assessment evidence (uniformity argument) */}
      {comp && (
        <section className="no-print mt-4 rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium text-pw-ink">
              Assessment uniformity (per lot sq ft)
            </h2>
            <ProvenanceBadge {...compProvenance} />
          </div>
          <p className="text-sm text-pw-sub">
            {comp.appearsHigh ? (
              <>
                This property is assessed about{" "}
                <span className="font-medium text-pw-amber">
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
          <p className="mt-1 text-xs text-pw-faint">
            Per-lot-square-foot is a rough screen — it doesn&apos;t account for
            building size or condition. Not a formal appraisal.
          </p>
        </section>
      )}

      {/* Form */}
      <form className="no-print mt-6 flex flex-col gap-4">
        <h2 className="text-[15px] font-medium text-pw-ink">Your details</h2>
        <label className="text-sm">
          <span className="mb-1 block text-pw-sub">Owner name (as on the deed)</span>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-pw-ink"
            autoComplete="name"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-pw-sub">Contact (mailing address, phone, email)</span>
          <textarea
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            rows={2}
            className="w-full rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-pw-ink"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-pw-sub">
            Your opinion of the property&apos;s value
          </span>
          <input
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            inputMode="numeric"
            placeholder="$"
            className="w-full rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-pw-ink"
          />
          {(sale?.medianSalePrice != null || comp?.medianAssessedTotal != null) && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-pw-faint">
              <span>Reference points:</span>
              {sale?.medianSalePrice != null && (
                <button
                  type="button"
                  onClick={() => setOpinion(String(Math.round(sale.medianSalePrice!)))}
                  className="rounded border-[0.5px] border-pw-border px-2 py-0.5 text-pw-green hover:bg-pw-accent/10"
                >
                  Comparable sales median {usd(sale.medianSalePrice)}
                </button>
              )}
              {comp?.medianAssessedTotal != null && (
                <button
                  type="button"
                  onClick={() => setOpinion(String(Math.round(comp.medianAssessedTotal!)))}
                  className="rounded border-[0.5px] border-pw-border px-2 py-0.5 text-pw-green hover:bg-pw-accent/10"
                >
                  Comparable assessment median {usd(comp.medianAssessedTotal)}
                </button>
              )}
            </span>
          )}
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1 text-pw-sub">Reasons for the appeal</legend>
          <p className="mb-2 text-xs text-pw-faint">
            We&apos;ve checked the boxes the data supports. Add any others only you
            would know — each is a valid, independent ground for an appeal.
          </p>
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
          <span className="mb-1 block text-pw-sub">
            Explanation / grounds (edit freely)
          </span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={8}
            className="w-full rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-pw-ink"
          />
        </label>
      </form>

      {/* Evidence checklist — what strengthens the appeal */}
      <section className="no-print mt-6 rounded-xl border-[0.5px] border-pw-border bg-pw-inset p-5">
        <h2 className="text-[15px] font-medium text-pw-ink">Evidence to attach</h2>
        <p className="mt-1 text-sm text-pw-sub">
          The Board weighs evidence of market value. The comparable sales and
          assessments above are already in your petition. These strengthen it
          further — attach what applies (none are required):
        </p>
        <ul className="mt-2 ml-5 list-disc text-sm text-pw-sub">
          <li>Your closing/settlement statement, if you bought recently.</li>
          <li>A recent independent appraisal or broker price opinion.</li>
          <li>Photos documenting condition issues, damage, or deferred maintenance.</li>
          <li>Contractor estimates for needed repairs.</li>
          <li>Corrections to the county record (wrong square footage, bedrooms, etc.).</li>
        </ul>
      </section>

      {/* Petition preview (this is what prints) */}
      <div className="print-area mt-8 rounded-xl border border-gray-300 p-6">
        <h2 className="text-xl font-bold">
          Taxpayer Petition — King County Board of Equalization
        </h2>
        <p className="text-sm text-pw-faint">
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
        <PetitionRow label="Your estimate of value" value={opinion ? usd(Number(opinion.replace(/[^0-9.]/g, ""))) : "—"} />

        <h3 className="mt-4 font-semibold">Reasons</h3>
        {checkedLabels.length ? (
          <ul className="ml-5 list-disc text-sm">
            {checkedLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-pw-faint">—</p>
        )}

        <h3 className="mt-4 font-semibold">Explanation &amp; evidence</h3>
        <p className="whitespace-pre-wrap text-sm">{explanation || "—"}</p>

        {/* Comparable sales schedule */}
        {saleComps.length > 0 && (
          <>
            <h3 className="mt-4 font-semibold">
              Comparable homes — sales &amp; assessments (within ~1 mile, same use, last 3 years)
            </h3>
            <table className="mt-1 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-pw-faint">
                  <th className="py-1">Sale date</th>
                  <th className="py-1">Address</th>
                  <th className="py-1 text-right">Sale price</th>
                  <th className="py-1 text-right">Assessed value</th>
                  <th className="py-1 text-right">Assd/sale</th>
                  <th className="py-1 text-right">Distance</th>
                </tr>
              </thead>
              <tbody>
                {saleComps.map((c) => (
                  <tr key={c.pin} className="border-b border-gray-100">
                    <td className="py-1 tabular-nums">{fmtDate(c.saleDate)}</td>
                    <td className="py-1">{c.address ?? c.pin}</td>
                    <td className="py-1 text-right tabular-nums">{usd(c.salePrice)}</td>
                    <td className="py-1 text-right tabular-nums">{usd(c.assessedTotal)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {c.assessedToSalePct != null ? `${c.assessedToSalePct}%` : "—"}
                    </td>
                    <td className="py-1 text-right tabular-nums">{fmtMiles(c.distanceKm)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1" colSpan={2}>Median</td>
                  <td className="py-1 text-right tabular-nums">{usd(sale?.medianSalePrice)}</td>
                  <td className="py-1 text-right tabular-nums">{usd(sale?.medianAssessedTotal)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {sale?.medianAssessedToSalePct != null ? `${sale.medianAssessedToSalePct}%` : "—"}
                  </td>
                  <td className="py-1" />
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-pw-faint">
              Source: {saleProvenance.source}. Median sale ≈ {usd(sale?.medianSalePrice)}
              {sale?.lowSalePrice != null && sale?.highSalePrice != null && (
                <> (range {usd(sale.lowSalePrice)}–{usd(sale.highSalePrice)})</>
              )}
              ; median assessed ≈ {usd(sale?.medianAssessedTotal)}. This property assessed{" "}
              {usd(parcel.total)}
              {sale?.assessedVsMedianSalePct != null && (
                <> ({sale.assessedVsMedianSalePct > 0 ? "+" : ""}{sale.assessedVsMedianSalePct}% vs median sale)</>
              )}
              . Recorded sales, not size/condition-adjusted; sale and assessment dates may differ.
            </p>
          </>
        )}

        {/* Comparable assessments schedule */}
        {comp && comp.comps.length > 0 && (
          <>
            <h3 className="mt-4 font-semibold">
              Comparable assessments (within ~1 mile, same use)
            </h3>
            <table className="mt-1 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-pw-faint">
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
            <p className="mt-1 text-xs text-pw-faint">
              Source: {compProvenance.source}. Comparable median ≈{" "}
              {usd(comp.medianAssessedTotal)} total, {usd(comp.medianPerLotSqFt)} per lot sq ft.
            </p>
          </>
        )}
      </div>

      {/* Actions + hand-off */}
      <div className="no-print mt-6 flex flex-col gap-3">
        {reasons.size > 0 && (
          <p className="rounded-lg border-[0.5px] border-pw-green/40 bg-pw-accent/10 px-3 py-2 text-sm text-pw-ink">
            You&apos;ve indicated {reasons.size} ground{reasons.size === 1 ? "" : "s"} for
            an appeal. Filing is free — print your petition and submit it below.
          </p>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-pw-green px-4 py-2 text-base font-medium text-white hover:bg-pw-ink"
        >
          Print / Save as PDF
        </button>
        <a
          href={eAppealsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border-[0.5px] border-pw-green px-4 py-2 text-base font-medium text-pw-green hover:bg-pw-accent/10"
        >
          File it on King County eAppeals <span aria-hidden="true">↗</span>
        </a>
        <p className="text-xs text-pw-faint">
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
      <span className="text-pw-faint">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
