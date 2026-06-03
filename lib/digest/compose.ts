/**
 * Compose the "what changed since you last looked" digest email — the recurring
 * touch that justifies a yearly subscription. Pure (no I/O), so it's fully
 * testable. Centered on the civic feed (council + legislation) the owner steered
 * toward; an "all quiet" month still gets a calm, reassuring note rather than
 * silence (the heartbeat keeps the product present).
 */

export interface DigestProperty {
  parcelId: string;
  address: string | null;
  city: string | null;
}

export interface DigestAlert {
  kind: string;
  title: string;
  detail: string | null;
  url: string | null;
  source: string;
}

export interface DigestInput {
  /** e.g. "this month" / "the past month". */
  periodLabel: string;
  properties: DigestProperty[];
  alerts: DigestAlert[];
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "13215 SW Tahlequah Rd" / "your 2 properties" / "your property". */
function subjectPlace(properties: DigestProperty[]): string {
  const withAddr = properties.filter((p) => p.address);
  if (withAddr.length === 1) return withAddr[0].address!;
  if (properties.length > 1) return `your ${properties.length} properties`;
  if (properties.length === 1) return "your property";
  return "your area";
}

const KIND_LABEL: Record<string, string> = {
  council: "County council",
  legislature: "State legislature",
  assessment: "Assessment",
  sales: "Nearby sale",
};

export function composeDigest(input: DigestInput): DigestEmail {
  const { periodLabel, properties, alerts, dashboardUrl, unsubscribeUrl } = input;
  const place = subjectPlace(properties);
  const n = alerts.length;

  const subject =
    n === 0
      ? `ParcelWatch — all quiet around ${place} ${periodLabel}`
      : `ParcelWatch — ${n} update${n === 1 ? "" : "s"} around ${place} ${periodLabel}`;

  const addrLine = properties
    .map((p) => [p.address, p.city].filter(Boolean).join(", "))
    .filter(Boolean)
    .join(" · ");

  // ---- Plain-text body ----
  const textLines: string[] = [];
  textLines.push(`ParcelWatch — what changed ${periodLabel}`);
  if (addrLine) textLines.push(addrLine);
  textLines.push("");
  if (n === 0) {
    textLines.push(
      `Nothing needed your attention ${periodLabel}. We checked the county council and state legislature for items affecting your area and found nothing new. We'll keep watching.`,
    );
  } else {
    textLines.push(`We spotted ${n} thing${n === 1 ? "" : "s"} worth a glance:`);
    textLines.push("");
    for (const a of alerts) {
      const label = KIND_LABEL[a.kind] ?? a.kind;
      textLines.push(`• [${label}] ${a.title}`);
      if (a.detail) textLines.push(`  ${a.detail}`);
      if (a.url) textLines.push(`  ${a.url}`);
    }
  }
  textLines.push("");
  textLines.push(`See everything on your dashboard: ${dashboardUrl}`);
  textLines.push("");
  textLines.push(
    "Every item links to its official source. We track property & local-government data only — never anything keyed to people by name.",
  );
  textLines.push(`Unsubscribe from these emails: ${unsubscribeUrl}`);
  const text = textLines.join("\n");

  // ---- HTML body (inline styles for email clients) ----
  const items =
    n === 0
      ? `<p style="margin:0;color:#5F5E5A;font-size:15px;line-height:1.6;">Nothing needed your attention ${esc(
          periodLabel,
        )}. We checked the county council and state legislature for items affecting your area and found nothing new — we'll keep watching.</p>`
      : alerts
          .map((a) => {
            const label = esc(KIND_LABEL[a.kind] ?? a.kind);
            const title = a.url
              ? `<a href="${esc(a.url)}" style="color:#0F6E56;text-decoration:none;">${esc(a.title)}</a>`
              : esc(a.title);
            const detail = a.detail
              ? `<div style="margin-top:4px;color:#5F5E5A;font-size:14px;line-height:1.5;">${esc(a.detail)}</div>`
              : "";
            return `<tr><td style="padding:14px 0;border-bottom:1px solid #E1F5EE;">
              <div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6B6A66;">${label} · ${esc(a.source)}</div>
              <div style="margin-top:4px;font-size:15px;font-weight:500;color:#04342C;">${title}</div>
              ${detail}
            </td></tr>`;
          })
          .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#E1F5EE;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #9FE1CB;border-radius:14px;">
    <tr><td style="padding:24px 24px 8px;">
      <div style="font-size:18px;font-weight:600;color:#0F6E56;">ParcelWatch</div>
      <h1 style="margin:8px 0 2px;font-size:20px;font-weight:600;color:#04342C;">What changed ${esc(periodLabel)}</h1>
      ${addrLine ? `<div style="color:#5F5E5A;font-size:14px;">${esc(addrLine)}</div>` : ""}
    </td></tr>
    <tr><td style="padding:8px 24px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${
        n === 0 ? `<tr><td style="padding:8px 0 16px;">${items}</td></tr>` : items
      }</table>
    </td></tr>
    <tr><td style="padding:8px 24px 24px;">
      <a href="${esc(dashboardUrl)}" style="display:inline-block;background:#0F6E56;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:500;padding:10px 18px;border-radius:9px;">Open your dashboard</a>
    </td></tr>
    <tr><td style="padding:16px 24px 22px;border-top:1px solid #E1F5EE;">
      <div style="color:#6B6A66;font-size:12px;line-height:1.6;">Every item links to its official source. We track property &amp; local-government data only — never anything keyed to people by name.</div>
      <div style="margin-top:8px;"><a href="${esc(unsubscribeUrl)}" style="color:#6B6A66;font-size:12px;">Unsubscribe from these emails</a></div>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
