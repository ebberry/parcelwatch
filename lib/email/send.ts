import { writeFileSync } from "node:fs";
import nodemailer from "nodemailer";

/**
 * General transactional email sender — the same transport the magic-link auth
 * uses (Nodemailer + `EMAIL_SERVER`, which points at Resend SMTP in production).
 *
 * Mirrors auth.ts's dev fallback: when `EMAIL_SERVER` is unset (local dev) we
 * don't send — we log + write the message to /tmp so the whole flow is testable
 * with no mail service. Server-only (node:fs + nodemailer).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const FROM = process.env.EMAIL_FROM ?? "ParcelWatch <noreply@parcelwatch.local>";

export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean }> {
  const server = process.env.EMAIL_SERVER;
  if (!server) {
    // Dev: capture instead of sending, so digests are inspectable offline.
    const dump = `TO: ${msg.to}\nSUBJECT: ${msg.subject}\n\n${msg.text}\n`;
    console.log(`\n📧 ParcelWatch email (dev, not sent) →\n${dump}`);
    try {
      writeFileSync(`/tmp/parcelwatch-email-${msg.to.replace(/[^a-z0-9]/gi, "_")}.txt`, dump);
      writeFileSync(`/tmp/parcelwatch-email-latest.html`, msg.html);
    } catch {
      /* dev convenience only */
    }
    return { sent: false };
  }
  const transport = nodemailer.createTransport(server);
  await transport.sendMail({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
  return { sent: true };
}
