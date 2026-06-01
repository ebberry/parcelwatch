/**
 * Display formatting helpers. King County returns addresses in ALL CAPS; the
 * design system forbids all-caps, so we render proper address case
 * ("12825 SW Bachelor Rd") while keeping directionals and ordinals correct.
 */

const DIRECTIONALS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

function caseWord(word: string): string {
  const upper = word.toUpperCase();
  if (DIRECTIONALS.has(upper)) return upper; // SW, NE, …
  // Starts with a digit: 297TH -> 297th, 12825 unchanged.
  if (/^\d/.test(word)) return word.replace(/[A-Za-z]+$/, (m) => m.toLowerCase());
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Proper-case a US address or place name. Returns null/undefined unchanged. */
export function titleCaseAddress<T extends string | null | undefined>(s: T): T {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map(caseWord)
    .join(" ") as T;
}

/**
 * Proper-case an ALL-CAPS proper name (facility / water system), handling
 * hyphen and slash boundaries: "RICE/MEEKS WATER" -> "Rice/Meeks Water".
 */
export function titleCaseName<T extends string | null | undefined>(s: T): T {
  if (!s) return s;
  return s.replace(/[A-Za-z0-9]+/g, (w) => {
    if (/^\d/.test(w)) return w.replace(/[A-Za-z]+$/, (m) => m.toLowerCase());
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }) as T;
}
