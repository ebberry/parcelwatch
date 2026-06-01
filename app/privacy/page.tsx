import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Privacy — ParcelWatch",
  description:
    "ParcelWatch displays property and built-environment data only — never information keyed to individuals by name.",
};

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Home
      </Link>

      <header className="mb-6 mt-5">
        <BrandMark className="mb-4" />
        <h1 className="font-serif text-3xl font-medium text-pw-ink">
          Privacy by design
        </h1>
        <p className="mt-2 text-sm text-pw-sub">
          This isn&apos;t a compliance afterthought — it&apos;s the heart of the
          product.
        </p>
      </header>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-pw-sub">
        <section>
          <h2 className="mb-1 text-[15px] font-medium text-pw-ink">
            What we show
          </h2>
          <p>
            Property, parcel, and built-environment data only: lot size, zoning,
            present use, assessed value, hazards, taxes, and public legislation
            and permits relevant to a location. Every figure is shown with its
            source and the date it was last checked.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-[15px] font-medium text-pw-ink">
            What we never do
          </h2>
          <p>
            We are not, and never will be, a people-search or skip-trace tool. We
            do not display, collect, compile, or sell information keyed to a third
            party by name — no occupant lookups, no phone numbers, no email
            addresses. Washington&apos;s RCW 42.56.070(9) restricts using
            public-record lists of individuals for commercial purposes, and
            respecting it is both our legal posture and our reason for being.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-[15px] font-medium text-pw-ink">
            Your account
          </h2>
          <p>
            If you sign in, we store your email address to send you a secure
            sign-in link and to deliver the alerts you ask us to watch for. That
            is the only personal information we keep, and it is yours — we never
            sell it or share it.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-[15px] font-medium text-pw-ink">
            Honest freshness
          </h2>
          <p>
            We never invent data. When a source is unavailable or a figure is
            missing, we say so. We never claim data is &ldquo;live&rdquo; when
            it&apos;s served from a cache — the timestamp you see is the real one.
          </p>
        </section>
      </div>

      <footer className="mt-10 border-t-[0.5px] border-pw-divider pt-6 text-xs text-pw-faint">
        Questions about your data? Contact us at the address on our site.
      </footer>
    </main>
  );
}
