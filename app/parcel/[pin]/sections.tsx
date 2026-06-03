import { Factory } from "lucide-react";
import type { ParcelCore } from "@/lib/adapters/kingcounty";
import { summarizeFindings } from "@/lib/report/summary";
import { getTaxCalendar } from "@/lib/tax/service";
import { ReportSummary } from "@/components/ReportSummary";
import { ParcelMap } from "@/components/ParcelMap";
import { AppealCallout } from "@/components/AppealCallout";
import { SiteRiskPanel } from "@/components/SiteRiskPanel";
import { GeoHazardsPanel } from "@/components/GeoHazardsPanel";
import { SmelterPlumePanel } from "@/components/SmelterPlumePanel";
import { FloodPanel, SeismicPanel } from "@/components/HazardPanels";
import { NearbySitesPanel, NeighborhoodPanel } from "@/components/EnvironmentPanels";
import { SepticPanel } from "@/components/SepticPanel";
import { ZoningPanel } from "@/components/ZoningPanel";
import { WaterPanel } from "@/components/WaterPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
import { WatchProperty } from "@/components/WatchProperty";
import { getSession } from "@/lib/auth";
import { getActiveWatchKinds } from "@/lib/watches/service";
import {
  loadFlood,
  loadSeismic,
  loadSiteRisk,
  loadGeoHazards,
  loadSoil,
  loadEpa,
  loadWater,
  loadNeighborhood,
  loadSeptic,
  loadBoundary,
  loadCouncil,
  loadRecommendation,
  loadZoning,
  loadSession,
  loadOwnerInputs,
} from "./loaders";

/**
 * Async, self-fetching report sections. Each renders inside its own <Suspense>
 * in the page, so a slow government endpoint streams in late without blocking
 * the rest of the report. Shared signals are deduped by the cache()'d loaders.
 */

export async function MapSection({ pin, address }: { pin: string; address: string | null }) {
  const boundary = await loadBoundary(pin);
  if (!boundary) return null;
  return (
    <div className="mb-6">
      <ParcelMap ring={boundary.ring} address={address} />
    </div>
  );
}

export async function SynthesisSection({ p, lat, lon }: { p: ParcelCore; lat: number | null; lon: number | null }) {
  const [recommendation, flood, seismic, siteRisk, geo, soil, epa, council] = await Promise.all([
    loadRecommendation(p),
    loadFlood(lat, lon),
    loadSeismic(lat, lon),
    loadSiteRisk(lat, lon),
    loadGeoHazards(lat, lon),
    loadSoil(lat, lon),
    loadEpa(lat, lon),
    loadCouncil(p.city),
  ]);
  const findings = summarizeFindings({
    recommendation,
    flood: flood.value,
    seismic: seismic.value,
    siteRisk: siteRisk.value,
    criticalAreas: geo.value?.criticalAreas ?? [],
    soil: soil.value,
    epa: epa.value,
    councilCount: council.value?.length ?? 0,
    tax: getTaxCalendar().value,
  });
  return <ReportSummary findings={findings} />;
}

export async function AppealSection({ p }: { p: ParcelCore }) {
  const recommendation = await loadRecommendation(p);
  if (!recommendation) return null;
  return (
    <div id="appeal" className="scroll-mt-4">
      <AppealCallout pin={p.pin} rec={recommendation} />
    </div>
  );
}

export async function SiteRiskSection({ lat, lon }: { lat: number | null; lon: number | null }) {
  const siteRisk = await loadSiteRisk(lat, lon);
  return <SiteRiskPanel sourced={siteRisk} />;
}

export async function GeoHazardsSection({ lat, lon }: { lat: number | null; lon: number | null }) {
  const geo = await loadGeoHazards(lat, lon);
  return <GeoHazardsPanel sourced={geo} />;
}

export async function SoilSection({
  pin,
  lat,
  lon,
}: {
  pin: string;
  lat: number | null;
  lon: number | null;
}) {
  const [soil, session] = await Promise.all([loadSoil(lat, lon), loadSession()]);
  const inputs = session ? await loadOwnerInputs(session.userId, pin) : {};
  return (
    <SmelterPlumePanel
      sourced={soil}
      parcelId={pin}
      signedIn={!!session}
      serverSoil={inputs.soil_arsenic_ppm ?? null}
    />
  );
}

export async function FloodSection({ lat, lon }: { lat: number | null; lon: number | null }) {
  const flood = await loadFlood(lat, lon);
  return <FloodPanel sourced={flood} />;
}

export async function SeismicSection({ lat, lon }: { lat: number | null; lon: number | null }) {
  const seismic = await loadSeismic(lat, lon);
  return <SeismicPanel sourced={seismic} />;
}

export async function EpaSection({ lat, lon }: { lat: number | null; lon: number | null }) {
  const epa = await loadEpa(lat, lon);
  return (
    <NearbySitesPanel
      title="EPA-regulated sites nearby"
      icon={Factory}
      sourced={epa}
      noneMessage="No EPA-regulated facilities within 2 miles."
      insight="Most EPA-listed sites are routine registrations — fuel tanks, dry cleaners, small facilities — not active contamination. Distance matters: a site next door is worth a closer look; one a mile or two away usually isn't."
    />
  );
}

export async function ZoningSection({
  lat,
  lon,
  acres,
  recordedCode,
}: {
  lat: number | null;
  lon: number | null;
  acres: number | null;
  recordedCode: string | null;
}) {
  const zoning = await loadZoning(lat, lon, acres, recordedCode);
  return <ZoningPanel sourced={zoning} />;
}

export async function SepticSection({ pin }: { pin: string }) {
  const septic = await loadSeptic(pin);
  return <SepticPanel sourced={septic} />;
}

export async function WaterSection({ pin, lat, lon }: { pin: string; lat: number | null; lon: number | null }) {
  const [water, session] = await Promise.all([loadWater(lat, lon), loadSession()]);
  const inputs = session ? await loadOwnerInputs(session.userId, pin) : {};
  return (
    <WaterPanel
      parcelId={pin}
      lookup={water.value}
      provenance={{ source: water.source, fetchedAt: water.fetchedAt, confidence: water.confidence }}
      signedIn={!!session}
      serverSaved={inputs.water_system ?? null}
    />
  );
}

export async function NeighborhoodSection({
  lat,
  lon,
  needsKey,
}: {
  lat: number | null;
  lon: number | null;
  needsKey: boolean;
}) {
  const neighborhood = await loadNeighborhood(lat, lon);
  return <NeighborhoodPanel sourced={neighborhood} needsKey={needsKey} />;
}

export async function ActivitySection({ city }: { city: string | null }) {
  const council = await loadCouncil(city);
  return <ActivityPanel sourced={council} />;
}

export async function WatchSection({ pin }: { pin: string }) {
  const session = await getSession();
  const active = session ? await getActiveWatchKinds(session.userId, pin) : new Set<string>();
  return <WatchProperty parcelId={pin} active={active} />;
}
