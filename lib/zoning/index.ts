/**
 * The "what can I do here?" zoning engine (project brief §7).
 *
 * Turns a King County zoning code + lot size into plain-language answers to the
 * questions residents actually ask, each with a verdict, a King County Code
 * citation, and a "confirm with the county" disclaimer. NEVER a legal
 * determination.
 *
 * All citations verified against the CURRENT King County Code on 2026-05-31
 * (see /docs/data-sources.md). Note: the 2024 reorganization (Ord. 19881)
 * repealed the old 21A.12.030 dimensional table and moved rural-area standards
 * to KCC 21A.09T.030 — we cite the current section.
 *
 * Scope: detailed guidance is provided for the Rural Area (RA) zones that cover
 * Vashon / unincorporated King County. Other zones return "check with county"
 * rather than asserting unverified rules.
 */

export type ZoningVerdict =
  | "likely yes"
  | "conditional"
  | "check with county"
  | "no";

export interface ZoningAnswer {
  question: string;
  verdict: ZoningVerdict;
  /** Specific King County Code citation, e.g. "KCC 21A.08.030". */
  citation: string;
  explanation: string;
}

/** A dimensional fact (height, setback, min lot) — informational, not a verdict. */
export interface ZoningStandard {
  label: string;
  value: string;
  citation: string;
}

export interface ZoningAnalysis {
  /** The raw code as given, e.g. "RA-2.5-SO". */
  zoneCode: string;
  /** Base zone, e.g. "RA-2.5". */
  baseZone: string;
  zoneName: string;
  /** True when we have detailed verified rules for this zone (RA zones). */
  recognized: boolean;
  /**
   * When set, the parcel is inside this incorporated city, which sets its own
   * zoning — King County's Title 21A does NOT apply. The panel shows a
   * city-governed message instead of county standards.
   */
  governedBy?: string | null;
  answers: ZoningAnswer[];
  standards: ZoningStandard[];
  /** Overlay suffixes found on the code (meaning not asserted). */
  overlays: string[];
  notes: string[];
}

/**
 * Build the analysis for a parcel inside an incorporated city. King County
 * doesn't zone it, so we assert no county standards — we name the city as the
 * authority and (optionally) surface the county-recorded city code as a hint.
 */
export function incorporatedAnalysis(city: string, recordedCode?: string | null): ZoningAnalysis {
  const notes = [
    `This parcel is inside the City of ${city}, which sets its own zoning and land-use rules — King County's Title 21A does not apply here. Check with the City of ${city}'s planning or permitting department for the zoning and what it allows.`,
  ];
  if (recordedCode) {
    notes.push(
      `King County's assessment records list its city zoning as “${recordedCode}”, but the City of ${city} is the authority — confirm there.`,
    );
  }
  return {
    zoneCode: recordedCode ?? "—",
    baseZone: recordedCode ?? "—",
    zoneName: `City of ${city} zoning`,
    recognized: false,
    governedBy: city,
    answers: [],
    standards: [],
    overlays: [],
    notes,
  };
}

export const ZONING_DISCLAIMER =
  "Informational only — not a legal determination. Confirm with King County Permitting.";

/** Rural-area dimensional standards, verified from KCC 21A.09T.030 (2026-05-31). */
const RA_DIMENSIONS_CITATION = "KCC 21A.09T.030";
const ADU_CITATION = "KCC 21A.08.030.B.7";
const HOME_OCCUPATION_CITATION = "KCC 21A.30.085";

interface RaStandards {
  /** Minimum lot area in acres (KCC 21A.09T.030). */
  minLotAreaAc: number;
  /** Base building-height limit in feet. */
  baseHeightFt: number;
  streetSetbackFt: number;
  interiorSetbackFt: number;
}

const RA_STANDARDS: Record<string, RaStandards> = {
  "RA-2.5": { minLotAreaAc: 1.875, baseHeightFt: 40, streetSetbackFt: 30, interiorSetbackFt: 5 },
  "RA-5": { minLotAreaAc: 3.75, baseHeightFt: 40, streetSetbackFt: 30, interiorSetbackFt: 10 },
  "RA-10": { minLotAreaAc: 7.5, baseHeightFt: 40, streetSetbackFt: 30, interiorSetbackFt: 10 },
  "RA-20": { minLotAreaAc: 15, baseHeightFt: 40, streetSetbackFt: 30, interiorSetbackFt: 10 },
};

function fmtAc(n: number): string {
  // Exact for our table values; 2 decimals for computed/lot acreage.
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

/** Split a King County zoning code into its base zone and overlay suffixes. */
export function parseZone(raw: string): { base: string; overlays: string[] } {
  const code = raw.toUpperCase().trim();
  const ra = code.match(/^RA-(\d+(?:\.\d+)?)/);
  if (ra) {
    const base = `RA-${ra[1]}`;
    const overlays = code.slice(base.length).split("-").filter(Boolean);
    return { base, overlays };
  }
  const r = code.match(/^R-?(\d+)/);
  if (r) {
    const base = `R-${r[1]}`;
    const overlays = code.slice(r[0].length).split("-").filter(Boolean);
    return { base, overlays };
  }
  const other = code.match(/^[A-Z]+/);
  const base = other ? other[0] : code;
  const overlays = code.slice(base.length).split("-").filter(Boolean);
  return { base, overlays };
}

function zoneNameFor(base: string): string {
  if (base.startsWith("RA")) return "Rural Area";
  if (base.startsWith("R-")) return "Residential";
  if (base === "A") return "Agriculture";
  if (base === "F") return "Forest";
  if (base === "M") return "Mineral";
  if (base === "UR") return "Urban Reserve";
  return "King County zone";
}

function aduAnswer(std: RaStandards, acres: number | null): ZoningAnswer {
  let verdict: ZoningVerdict = "conditional";
  let lotNote = "";
  if (acres != null) {
    if (acres >= std.minLotAreaAc) {
      verdict = "likely yes";
      lotNote = ` Your lot (~${fmtAc(acres)} ac) appears to meet the zone's ~${fmtAc(std.minLotAreaAc)}-acre minimum, so a detached ADU may be possible.`;
    } else {
      lotNote = ` Your lot (~${fmtAc(acres)} ac) is below the ~${fmtAc(std.minLotAreaAc)}-acre minimum, so a detached ADU likely isn't allowed — but an attached ADU may be.`;
    }
  }
  return {
    question: "Can I add an accessory dwelling unit (ADU)?",
    verdict,
    citation: ADU_CITATION,
    explanation:
      `King County allows one ADU per lot in rural-area zones. ADUs are capped at about 1,000 sq ft heated plus 1,000 sq ft unheated, can't exceed the zone's base height, and require a notice recorded on the property title.${lotNote}`,
  };
}

function homeBusinessAnswer(): ZoningAnswer {
  return {
    question: "Can I run a home business?",
    verdict: "conditional",
    citation: HOME_OCCUPATION_CITATION,
    explanation:
      "Home occupations are allowed in rural-area zones as an accessory use, subject to standards — generally up to about 20% of your home's floor area, no more than three on-site non-resident employees, limited customer and delivery hours, and no significant added traffic.",
  };
}

function subdivideAnswer(std: RaStandards, acres: number | null): ZoningAnswer {
  if (acres == null) {
    return {
      question: "Can I subdivide?",
      verdict: "check with county",
      citation: RA_DIMENSIONS_CITATION,
      explanation:
        "Subdivision depends on your exact lot size relative to the zone's minimum lot area. Confirm with King County.",
    };
  }
  const threshold = 2 * std.minLotAreaAc;
  if (acres >= threshold) {
    return {
      question: "Can I subdivide?",
      verdict: "conditional",
      citation: RA_DIMENSIONS_CITATION,
      explanation:
        `Your lot (~${fmtAc(acres)} ac) is at least twice the zone's ~${fmtAc(std.minLotAreaAc)}-acre minimum lot area, so creating additional lots may be possible — subject to county review for road access, critical areas, water/septic, and clustering rules.`,
    };
  }
  return {
    question: "Can I subdivide?",
    verdict: "no",
    citation: RA_DIMENSIONS_CITATION,
    explanation:
      `Your lot (~${fmtAc(acres)} ac) is smaller than the ~${fmtAc(threshold)} acres generally needed to create two conforming lots in this zone (twice the ~${fmtAc(std.minLotAreaAc)}-acre minimum), so a standard subdivision is unlikely.`,
  };
}

/** Analyze what a parcel's zoning allows. `acres` enables lot-size-aware verdicts. */
export function analyzeZoning(
  zoningCode: string,
  acres: number | null,
): ZoningAnalysis {
  const { base, overlays } = parseZone(zoningCode);
  const std = RA_STANDARDS[base];
  const notes: string[] = [];
  if (overlays.length) {
    notes.push(
      `This parcel's zoning carries overlay code(s) "${overlays.join(", ")}", which may add restrictions we don't yet interpret. Confirm with King County.`,
    );
  }

  if (!std) {
    return {
      zoneCode: zoningCode,
      baseZone: base,
      zoneName: zoneNameFor(base),
      recognized: false,
      answers: [
        {
          question: "What can I do with this property?",
          verdict: "check with county",
          citation: "KCC Title 21A",
          explanation:
            `Detailed guidance is currently available for King County rural-area (RA) zones. For ${zoningCode}, confirm allowed uses and dimensional standards with King County Permitting.`,
        },
      ],
      standards: [],
      overlays,
      notes,
    };
  }

  if (acres != null && acres < 2.5) {
    notes.push(
      "On smaller RA lots, residential-zone setbacks may apply instead of the figures below — confirm with the county.",
    );
  }

  return {
    zoneCode: zoningCode,
    baseZone: base,
    zoneName: "Rural Area",
    recognized: true,
    answers: [
      aduAnswer(std, acres),
      homeBusinessAnswer(),
      subdivideAnswer(std, acres),
    ],
    standards: [
      { label: "Maximum building height", value: `${std.baseHeightFt} ft (base)`, citation: RA_DIMENSIONS_CITATION },
      { label: "Minimum street setback", value: `${std.streetSetbackFt} ft`, citation: RA_DIMENSIONS_CITATION },
      { label: "Minimum interior setback", value: `${std.interiorSetbackFt} ft`, citation: RA_DIMENSIONS_CITATION },
      { label: "Minimum lot area", value: `~${fmtAc(std.minLotAreaAc)} acres`, citation: RA_DIMENSIONS_CITATION },
    ],
    overlays,
    notes,
  };
}
