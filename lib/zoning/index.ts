/**
 * The "what can I do here?" zoning engine (project brief §7).
 *
 * Turns a raw King County zoning code + present-use into plain-language answers
 * to the questions residents actually ask (ADU? home business? subdivide? height?
 * setbacks?). Each answer returns a verdict AND a citation to the specific King
 * County Code section, plus an informational disclaimer. Never a legal
 * determination.
 *
 * Phase 0 defines the shape only. The rules module (keyed by zoning code) is
 * built in Phase 2, after the tax/assessment slice.
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
  /** Plain-language explanation. */
  explanation: string;
}

export const ZONING_DISCLAIMER =
  "Informational only — not a legal determination. Confirm with King County Permitting.";
