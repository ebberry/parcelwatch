# ParcelWatch design system: "calm civic" aesthetic

The source of truth for look and feel. Implemented via Tailwind tokens
(`tailwind.config.ts`, the `pw` + `confidence` color scales), fonts (Lora serif
+ Inter sans in `app/layout.tsx`), and the primitives in `components/Panel.tsx`
(`Panel`, `MetricTile`, `StatusPill`, `Field`, `QuietNote`, `StatusStrip`) and
`components/ProvenanceBadge.tsx`.

---

## The feeling

A trustworthy public utility / an institution on the user's side. Calm, clear,
quietly authoritative. Not a flashy proptech startup, not a dated government
portal, and never a data-broker / people-search site. Restraint is the strategy:
the data is the hero — when in doubt, remove decoration rather than add it.

**Direction:** clean institutional structure (white cards, generous whitespace)
warmed with a deep forest-green palette and a single serif accent. Mobile-first,
single column, fast.

## Color (color carries meaning, never decoration)

Surfaces: `#FFFFFF` cards · `#F7FAF8` inset metric tiles · `#E1F5EE` page bg.
Greens: `#0F6E56` brand · `#04342C` ink (headlines + numbers) · `#1D9E75` accent
("all clear" dot). Borders 0.5px: `#9FE1CB` cards · `#E1F5EE` dividers. Text:
`#5F5E5A` secondary · `#888780` provenance. Attention (reserved): `#BA7517`
amber (live-data flags, approaching deadlines); red only for genuine alerts.

## Typography

Serif headline (the property address) — Lora, weight 500. Everything else: Inter,
**weights 400 / 500 only, never heavier**. Numbers use tabular figures. Sentence
case for UI copy (proper nouns/addresses are proper-cased, never ALL CAPS).

## The provenance badge (signature)

Every datum carries a recessed faint-grey line: `source · ●label · checked date`.
Three dot colors — `confirmed` green (`#1D9E75`), `live`/`needs-verify` amber
(`#BA7517`), `unavailable` grey. The dot is NEVER the only signal — a sentence-
case text label always accompanies it. (Internally we keep a 4th `stale` state,
rendered amber with the label "needs check".)

## Quiet states are a feature

On a calm parcel most panels say "all clear" in reassuring green (`QuietNote`),
never a blank that looks like a failed load. The top `StatusStrip` carries the
overall state.

## Layout

White cards, 0.5px green border, generous padding, rounded corners. Each panel:
title + small green outline icon (15–20px), optional status pill on the right,
plain content, provenance line at the bottom. Metric tiles for assessed value.
Lead with prose and cards, not maps (maps only for genuinely spatial views).

## Accessibility (non-negotiable)

WCAG 2.1 AA: semantic HTML, keyboard navigable, sufficient contrast, SR labels,
and never color alone (the badge's text label satisfies this for confidence).
