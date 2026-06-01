import { isFeatureEnabled } from "@/lib/config";

/**
 * Auth is stubbed behind a feature flag for Phase 0.
 *
 * Chosen real implementation (Phase 6): Auth.js (NextAuth v5) email magic-link,
 * self-hosted — keeps marginal cost ~$0 to fit the $25/yr unit economics and
 * the privacy-by-design stance. Kept behind this thin interface so the provider
 * is swappable. See /docs/DECISIONS.md.
 */

export interface Session {
  userId: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  if (!isFeatureEnabled("auth")) {
    // Dev stub so protected routes are reachable locally without email setup.
    return { userId: "dev-user", email: "dev@parcelwatch.local" };
  }
  // TODO(Phase 6): wire Auth.js magic-link and read the real session here.
  return null;
}
