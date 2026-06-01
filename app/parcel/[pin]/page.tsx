import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronLeft,
  Home,
  Landmark,
  Ruler,
  Factory,
  ExternalLink,
} from "lucide-react";
import { getParcelCore } from "@/lib/parcels/service";
import { getComparables } from "@/lib/comps/service";
import { getSaleComps } from "@/lib/sales/service";
import { buildRecommendation } from "@/lib/appeals";
import { getTaxCalendar } from "@/lib/tax/service";
import { getZoningAnalysis } from "@/lib/zoning/service";
import { getFloodHazard, getSeismicActivity } from "@/lib/hazards/service";
import {
  getEpaSites,
  getWaterSystem,
  getNeighborhoodStats,
  censusKeyConfigured,
} from "@/lib/environment/service";
import { getCouncilActivity } from "@/lib/watches/service";
import { eRealPropertyUrl } from "@/lib/adapters/kingcounty";
import { GLOSSARY, decodePropertyType } from "@/lib/glossary";
import { titleCaseAddress } from "@/lib/format";
import { Panel, Field, MetricTile, PanelInsight } from "@/components/Panel";
import { summarizeFindings } from "@/lib/report/summary";
import { ReportSummary } from "@/components/ReportSummary";
import { watchThisArea } from "./actions";
import { TaxDeadlines } from "@/components/TaxDeadlines";
import { ZoningPanel } from "@/components/ZoningPanel";
import { FloodPanel, SeismicPanel } from "@/components/HazardPanels";
import { NearbySitesPanel, NeighborhoodPanel } from "@/components/EnvironmentPanels";
import { WaterPanel } from "@/components/WaterPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
import { AppealCallout } from "@/components/AppealCallout";
import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { BrandMark } from "@/components/BrandMark";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pin: string }>;
}): Promise<Metadata> {
  const { pin } = await params;
  const sv = await getParcelCore(pin);
  const addr = titleCaseAddress(sv.value?.address ?? null);
  return {
    title: addr ? `${addr} — ParcelWatch` : `Parcel ${pin} — ParcelWatch`,
    description: addr
      ? `Property report for ${addr}: zoning, lot size, present use, and more — each with its source and date.`
      : "Property report — each figure with its source and date.",
  };
}

const formatInt = (n: number | null) => (n == null ? null : n.toLocaleString("en-US"));
const formatAcres = (n: number | null) => (n == null ? null : n.toFixed(2));
const formatUSD = (n: number | null | undefined) =>
  n == null ? null : `$${n.toLocaleString("en-US")}`;

export default async function ParcelPage({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const sv = await getParcelCore(pin);
  const p = sv.value;
  const assessment = p?.assessment ?? null;
  const propertyType = decodePropertyType(p?.propertyType ?? null);
  const taxCalendar = getTaxCalendar();
  const zoning = getZoningAnalysis(p?.zoningCode ?? null, p?.acres ?? null);
  const lat = p?.lat ?? null;
  const lon = p?.lon ?? null;
  const [flood, seismic, epa, water, neighborhood, councilActivity, compSv, saleSv] =
    await Promise.all([
      getFloodHazard(lat, lon),
      getSeismicActivity(lat, lon),
      getEpaSites(lat, lon),
      getWaterSystem(lat, lon),
      getNeighborhoodStats(lat, lon),
      getCouncilActivity(),
      p ? getComparables(p) : Promise.resolve(null),
      p ? getSaleComps(p) : Promise.resolve(null),
    ]);
  const needsCensusKey = !censusKeyConfigured();
  const recommendation = p
    ? buildRecommendation({
        assessedTotal: p.assessment?.appraisedTotal ?? null,
        sale: saleSv?.value ?? null,
        comp: compSv?.value ?? null,
      })
    : null;
  const findings = summarizeFindings({
    recommendation,
    flood: flood.value,
    seismic: seismic.value,
    epa: epa.value,
    councilCount: councilActivity.value?.length ?? 0,
    tax: taxCalendar.value,
  });

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          New search
        </Link>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1.5 text-sm text-pw-sub hover:text-pw-green"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Alerts
        </Link>
      </div>

      {!p ? (
        <section className="mt-6 rounded-xl border-[0.5px] border-pw-amber/40 bg-[#FBF4E8] p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-medium text-pw-ink">Parcel data unavailable</h1>
            <ProvenanceBadgeFor sourced={sv} />
          </div>
          <p className="text-sm text-pw-sub">
            We couldn&apos;t load parcel{" "}
            <span className="tabular-nums">{pin}</span> from King County right now.
            This may be a temporary outage or an unrecognized parcel number. Please
            try again shortly.
          </p>
        </section>
      ) : (
        <>
          <header className="mb-5 mt-5">
            <BrandMark className="mb-4" />
            <h1 className="font-serif text-3xl font-medium leading-tight text-pw-ink sm:text-4xl">
              {titleCaseAddress(p.address) ?? `Parcel ${p.pin}`}
            </h1>
            <p className="mt-1.5 text-sm text-pw-sub">
              {[titleCaseAddress(p.city), p.zip].filter(Boolean).join(" ")}
              {p.city || p.zip ? " · " : ""}
              <span className="tabular-nums">PIN {p.pin}</span>
            </p>
          </header>

          <ReportSummary findings={findings} />

          <div className="mt-6 flex flex-col gap-7">
            <ReportGroup label="Your money">
              <Panel title="Assessed value" icon={Landmark} sourced={sv}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <MetricTile
                      label="Total appraised"
                      value={formatUSD(assessment?.appraisedTotal) ?? "—"}
                      sub={assessment?.taxYear ? `${assessment.taxYear} tax year` : undefined}
                      tip={GLOSSARY.assessedValue}
                    />
                  </div>
                  <MetricTile
                    label="Land"
                    value={formatUSD(assessment?.appraisedLand) ?? "—"}
                  />
                  <MetricTile
                    label="Improvements"
                    value={formatUSD(assessment?.appraisedImprovement) ?? "—"}
                  />
                </div>
                <dl className="mt-3 divide-y-[0.5px] divide-pw-divider">
                  <Field
                    label="Levy jurisdiction"
                    value={assessment?.levyJurisdiction}
                    tip={GLOSSARY.levy}
                  />
                </dl>
                <PanelInsight>
                  This is the county&apos;s value used to calculate your property tax —
                  not a market appraisal. If it looks high next to comparable homes, the
                  appeal below can help lower your bill.
                </PanelInsight>
              </Panel>

              {recommendation && (
                <div id="appeal" className="scroll-mt-4">
                  <AppealCallout pin={p.pin} rec={recommendation} />
                </div>
              )}

              <div id="tax" className="scroll-mt-4">
                <TaxDeadlines sourced={taxCalendar} />
              </div>
            </ReportGroup>

            <ReportGroup label="The property">
              <Panel title="What you own" icon={Home} sourced={sv}>
                <dl className="divide-y-[0.5px] divide-pw-divider">
                  <Field label="Present use" value={p.presentUse} tip={GLOSSARY.presentUse} />
                  <Field
                    label="Property type"
                    value={
                      propertyType
                        ? `${propertyType.label} (${propertyType.code})`
                        : p.propertyType
                    }
                    tip={GLOSSARY.propertyType}
                  />
                  <Field label="Legal description" value={p.legalDescription} />
                </dl>
              </Panel>

              <Panel title="Lot" icon={Ruler} sourced={sv}>
                <dl className="divide-y-[0.5px] divide-pw-divider">
                  <Field label="Lot size" value={formatInt(p.lotSqFt)} suffix="sq ft" />
                  <Field label="Area" value={formatAcres(p.acres)} suffix="acres" />
                </dl>
              </Panel>

              <ZoningPanel sourced={zoning} />
            </ReportGroup>

            <ReportGroup label="Risks & site">
              <div id="flood" className="scroll-mt-4">
                <FloodPanel sourced={flood} />
              </div>

              <div id="seismic" className="scroll-mt-4">
                <SeismicPanel sourced={seismic} />
              </div>

              <div id="epa" className="scroll-mt-4">
                <NearbySitesPanel
                  title="EPA-regulated sites nearby"
                  icon={Factory}
                  sourced={epa}
                  noneMessage="No EPA-regulated facilities within 2 miles."
                  insight="Most EPA-listed sites are routine registrations — fuel tanks, dry cleaners, small facilities — not active contamination. Distance matters: a site next door is worth a closer look; one a mile or two away usually isn't."
                />
              </div>

              <WaterPanel
                parcelId={p.pin}
                lookup={water.value}
                provenance={{
                  source: water.source,
                  fetchedAt: water.fetchedAt,
                  confidence: water.confidence,
                }}
              />
            </ReportGroup>

            <ReportGroup label="Around you">
              <NeighborhoodPanel sourced={neighborhood} needsKey={needsCensusKey} />

              <div id="activity" className="scroll-mt-4">
                <ActivityPanel sourced={councilActivity} />
              </div>

              <form
                action={watchThisArea}
                className="rounded-xl border-[0.5px] border-pw-border bg-pw-inset p-4"
              >
                <input type="hidden" name="parcelId" value={p.pin} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-pw-sub">
                    Get an alert when the County Council acts on something near here.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-pw-green px-3.5 py-1.5 text-sm font-medium text-white hover:bg-pw-ink"
                  >
                    <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    Watch this area
                  </button>
                </div>
              </form>
            </ReportGroup>

            <section
              aria-label="Official county record"
              className="rounded-xl border-[0.5px] border-pw-border bg-pw-inset p-5"
            >
              <h2 className="text-[15px] font-medium text-pw-ink">
                Official county record
              </h2>
              <p className="mt-1.5 text-sm text-pw-sub">
                View the authoritative record and your live tax bill on King
                County&apos;s site — assessment history, sales, and the current
                balance owed.
              </p>
              <a
                href={eRealPropertyUrl(p.pin)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border-[0.5px] border-pw-green px-4 py-2 text-sm font-medium text-pw-green hover:bg-pw-accent/10"
              >
                Open King County eReal Property
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </section>
          </div>

          <footer className="mt-8 border-t-[0.5px] border-pw-divider pt-6 text-xs text-pw-faint">
            Every figure above is shown with its source and the date it was last
            refreshed. We display property data only — never information keyed to
            individuals by name.
          </footer>
        </>
      )}
    </main>
  );
}

/** A labelled group of panels — gives the report a money → property → risks →
 * context narrative instead of a flat, equal-weight stack. */
function ReportGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-pw-faint">
        {label}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
