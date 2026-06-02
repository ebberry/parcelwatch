"use client";

import { useState } from "react";
import { buildParcelMapView } from "@/lib/map/static";

/**
 * "This is your place." A static aerial of the parcel with its boundary drawn
 * on top. Keyless (King County orthos, Esri fallback over the same extent so
 * the overlay still aligns). Renders nothing when we have no usable geometry.
 */
export function ParcelMap({
  ring,
  address,
}: {
  ring: [number, number][] | null | undefined;
  address: string | null;
}) {
  const view = buildParcelMapView(ring);
  const [src, setSrc] = useState(view?.imageUrl);
  const [failed, setFailed] = useState(false);

  if (!view || failed) return null;

  return (
    <figure className="overflow-hidden rounded-xl border-[0.5px] border-pw-divider bg-pw-divider/30 shadow-sm">
      <div className="relative aspect-[3/2] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Aerial view of ${address ?? "the parcel"} with its boundary outlined`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => {
            if (src !== view.fallbackUrl) setSrc(view.fallbackUrl);
            else setFailed(true);
          }}
        />
        <svg
          viewBox={`0 0 ${view.width} ${view.height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <polygon
            points={view.polygonPoints}
            fill="rgba(255,255,255,0.12)"
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}
          />
        </svg>
      </div>
      <figcaption className="px-3 py-1.5 text-[11px] text-pw-faint">
        {view.attribution} · boundary from King County Assessor
      </figcaption>
    </figure>
  );
}
