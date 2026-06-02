"use client";

import { useState, useId, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { titleCaseAddress } from "@/lib/format";

interface Candidate {
  pin: string;
  address: string | null;
  city: string | null;
  zip: string | null;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; candidates: Candidate[]; unavailable: boolean };

/**
 * Address → parcel confirmation flow with live (debounced) typeahead. The user
 * types an address and matching parcels appear as they go; they pick the exact
 * one. Submit still works (Enter / button) for an immediate search. Accessible:
 * labelled input, status announced via aria-live, results are keyboard links.
 */
export function ParcelSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const inputId = useId();
  const statusId = useId();

  // Guards: cancel the in-flight request and ignore out-of-order responses so
  // the list always reflects the latest keystroke.
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  async function runSearch(q: string) {
    const seq = ++seqRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/parcels/search?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      });
      const data = (await res.json()) as {
        candidates?: Candidate[];
        unavailable?: boolean;
        message?: string;
      };
      if (seq !== seqRef.current) return; // a newer keystroke superseded this one
      if (!res.ok) {
        setState({ status: "error", message: data.message ?? "Search failed. Please try again." });
        return;
      }
      setState({
        status: "done",
        candidates: data.candidates ?? [],
        unavailable: Boolean(data.unavailable),
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || seq !== seqRef.current) return;
      setState({ status: "error", message: "Could not reach the server. Please try again." });
    }
  }

  // Live search: debounce keystrokes; reset to idle below the 3-char threshold.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      seqRef.current++; // invalidate any pending response
      abortRef.current?.abort();
      setState({ status: "idle" });
      return;
    }
    const t = setTimeout(() => void runSearch(q), 250);
    return () => clearTimeout(t);
  }, [query]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setState({ status: "error", message: "Enter at least 3 characters." });
      return;
    }
    void runSearch(q);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Property address
        </label>
        <input
          id={inputId}
          name="address"
          type="text"
          inputMode="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={state.status === "done" && state.candidates.length > 0}
          aria-controls={statusId}
          placeholder="e.g. 12825 SW Bachelor Rd, Vashon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={statusId}
          className="flex-1 rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3.5 py-2.5 text-base text-pw-ink placeholder:text-pw-faint"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-pw-green px-4 py-2.5 text-base font-medium text-white hover:bg-pw-ink disabled:opacity-50"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {state.status === "loading" ? "Searching…" : "Look up"}
        </button>
      </form>

      <div id={statusId} aria-live="polite" className="mt-4">
        {state.status === "idle" && (
          <p className="text-sm text-pw-sub">
            First market: Vashon Island / unincorporated King County, WA.
          </p>
        )}
        {state.status === "loading" && (
          <p className="text-sm text-pw-sub">Searching King County…</p>
        )}
        {state.status === "error" && (
          <p className="text-sm text-pw-amber">{state.message}</p>
        )}
        {state.status === "done" && state.unavailable && (
          <p className="rounded-lg border-[0.5px] border-pw-amber/30 bg-[#FBF4E8] px-3 py-2 text-sm text-pw-amber">
            King County&apos;s parcel service is temporarily unavailable. Please
            try again shortly.
          </p>
        )}
        {state.status === "done" &&
          !state.unavailable &&
          state.candidates.length === 0 && (
            <p className="text-sm text-pw-sub">
              No matching parcels found. Check the address and try again.
            </p>
          )}
        {state.status === "done" && state.candidates.length > 0 && (
          <>
            <p className="mb-2 text-sm text-pw-sub">
              {state.candidates.length} match
              {state.candidates.length === 1 ? "" : "es"} — confirm your parcel:
            </p>
            <ul className="divide-y-[0.5px] divide-pw-divider overflow-hidden rounded-xl border-[0.5px] border-pw-border bg-pw-card">
              {state.candidates.map((c) => (
                <li key={c.pin}>
                  <Link
                    href={`/parcel/${c.pin}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-pw-inset focus:bg-pw-inset"
                  >
                    <span>
                      <span className="block font-medium text-pw-ink">
                        {titleCaseAddress(c.address) ?? "Address unavailable"}
                      </span>
                      <span className="block text-sm text-pw-sub">
                        {[titleCaseAddress(c.city), c.zip].filter(Boolean).join(" ")}
                        {" · "}
                        <span className="tabular-nums">PIN {c.pin}</span>
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-pw-border"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
