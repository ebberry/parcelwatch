import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /** The session's user carries its database id (set in the session callback). */
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
