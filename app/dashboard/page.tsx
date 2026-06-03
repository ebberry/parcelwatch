import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Home, Search } from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/auth";
import {
  getWatchedParcels,
  getAlerts,
  getUnreadAlertCount,
} from "@/lib/watches/service";
import { getParcelCore } from "@/lib/parcels/service";
import { getComparables } from "@/lib/comps/service";
import { getSaleComps } from "@/lib/sales/service";
import { buildRecommendation } from "@/lib/appeals";
import { titleCaseAddress } from "@/lib/format";
import { getDigestState } from "@/lib/digest/service";
import { AlertsFeed } from "@/components/AlertsFeed";
import { PropertyCard, type DashboardProperty } from "@/components/PropertyCard";
import { EmailPreferences } from "@/components/EmailPreferences";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Your dashboard — ParcelWatch",
  robots: { index: false },
};

// Per-user, session + DB backed — never prerender at build.
export const dynamic = "force-dynamic";

/** Load one watched property's facts + appeal signal (resilient to outages). */
async function loadProperty(
  parcelId: string,
  activeKinds: string[],
): Promise<DashboardProperty> {
  const core = (await getParcelCore(parcelId)).value;
  let recommendation: DashboardProperty["recommendation"] = null;
  if (core) {
    const [comp, sale] = await Promise.all([getComparables(core), getSaleComps(core)]);
    recommendation = buildRecommendation({
      assessedTotal: core.assessment?.appraisedTotal ?? null,
      comp: comp.value,
      sale: sale.value,
    });
  }
  return {
    parcelId,
    address: titleCaseAddress(core?.address ?? null),
    city: titleCaseAddress(core?.city ?? null),
    assessedTotal: core?.assessment?.appraisedTotal ?? null,
    activeKinds,
    recommendation,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  const [watched, alerts, unread, digest] = await Promise.all([
    getWatchedParcels(session.userId),
    getAlerts(session.userId, 20),
    getUnreadAlertCount(session.userId),
    getDigestState(session.userId),
  ]);

  const properties = await Promise.all(
    watched.map((w) => loadProperty(w.parcelId, w.activeKinds)),
  );

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          New search
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1.5 text-sm text-pw-sub hover:text-pw-green"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Alerts
            {unread > 0 && (
              <span className="rounded-full bg-pw-amber px-1.5 text-xs font-medium text-white">
                {unread}
              </span>
            )}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="text-sm text-pw-sub hover:text-pw-green">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <header className="mb-6 mt-5">
        <BrandMark className="mb-4" />
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium text-pw-ink">
          <Home className="h-7 w-7 text-pw-accent" strokeWidth={1.5} aria-hidden="true" />
          Your properties
        </h1>
        <p className="mt-1 text-xs text-pw-faint">Signed in as {session.email}</p>
      </header>

      {/* Lead with what changed — the reason to come back. */}
      <section className="mb-6">
        {unread > 0 ? (
          <a
            href="#changed"
            className="block rounded-xl border-[0.5px] border-pw-amber/40 bg-[#FBF4E8] px-4 py-3 transition-colors hover:bg-[#F8EEDC]"
          >
            <p className="text-sm font-medium text-pw-ink">
              {unread} new update{unread === 1 ? "" : "s"} since you last looked
            </p>
            <p className="mt-0.5 text-sm text-pw-sub">
              See what&apos;s changed around your propert
              {properties.length === 1 ? "y" : "ies"} →
            </p>
          </a>
        ) : (
          <div className="rounded-xl border-[0.5px] border-pw-border bg-pw-inset px-4 py-3">
            <p className="text-sm text-pw-sub">
              You&apos;re all caught up — nothing new since your last visit. We send
              a monthly summary by email and keep watching in between.
            </p>
          </div>
        )}
      </section>

      {properties.length === 0 ? (
        <section className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-6 text-center">
          <Home className="mx-auto mb-3 h-10 w-10 text-pw-accent/40" strokeWidth={1.25} aria-hidden="true" />
          <p className="font-medium text-pw-ink">No saved properties yet</p>
          <p className="mt-1 text-sm text-pw-sub">
            Look up your address, then choose &ldquo;Watch this property&rdquo; to
            track assessment changes, nearby sales, and local government activity.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-pw-green px-4 py-2 text-sm font-medium text-white hover:bg-pw-ink"
          >
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Find your property
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {properties.map((p) => (
            <PropertyCard key={p.parcelId} property={p} />
          ))}
        </div>
      )}

      {/* What's changed */}
      <section id="changed" className="mt-9 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-pw-ink">
            <Bell className="h-[18px] w-[18px] text-pw-accent" strokeWidth={1.75} aria-hidden="true" />
            What&apos;s changed
          </h2>
          {alerts.length > 0 && (
            <Link href="/alerts" className="text-sm text-pw-green hover:underline">
              All alerts
            </Link>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="rounded-xl border-[0.5px] border-pw-border bg-pw-inset px-4 py-3 text-sm text-pw-sub">
            Nothing new yet. We&apos;ll alert you here when your assessment changes,
            a comparable sells nearby, or your governments act on something relevant.
          </p>
        ) : (
          <AlertsFeed alerts={alerts} />
        )}
      </section>

      <EmailPreferences optOut={digest.optOut} lastDigestAt={digest.lastDigestAt} />
    </main>
  );
}
