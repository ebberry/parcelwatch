import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { verifyDigestToken } from "@/lib/digest/token";
import { setDigestOptOut } from "@/lib/digest/service";

export const metadata: Metadata = {
  title: "Unsubscribe — ParcelWatch",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe from the digest email. The link carries a keyed token so
 * it can't be forged. Setting opt-out is idempotent (safe to re-hit). Users can
 * re-enable any time from their dashboard.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string }>;
}) {
  const { u, t } = await searchParams;
  const ok = Boolean(u && t && verifyDigestToken(u, t));
  if (ok) await setDigestOptOut(u!, true);

  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <BrandMark className="mb-6" />
      {ok ? (
        <>
          <h1 className="font-serif text-2xl font-medium text-pw-ink">
            You&apos;re unsubscribed
          </h1>
          <p className="mt-2 text-sm text-pw-sub">
            We won&apos;t email you digest updates anymore. We&apos;ll still keep
            watching your property in the background — you can read everything any
            time on your dashboard, and turn emails back on there.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl font-medium text-pw-ink">
            Link not recognized
          </h1>
          <p className="mt-2 text-sm text-pw-sub">
            This unsubscribe link looks invalid or expired. You can manage email
            preferences from your dashboard.
          </p>
        </>
      )}
      <Link
        href="/dashboard"
        className="mt-5 inline-block text-sm text-pw-green hover:underline"
      >
        Go to your dashboard →
      </Link>
    </main>
  );
}
