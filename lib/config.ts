/** Feature flags, driven by env. Keeps "pro"/auth/payments swappable. */

const FLAGS = {
  /** When false, auth is stubbed with a dev session (Phase 0). */
  auth: process.env.AUTH_ENABLED === "true",
  /** Stripe is never integrated until this is explicitly enabled (Phase 6). */
  payments: process.env.PAYMENTS_ENABLED === "true",
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}

/**
 * Features that will require a paid subscription once billing exists (decided
 * 2026-05-31): the standing watches + alerts and the assessed-value appeal tool.
 * The core parcel report stays free (SEO + word-of-mouth flywheel). Until Stripe
 * is wired (PAYMENTS_ENABLED), these are NOT paywalled — they're just gated by
 * sign-in where personalized. This list is the single source of truth for the
 * future paywall.
 */
export const PRO_FEATURES = ["watches", "alerts", "appeals"] as const;
