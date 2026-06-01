/**
 * The brand mark: a green-square logo icon + "ParcelWatch" wordmark. A quiet,
 * civic-seal feel — the green square with a simple parcel/house glyph.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md bg-pw-green"
        aria-hidden="true"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* a roof over a plot — house on a parcel */}
          <path d="M4 11l8-6 8 6" />
          <path d="M6 10v8h12v-8" />
          <path d="M10 18v-4h4v4" />
        </svg>
      </span>
      <span className="text-sm font-medium tracking-tight text-pw-green">
        ParcelWatch
      </span>
    </div>
  );
}
