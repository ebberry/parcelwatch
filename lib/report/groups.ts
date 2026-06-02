/** Slug rule shared by the server (ReportGroup ids) and the client nav links. */
export function groupSlug(label: string): string {
  return "sec-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
