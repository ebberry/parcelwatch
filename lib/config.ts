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
