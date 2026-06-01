import type { Metadata } from "next";
import Link from "next/link";
import { getParcelCore } from "@/lib/parcels/service";
import { ReportPanel, Field } from "@/components/ReportPanel";
import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { ZONING_DISCLAIMER } from "@/lib/zoning";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pin: string }>;
}): Promise<Metadata> {
  const { pin } = await params;
  const sv = await getParcelCore(pin);
  const addr = sv.value?.address;
  return {
    title: addr
      ? `${addr} — ParcelWatch`
      : `Parcel ${pin} — ParcelWatch`,
    description: addr
      ? `Property report for ${addr}: zoning, lot size, present use, and more — each with its source and date.`
      : "Property report — each figure with its source and date.",
  };
}

function formatInt(n: number | null): string | null {
  return n == null ? null : n.toLocaleString("en-US");
}

function formatAcres(n: number | null): string | null {
  return n == null ? null : n.toFixed(2);
}

export default async function ParcelPage({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const sv = await getParcelCore(pin);
  const p = sv.value;

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/"
        className="text-sm text-confidence-live hover:underline"
      >
        ← New search
      </Link>

      {!p ? (
        // Graceful degradation — honest about an unavailable source, never blank.
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold">Parcel data unavailable</h1>
            <ProvenanceBadgeFor sourced={sv} />
          </div>
          <p className="text-sm text-gray-700">
            We couldn&apos;t load parcel{" "}
            <span className="font-mono">{pin}</span> from King County right now.
            This may be a temporary outage or an unrecognized parcel number.
            Please try again shortly.
          </p>
        </section>
      ) : (
        <>
          <header className="mb-6 mt-4">
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {p.address ?? `Parcel ${p.pin}`}
            </h1>
            <p className="mt-1 text-gray-600">
              {[p.city, p.zip].filter(Boolean).join(" ")}
              {p.city || p.zip ? " · " : ""}PIN {p.pin}
            </p>
          </header>

          <div className="flex flex-col gap-5">
            <ReportPanel title="What you own" sourced={sv}>
              <Field label="Present use" value={p.presentUse} />
              <Field
                label="Property type"
                value={p.propertyType}
              />
              <Field label="Legal description" value={p.legalDescription} />
            </ReportPanel>

            <ReportPanel title="Lot" sourced={sv}>
              <Field
                label="Lot size"
                value={formatInt(p.lotSqFt)}
                suffix="sq ft"
              />
              <Field label="Area" value={formatAcres(p.acres)} suffix="acres" />
            </ReportPanel>

            <ReportPanel title="Zoning" sourced={sv}>
              <Field label="Zoning code" value={p.zoningCode} />
              <p className="pt-3 text-xs text-gray-500">
                Plain-language answers to “what can I build here?” (ADU,
                subdivision, setbacks) arrive with the zoning engine in a later
                release. {ZONING_DISCLAIMER}
              </p>
            </ReportPanel>
          </div>

          <footer className="mt-8 border-t border-gray-100 pt-6 text-xs text-gray-400">
            Every figure above is shown with its source and the date it was last
            refreshed. We display property data only — never information keyed to
            individuals by name.
          </footer>
        </>
      )}
    </main>
  );
}
