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
 * Email transport: when EMAIL_SERVER is set (production — SMTP / Resend), the
 * Nodemailer provider sends the magic link for real. When it's NOT set (local
 * dev), we override to log the link to the console + /tmp/parcelwatch-magic-link.txt
 * so the flow is testable with no email service.
 *
 * Server-only. Never imported into a client component or Edge middleware (the
 * postgres driver + node:fs are Node-only). Route protection is done in pages
 * via auth(), not middleware. trustHost: true because we run behind a reverse
 * proxy (Caddy) in production, not on Vercel.
 */
const hasMailServer = Boolean(process.env.EMAIL_SERVER);

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
      // Dev only: log/write the link instead of emailing. With EMAIL_SERVER set,
      // the default transport actually sends.
      ...(hasMailServer
        ? {}
        : {
            async sendVerificationRequest({ identifier, url }) {
              console.log(
                `\n🔑 ParcelWatch sign-in link for ${identifier}:\n   ${url}\n`,
              );
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
    }),
  ],
  pages: { signIn: "/signin", verifyRequest: "/signin?check=1" },
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
