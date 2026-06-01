import { ParcelSearch } from "@/components/ParcelSearch";
import { BrandMark } from "@/components/BrandMark";

export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-12 sm:py-20">
      <header className="mb-9">
        <BrandMark className="mb-6" />
        <h1 className="font-serif text-3xl font-medium leading-tight text-pw-ink sm:text-4xl">
          Your property, explained — with the receipts.
        </h1>
        <p className="mt-4 text-base text-pw-sub">
          One trustworthy place to understand a specific address and what&apos;s
          changing around it. Every figure on screen shows its source and the date
          it was last refreshed.
        </p>
      </header>

      <section
        aria-labelledby="lookup-heading"
        className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5"
      >
        <h2 id="lookup-heading" className="mb-3 text-[15px] font-medium text-pw-ink">
          Look up an address
        </h2>
        <ParcelSearch />
      </section>

      <footer className="mt-12 border-t-[0.5px] border-pw-divider pt-6 text-xs text-pw-faint">
        We display property &amp; built-environment data only — never information
        keyed to individuals by name. Data sourced live from King County.
      </footer>
    </main>
  );
}
