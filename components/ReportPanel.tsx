/**
 * Back-compat surface: the report panels were built on ReportPanel + Field.
 * Both now live in the "calm civic" primitives (components/Panel.tsx); the
 * provenance line renders in the panel footer.
 */
export { Panel as ReportPanel, Field } from "@/components/Panel";
