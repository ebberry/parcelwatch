import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "Offline — ParcelWatch" };

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-20 text-center">
      <div className="flex justify-center">
        <BrandMark />
      </div>
      <h1 className="mt-6 font-serif text-2xl font-medium text-pw-ink">
        You&apos;re offline
      </h1>
      <p className="mt-2 text-sm text-pw-sub">
        ParcelWatch needs a connection to pull live property data — we never show
        you stale figures. Reconnect and try again.
      </p>
    </main>
  );
}
