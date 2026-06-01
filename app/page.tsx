import { ParcelSearch } from "@/components/ParcelSearch";

export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-12 sm:py-20">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-confidence-live">
          ParcelWatch
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Your property, explained — with the receipts.
        </h1>
        <p className="mt-4 text-base text-gray-600">
          One trustworthy place to understand a specific address and what&apos;s
          changing around it. Every figure on screen shows its source and the
          date it was last refreshed.
        </p>
      </header>

      <section
        aria-labelledby="lookup-heading"
        className="rounded-xl border border-gray-200 p-5"
      >
        <h2 id="lookup-heading" className="mb-3 text-lg font-semibold">
          Look up an address
        </h2>
        <ParcelSearch />
      </section>

      <footer className="mt-12 border-t border-gray-100 pt-6 text-xs text-gray-400">
        We display property &amp; built-environment data only — never information
        keyed to individuals by name. Data sourced live from King County.
      </footer>
    </main>
  );
}
