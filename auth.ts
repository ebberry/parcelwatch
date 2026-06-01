import { writeFileSync } from "node:fs";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

/**
 * Auth.js (NextAuth v5) — email magic-link, the chosen self-hosted provider
 * (keeps marginal cost ~$0; see /docs/DECISIONS.md). Sessions live in Postgres
 * via the Drizzle adapter.
 *
 * Dev email transport: the magic link is logged to the server console and
 * written to /tmp/parcelwatch-magic-link.txt instead of being emailed. A real
 * provider plugs in via EMAIL_SERVER (SMTP / Resend) for production — no other
 * code changes.
 *
 * Server-only. Never imported into a client component or Edge middleware (the
 * postgres driver + node:fs are Node-only). Route protection is done in pages
 * via auth(), not middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER ?? { host: "localhost", port: 1025 },
      from: process.env.EMAIL_FROM ?? "ParcelWatch <noreply@parcelwatch.local>",
      async sendVerificationRequest({ identifier, url }) {
        console.log(`\n🔑 ParcelWatch sign-in link for ${identifier}:\n   ${url}\n`);
        try {
          writeFileSync(
            "/tmp/parcelwatch-magic-link.txt",
            `${identifier}\n${url}\n`,
          );
        } catch {
          /* dev convenience only */
        }
      },
    }),
  ],
  pages: { signIn: "/signin", verifyRequest: "/signin?check=1" },
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
