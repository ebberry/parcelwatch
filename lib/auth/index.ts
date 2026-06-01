import { isFeatureEnabled } from "@/lib/config";
import { auth } from "@/auth";

/**
 * Auth abstraction. The rest of the app reads the current user through
 * getSession() — swappable behind this interface. Real auth is Auth.js
 * magic-link (see /auth.ts); when AUTH_ENABLED is off, a dev session keeps local
 * work frictionless.
 */

export interface Session {
  userId: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  if (!isFeatureEnabled("auth")) {
    return { userId: "dev-user", email: "dev@parcelwatch.local" };
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id, email: session.user.email ?? "" };
}
