import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe-link token: a keyed HMAC of the user id, so the one-click
 * unsubscribe in a digest email can't be forged or enumerated. Not a session —
 * it only authorizes toggling that user's digest opt-out.
 */
function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret";
}

export function digestToken(userId: string): string {
  return createHmac("sha256", secret()).update(`digest:${userId}`).digest("hex").slice(0, 32);
}

export function verifyDigestToken(userId: string, token: string): boolean {
  const a = Buffer.from(digestToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
