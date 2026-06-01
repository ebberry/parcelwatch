/**
 * Topics a watch can track — the keywords that make a piece of legislation or a
 * council agenda item relevant to a Vashon / rural King County property owner.
 * Keyword matching is case-insensitive against item titles.
 */

export interface Topic {
  key: string;
  label: string;
  keywords: string[];
}

export const TOPICS: Topic[] = [
  { key: "rural", label: "Rural & unincorporated", keywords: ["rural", "unincorporated"] },
  { key: "vashon", label: "Vashon / Maury Island", keywords: ["vashon", "maury"] },
  { key: "septic", label: "Septic & wastewater", keywords: ["septic", "on-site sewage", "onsite sewage", "wastewater"] },
  { key: "shoreline", label: "Shoreline & critical areas", keywords: ["shoreline", "critical area", "wetland", "floodplain"] },
  { key: "adu", label: "ADUs & housing", keywords: ["accessory dwelling", "adu", "cottage housing", "missing middle"] },
  { key: "property-tax", label: "Property tax & assessment", keywords: ["property tax", "property valuation", "levy", "assessor", "assessment", "board of equalization"] },
];

const TOPIC_BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));

export function topicLabel(key: string): string {
  return TOPIC_BY_KEY.get(key)?.label ?? key;
}

/** Return the keys of every topic whose keywords appear in the text. */
export function matchTopics(text: string | null | undefined): string[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  return TOPICS.filter((t) => t.keywords.some((k) => haystack.includes(k))).map(
    (t) => t.key,
  );
}
