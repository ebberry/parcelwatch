import type { Metadata } from "next";
import Link from "next/link";
import { getParcelCore } from "@/lib/parcels/service";
import { getComparables } from "@/lib/comps/service";
import { buildUniformityNarrative, EAPPEALS_URL, BOE_FORMS_URL } from "@/lib/appeals";
import { AppealBuilder } from "@/components/AppealBuilder";

export const metadata: Metadata = {
  title: "Prepare an assessment appeal — ParcelWatch",
  robots: { index: false }, // owner-facing prep tool, not a public page
};

export default async function AppealPage({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const sv = await getParcelCore(pin);
  const p = sv.value;

  if (!p) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-5 py-10">
        <Link href={`/parcel/${pin}`} className="text-sm text-confidence-live hover:underline">
          ← Back to report
        </Link>
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-gray-700">
          Parcel data for <span className="font-mono">{pin}</span> is unavailable,
          so we can&apos;t prepare an appeal right now. Please try again shortly.
        </p>
      </main>
    );
  }

  const compSv = await getComparables(p);
  const comp = compSv.value;
  const narrative = comp ? buildUniformityNarrative(comp) : null;

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-10">
      <Link href={`/parcel/${pin}`} className="text-sm text-confidence-live hover:underline">
        ← Back to report
      </Link>
      <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">
        Prepare an assessment appeal
      </h1>
      <p className="mt-2 text-gray-600">
        {p.address ?? `Parcel ${p.pin}`}
      </p>
      <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        We pre-fill the King County Board of Equalization petition with your
        property facts and comparable-assessment evidence. You review, then file
        it yourself through King County eAppeals — we never submit on your behalf.
        This is informational, not legal advice.
      </p>

      <AppealBuilder
        parcel={{
          pin: p.pin,
          address: p.address,
          land: p.assessment?.appraisedLand ?? null,
          improvements: p.assessment?.appraisedImprovement ?? null,
          total: p.assessment?.appraisedTotal ?? null,
          taxYear: p.assessment?.taxYear ?? null,
        }}
        comp={comp}
        compProvenance={{
          source: compSv.source,
          fetchedAt: compSv.fetchedAt,
          confidence: compSv.confidence,
        }}
        suggestedNarrative={narrative}
        eAppealsUrl={EAPPEALS_URL}
        boeFormsUrl={BOE_FORMS_URL}
      />
    </main>
  );
}
