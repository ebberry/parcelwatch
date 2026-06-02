"use client";

import { useEffect, useState } from "react";
import { Unavailable } from "@/components/Unavailable";
import { Droplets, Search } from "lucide-react";
import { Panel } from "@/components/Panel";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { titleCaseName } from "@/lib/format";
import type { Confidence } from "@/lib/provenance";
import type { WaterLookup, WaterSystem } from "@/lib/environment/service";

interface Match {
  pwsId: string;
  name: string;
  group: string | null;
  status: string | null;
  city: string | null;
}

/** What the owner saved for this parcel (picked from search, or typed). */
interface Saved {
  name: string;
  group: string | null;
  status: string | null;
  manual: boolean;
}

function SystemRows({
  group,
  type,
  status,
  ownership,
  connections,
}: Partial<WaterSystem>) {
  const rows: [string, string | number | null | undefined][] = [
    ["Group", group ? `Group ${group}` : null],
    ["Type", type],
    ["Status", status],
    ["Ownership", ownership],
    ["Connections", connections != null ? connections.toLocaleString() : null],
  ];
  const present = rows.filter(([, v]) => v != null && v !== "");
  if (!present.length) return null;
  return (
    <dl className="mt-2 divide-y-[0.5px] divide-pw-divider">
      {present.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-pw-sub">{k}</dt>
          <dd className="text-right font-medium tabular-nums text-pw-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WaterPanel({
  parcelId,
  lookup,
  provenance,
}: {
  parcelId: string;
  lookup: WaterLookup | null;
  provenance: { source: string; fetchedAt: string | null; confidence: Confidence };
}) {
  const storageKey = `pw:water:${parcelId}`;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSaved(JSON.parse(raw) as Saved);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function persist(s: Saved) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      /* ignore */
    }
    setSaved(s);
    setSearchOpen(false);
    setMatches(null);
    setQuery("");
  }

  function clearSaved() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setSaved(null);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/water/search?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as { matches?: Match[] };
      setMatches(data.matches ?? []);
    } catch {
      setMatches([]);
    }
    setLoading(false);
  }

  function SearchUI() {
    return (
      <div className="mt-3">
        <form onSubmit={runSearch} className="flex gap-2">
          <label htmlFor={`${storageKey}-q`} className="sr-only">
            Search water systems by name
          </label>
          <input
            id={`${storageKey}-q`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by water system name…"
            className="flex-1 rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-sm text-pw-ink placeholder:text-pw-faint"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg bg-pw-green px-3 py-2 text-sm font-medium text-white hover:bg-pw-ink disabled:opacity-50"
          >
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {loading ? "…" : "Search"}
          </button>
        </form>

        {matches && matches.length > 0 && (
          <ul className="mt-2 divide-y-[0.5px] divide-pw-divider overflow-hidden rounded-lg border-[0.5px] border-pw-border">
            {matches.map((m) => (
              <li key={m.pwsId || m.name}>
                <button
                  type="button"
                  onClick={() =>
                    persist({ name: m.name, group: m.group, status: m.status, manual: false })
                  }
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-pw-inset"
                >
                  <span className="text-pw-ink">{titleCaseName(m.name)}</span>
                  <span className="shrink-0 text-xs text-pw-faint">
                    {[m.group ? `Group ${m.group}` : null, titleCaseName(m.city)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {matches && matches.length === 0 && (
          <p className="mt-2 text-sm text-pw-sub">
            No water systems matched. You can enter the name manually below.
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            const name = query.trim();
            if (name.length >= 2)
              persist({ name, group: null, status: null, manual: true });
          }}
          className="mt-2 text-sm text-pw-green hover:underline disabled:text-pw-faint"
          disabled={query.trim().length < 2}
        >
          Can&apos;t find it? Use “{query.trim() || "your system"}” as entered →
        </button>
      </div>
    );
  }

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (saved) {
    body = (
      <>
        <p className="text-base font-medium text-pw-ink">{titleCaseName(saved.name)}</p>
        <SystemRows group={saved.group} status={saved.status} />
      </>
    );
    footer = (
      <div className="mt-4 flex items-center justify-between border-t-[0.5px] border-pw-divider pt-3">
        <span className="text-xs text-pw-faint">
          {saved.manual ? "Added by you" : "Selected by you"}
        </span>
        <button
          type="button"
          onClick={clearSaved}
          className="text-xs text-pw-green hover:underline"
        >
          Change
        </button>
      </div>
    );
  } else if (lookup == null) {
    body = <Unavailable source={provenance.source} />;
    footer = <ProvenanceFooter {...provenance} />;
  } else if (lookup.found && lookup.system) {
    const s = lookup.system;
    body = (
      <>
        <p className="text-base font-medium text-pw-ink">{titleCaseName(s.name)}</p>
        <SystemRows {...s} />
      </>
    );
    footer = <ProvenanceFooter {...provenance} />;
  } else {
    body = (
      <>
        <p className="text-sm text-pw-sub">
          <span className="font-medium text-pw-ink">Not found.</span> This address
          isn&apos;t inside a mapped water service area — many rural lots are on a
          private well or a small (Group&nbsp;B) system. Search for your supplier or
          add it yourself.
        </p>
        {!searchOpen ? (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border-[0.5px] border-pw-green px-4 py-2 text-sm font-medium text-pw-green hover:bg-pw-accent/10"
          >
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Find your water system
          </button>
        ) : (
          <SearchUI />
        )}
      </>
    );
    footer = <ProvenanceFooter {...provenance} />;
  }

  return (
    <Panel title="Water system" icon={Droplets}>
      {body}
      {footer}
    </Panel>
  );
}

function ProvenanceFooter(props: {
  source: string;
  fetchedAt: string | null;
  confidence: Confidence;
}) {
  return (
    <div className="mt-4 border-t-[0.5px] border-pw-divider pt-3">
      <ProvenanceBadge {...props} />
    </div>
  );
}
