import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Mail } from "lucide-react";
import { signIn } from "@/auth";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Sign in — ParcelWatch",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string; callbackUrl?: string }>;
}) {
  const { check, callbackUrl } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-md px-5 py-12 sm:py-20">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-pw-green hover:underline"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Home
      </Link>

      <header className="mb-7 mt-6">
        <BrandMark className="mb-5" />
        <h1 className="font-serif text-3xl font-medium text-pw-ink">Sign in</h1>
        <p className="mt-2 text-sm text-pw-sub">
          Sign in to manage your watches and see alerts. We&apos;ll email you a
          secure link — no password to remember.
        </p>
      </header>

      {check ? (
        <div className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-6 text-center">
          <Mail
            className="mx-auto mb-3 h-9 w-9 text-pw-accent"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="font-medium text-pw-ink">Check your email</p>
          <p className="mt-1 text-sm text-pw-sub">
            We sent a sign-in link to your inbox. Click it to continue.
          </p>
          <p className="mt-3 text-xs text-pw-faint">
            Dev mode: the link is also printed in the server console and saved to{" "}
            <code className="rounded bg-pw-inset px-1">/tmp/parcelwatch-magic-link.txt</code>.
          </p>
        </div>
      ) : (
        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim();
            await signIn("nodemailer", {
              email,
              redirectTo: callbackUrl ?? "/dashboard",
            });
          }}
          className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
        >
          <label htmlFor="email" className="mb-1.5 block text-sm text-pw-sub">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3.5 py-2.5 text-base text-pw-ink placeholder:text-pw-faint"
          />
          <button
            type="submit"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-pw-green px-4 py-2.5 text-base font-medium text-white hover:bg-pw-ink"
          >
            <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Email me a sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
