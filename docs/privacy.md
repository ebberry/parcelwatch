# Privacy by design

This is not a compliance afterthought — it is the product's core trust
differentiator. **ParcelWatch is not, and must never become, a people-search /
skip-trace tool.**

## What we display
Property, parcel, and built-environment data only:
- parcel geometry, lot size, present-use, zoning
- assessed value, land/building split, sale history of the *property*
- hazards/environment (flood, seismic, contaminated sites, shoreline/critical areas)
- taxes owed and to whom, deadlines
- nearby permits, recordings against the user's own parcel, relevant legislation

## What we never do
- No resident / occupant lookup, occupant history, or anything keyed to a third
  party **by name**.
- No phone, email, or personal-contact compilation.
- No selling or compiling public-record lists of individuals.

## Legal anchor
Washington's **RCW 42.56.070(9)** restricts using public-record lists of
individuals for commercial purposes. Respecting it is both legal hygiene and our
trust differentiator. When a government response includes **owner names**, we:
- store the **minimum** needed solely for the owner's **own** title-watch
  feature (owner-consented, owner's-parcel-only);
- **never** expose third parties' names in any UI, comparison, or alert;
- treat the comparison cards ("your assessment per sq ft vs. neighborhood
  median") as aggregate-only — no identifiable neighbor data.

## Enforcement in code
- The title/recorder watch (`/lib/watches`) is scoped to the authenticated
  owner's own parcel.
- Comparison features use medians/aggregates, not per-parcel third-party data.
- Any field carrying a person's name is dropped at the **normalize** step of an
  adapter unless it belongs to the requesting owner's own parcel.

## Honesty rules (related)
- Never invent data. Missing/unavailable → say so explicitly in the UI.
- Never claim "live" for cached data — show the real cache timestamp.
