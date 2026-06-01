"use client";

import { useState, useId } from "react";
import Link from "next/link";

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
 * Address → parcel confirmation flow. The user types an address, we query King
 * County, and they pick the exact parcel from the candidate list. Accessible:
 * labelled input, status announced via aria-live, results are keyboard links.
 */
export function ParcelSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const inputId = useId();
  const statusId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setState({ status: "error", message: "Enter at least 3 characters." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/parcels/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        candidates?: Candidate[];
        unavailable?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setState({
          status: "error",
          message: data.message ?? "Search failed. Please try again.",
        });
        return;
      }
      setState({
        status: "done",
        candidates: data.candidates ?? [],
        unavailable: Boolean(data.unavailable),
      });
    } catch {
      setState({
        status: "error",
        message: "Could not reach the server. Please try again.",
      });
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Property address
        </label>
        <input
          id={inputId}
          name="address"
          type="text"
          inputMode="text"
          autoComplete="street-address"
          placeholder="e.g. 12825 SW Bachelor Rd, Vashon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={statusId}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="rounded-lg bg-gray-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
        >
          {state.status === "loading" ? "Searching…" : "Look up"}
        </button>
      </form>

      <div id={statusId} aria-live="polite" className="mt-4">
        {state.status === "idle" && (
          <p className="text-sm text-gray-500">
            First market: Vashon Island / unincorporated King County, WA.
          </p>
        )}
        {state.status === "loading" && (
          <p className="text-sm text-gray-500">Searching King County…</p>
        )}
        {state.status === "error" && (
          <p className="text-sm text-confidence-stale">{state.message}</p>
        )}
        {state.status === "done" && state.unavailable && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-confidence-stale">
            King County&apos;s parcel service is temporarily unavailable. Please
            try again shortly.
          </p>
        )}
        {state.status === "done" &&
          !state.unavailable &&
          state.candidates.length === 0 && (
            <p className="text-sm text-gray-500">
              No matching parcels found. Check the address and try again.
            </p>
          )}
        {state.status === "done" && state.candidates.length > 0 && (
          <>
            <p className="mb-2 text-sm text-gray-600">
              {state.candidates.length} match
              {state.candidates.length === 1 ? "" : "es"} — confirm your parcel:
            </p>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {state.candidates.map((c) => (
                <li key={c.pin}>
                  <Link
                    href={`/parcel/${c.pin}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 focus:bg-gray-50"
                  >
                    <span>
                      <span className="block font-medium text-gray-900">
                        {c.address ?? "Address unavailable"}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {[c.city, c.zip].filter(Boolean).join(" ")}
                        {" · PIN "}
                        {c.pin}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-gray-300">
                      →
                    </span>
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
