import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  Home,
  Landmark,
  Ruler,
  Factory,
  Scale as ScaleIcon,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { getParcelCore } from "@/lib/parcels/service";
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
import { Panel, Field, MetricTile, StatusStrip } from "@/components/Panel";
import { TaxDeadlines } from "@/components/TaxDeadlines";
import { ZoningPanel } from "@/components/ZoningPanel";
import { FloodPanel, SeismicPanel } from "@/components/HazardPanels";
import { NearbySitesPanel, NeighborhoodPanel } from "@/components/EnvironmentPanels";
import { WaterPanel } from "@/components/WaterPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
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
  const [flood, seismic, epa, water, neighborhood, councilActivity] =
    await Promise.all([
      getFloodHazard(lat, lon),
      getSeismicActivity(lat, lon),
      getEpaSites(lat, lon),
      getWaterSystem(lat, lon),
      getNeighborhoodStats(lat, lon),
      getCouncilActivity(),
    ]);
  const needsCensusKey = !censusKeyConfigured();
  const inFloodHazard = flood.value?.inSFHA === true;

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        New search
      </Link>

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

          <StatusStrip tone={inFloodHazard ? "attention" : "clear"}>
            {inFloodHazard
              ? "Heads up — this parcel sits in a high-risk flood area."
              : "All clear — nothing here needs your attention today."}
          </StatusStrip>

          <div className="mt-5 flex flex-col gap-4">
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
            </Panel>

            <Panel title="Lot" icon={Ruler} sourced={sv}>
              <dl className="divide-y-[0.5px] divide-pw-divider">
                <Field label="Lot size" value={formatInt(p.lotSqFt)} suffix="sq ft" />
                <Field label="Area" value={formatAcres(p.acres)} suffix="acres" />
              </dl>
            </Panel>

            <ZoningPanel sourced={zoning} />

            <FloodPanel sourced={flood} />

            <SeismicPanel sourced={seismic} />

            <NearbySitesPanel
              title="EPA-regulated sites nearby"
              icon={Factory}
              sourced={epa}
              noneMessage="No EPA-regulated facilities within 2 miles."
            />

            <WaterPanel
              parcelId={p.pin}
              lookup={water.value}
              provenance={{
                source: water.source,
                fetchedAt: water.fetchedAt,
                confidence: water.confidence,
              }}
            />

            <NeighborhoodPanel sourced={neighborhood} needsKey={needsCensusKey} />

            <ActivityPanel sourced={councilActivity} />

            <TaxDeadlines sourced={taxCalendar} />

            <section
              aria-label="Appeal your assessment"
              className="rounded-xl border-[0.5px] border-pw-border bg-pw-accent/10 p-5"
            >
              <h2 className="flex items-center gap-2 text-[15px] font-medium text-pw-ink">
                <ScaleIcon className="h-[18px] w-[18px] text-pw-accent" strokeWidth={1.75} aria-hidden="true" />
                Think your assessment is too high?
              </h2>
              <p className="mt-1.5 text-sm text-pw-sub">
                We&apos;ll pre-fill the Board of Equalization petition with your
                property facts and comparable-assessment evidence — you review and
                file it through King County eAppeals.
              </p>
              <Link
                href={`/parcel/${p.pin}/appeal`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-pw-green px-4 py-2 text-sm font-medium text-white hover:bg-pw-ink"
              >
                Prepare an assessment appeal
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </section>

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
