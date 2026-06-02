/**
 * Plain-language explanations for the jargon on the report. The product reads
 * like prose, not a government spreadsheet — every code and term should be
 * self-explaining (user request, 2026-05-31).
 */

export const GLOSSARY = {
  pin: "Parcel Identification Number — King County's unique 10-digit ID for this piece of land.",
  presentUse:
    "How the county currently classifies the property's use for assessment — e.g. a single-family residence.",
  propertyType:
    "The broad assessment category the county files this property under. Codes: R = Residential, K = Condominium, C = Commercial, M = coal & mineral rights, T = Timber.",
  assessedValue:
    "The county's estimate of your property's value, updated annually and used to calculate your property tax. It is not an appraisal or sale price.",
  appraisedLand: "The county's value for the land alone, excluding any buildings.",
  appraisedImprovement:
    "The county's value for the buildings and other improvements on the land.",
  appraisedTotal: "Land value plus improvements — the total assessed value.",
  levy:
    "The combination of taxing districts (county, schools, fire, library, etc.) whose rates add up to your tax bill. The levy code identifies which districts apply to this parcel.",
  zoningCode:
    "The county's land-use designation that controls what can be built and done on the property.",
  floodZone:
    "FEMA's flood-risk category for this spot. Zone X = minimal risk; zones starting with A or V = high risk.",
  sfha:
    "Special Flood Hazard Area — a high-risk flood zone where flood insurance is typically required for a federally backed mortgage.",
  baseFloodElevation:
    "The height floodwater is expected to reach in a 1%-annual-chance ('100-year') flood. New building is usually required at or above this level.",
  firm:
    "Flood Insurance Rate Map — FEMA's official identifier for the flood map covering this area.",
  adu: "Accessory Dwelling Unit — a smaller second home on the same lot, such as a backyard cottage or in-law suite.",
  setback: "The minimum distance a building must be kept back from your property lines.",
  minLotArea:
    "The smallest lot size this zone allows — the figure that determines whether you can subdivide.",
  appeal:
    "A formal challenge to your assessed value, filed with the King County Board of Equalization.",
  liquefaction:
    "When strong shaking makes water-saturated soil briefly behave like a liquid, which can damage foundations. 'Susceptibility' is how prone the ground here is.",
  oss: "On-site Sewage System — a septic system that treats wastewater on your own property instead of a public sewer.",
  groupB:
    "A small private water system serving roughly 2–14 connections — common for rural clusters of homes, as opposed to a large utility (Group A).",
  criticalArea:
    "Land King County maps as environmentally sensitive — landslide, steep slope, erosion, wetland, and the like. Building there can carry extra requirements.",
  expectedAnnualLoss:
    "FEMA's modeled estimate of the average dollar loss per year from natural hazards for an area — a relative gauge, not a prediction for your specific home.",
  nriComposite:
    "FEMA's single 0–100 score combining 18 natural hazards for this census tract, expressed relative to the rest of the country.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  R: "Residential",
  K: "Condominium",
  C: "Commercial",
  M: "Coal & mineral rights",
  T: "Timber",
};

/** Decode a King County PROPTYPE code into a human label (verified 2026-05-31). */
export function decodePropertyType(
  code: string | null,
): { code: string; label: string } | null {
  if (!code) return null;
  const key = code.toUpperCase();
  return { code: key, label: PROPERTY_TYPE_LABELS[key] ?? "Other classification" };
}
