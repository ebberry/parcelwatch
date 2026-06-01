import type { ParcelCore } from "@/lib/adapters/kingcounty/parcel";

/**
 * Jurisdiction / area resolution — turns a parcel into the civic context the AI
 * judges relevance against, plus the Legistar councils that govern it. This is
 * what makes "city enrichment" correct: a Seattle ordinance is relevant to a
 * Seattle parcel and irrelevant ("none") to a Vashon one, because each parcel
 * carries its own area.
 *
 * First market is Vashon (unincorporated — county + state only). Incorporated
 * parcels add their city council when that city is on Legistar (verified:
 * Seattle, Bellevue, Redmond; others fall back to county + state).
 */

export interface LegistarCouncil {
  /** Legistar client slug, e.g. "kingcounty", "seattle". */
  client: string;
  /** Human label for provenance + alerts. */
  label: string;
}

export interface AreaContext {
  /** Stable cache key — AI insights are cached per (item, areaKey). */
  key: string;
  /** Plain-English description of the homeowner, fed to the model. */
  description: string;
  /** Councils whose legislation applies here (county always; city if any). */
  councils: LegistarCouncil[];
}

const KING_COUNTY: LegistarCouncil = { client: "kingcounty", label: "King County Council" };

/** Cities verified live on the Legistar API (Rule #1, 2026-06-01). */
const LEGISTAR_CITIES: Record<string, { client: string; label: string; description: string }> = {
  SEATTLE: { client: "seattle", label: "Seattle City Council", description: "the City of Seattle" },
  BELLEVUE: { client: "bellevue", label: "Bellevue City Council", description: "the City of Bellevue" },
  REDMOND: { client: "redmond", label: "Redmond City Council", description: "the City of Redmond" },
};

/** Resolve a parcel to its civic area. Falls back to unincorporated county. */
export function resolveArea(parcel: Pick<ParcelCore, "city">): AreaContext {
  const city = (parcel.city ?? "").trim().toUpperCase();

  if (city === "VASHON") {
    return {
      key: "kc-vashon",
      description:
        "a residential property owner on Vashon Island, in unincorporated King County, Washington — an island community reached only by ferry, separate from the county's mainland cities (Seattle, Shoreline, Bellevue, Kent, etc.)",
      councils: [KING_COUNTY],
    };
  }

  const cityDef = LEGISTAR_CITIES[city];
  if (cityDef) {
    return {
      key: cityDef.client,
      description: `a residential property owner in ${cityDef.description}, King County, Washington`,
      councils: [
        { client: cityDef.client, label: cityDef.label },
        KING_COUNTY,
      ],
    };
  }

  return {
    key: "kc-unincorporated",
    description:
      "a residential property owner in unincorporated King County, Washington (not within any city limits)",
    councils: [KING_COUNTY],
  };
}
