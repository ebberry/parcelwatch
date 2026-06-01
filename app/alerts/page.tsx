import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAlerts, getUnreadAlertCount } from "@/lib/watches/service";
import { topicLabel } from "@/lib/watches";
import { AlertsFeed } from "@/components/AlertsFeed";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Alerts — ParcelWatch",
  robots: { index: false },
};

function shortDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AlertsPage() {
  const session = await getSession();
  const [alerts, unread] = await Promise.all([
    getAlerts(session!.userId, 50),
    getUnreadAlertCount(session!.userId),
  ]);

  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Home
      </Link>

      <header className="mb-6 mt-5">
        <BrandMark className="mb-4" />
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-serif text-3xl font-medium text-pw-ink">
            <Bell className="h-7 w-7 text-pw-accent" strokeWidth={1.5} aria-hidden="true" />
            Your alerts
          </h1>
          {unread > 0 && (
            <span className="rounded-full bg-pw-amber px-2.5 py-0.5 text-sm font-medium text-white">
              {unread} new
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-pw-sub">
          Changes and new items from your standing watches — King County Council
          legislation and more.
        </p>
      </header>

      {alerts.length === 0 ? (
        <div className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-6 text-center">
          <Bell
            className="mx-auto mb-3 h-10 w-10 text-pw-accent/40"
            strokeWidth={1.25}
            aria-hidden="true"
          />
          <p className="font-medium text-pw-ink">No alerts yet</p>
          <p className="mt-1 text-sm text-pw-sub">
            Your watches will surface new council legislation and other changes
            that affect this area. Check back after the next poll.
          </p>
        </div>
      ) : (
        <AlertsFeed alerts={alerts} />
      )}
    </main>
  );
}
