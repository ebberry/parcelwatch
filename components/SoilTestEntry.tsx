"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { saveSoilArsenic } from "@/app/parcel/[pin]/owner-actions";

/**
 * "Upload your number." The plume panel shows a *modeled* arsenic estimate; a
 * real soil test is the only thing specific to a property. Owners enter their
 * measured arsenic (ppm) and get advice keyed to their actual number against the
 * published reference levels (20 ppm cleanup / 100 ppm residential action).
 *
 * Stored per-parcel in localStorage for now (mirrors the water-system save);
 * migrates to the account once auth lands so advice travels with the owner.
 */

// Reference levels (WA Dept of Ecology), ppm arsenic.
const CLEANUP = 20;
const ACTION = 100;

function advice(ppm: number): { tone: string; text: string } {
  if (ppm < CLEANUP) {
    return {
      tone: "text-pw-green",
      text: `Below the state cleanup level (${CLEANUP} ppm). Reassuring — standard precautions (wash produce, keep bare soil covered) are still sensible anywhere in the plume.`,
    };
  }
  if (ppm < ACTION) {
    return {
      tone: "text-pw-amber",
      text: `Above the ${CLEANUP} ppm cleanup level but below the ${ACTION} ppm residential-yard action level. Keep bare soil covered, wash produce well, and consider raised beds with clean soil for vegetables.`,
    };
  }
  return {
    tone: "text-pw-amber",
    text: `At or above the ${ACTION} ppm residential-yard action level. Your property may qualify for free yard cleanup through Ecology's Dirt Alert program — worth contacting them. Limit bare-soil exposure, especially for young children, and wash hands and produce.`,
  };
}

export function SoilTestEntry({
  parcelId,
  signedIn = false,
  serverValue = null,
}: {
  parcelId: string;
  /** When signed in, the account is the store; otherwise localStorage. */
  signedIn?: boolean;
  /** The account-saved value (signed-in users); SSR-safe initial state. */
  serverValue?: number | null;
}) {
  const key = `pw:soil:${parcelId}`;
  const [saved, setSaved] = useState<number | null>(signedIn ? serverValue : null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let local: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) local = n;
      }
    } catch {
      /* ignore */
    }
    if (signedIn) {
      if (serverValue != null) {
        setSaved(serverValue);
        if (local != null) try { localStorage.removeItem(key); } catch {} // now in the account
      } else if (local != null) {
        // Migrate a pre-sign-in local value up to the account, then drop local.
        setSaved(local);
        void saveSoilArsenic(parcelId, local).then(() => {
          try { localStorage.removeItem(key); } catch {}
        });
      }
    } else if (local != null) {
      setSaved(local);
    }
  }, [key, signedIn, serverValue, parcelId]);

  function persist(n: number | null) {
    if (signedIn) void saveSoilArsenic(parcelId, n);
    else
      try {
        if (n == null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(n));
      } catch {
        /* ignore */
      }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(draft.trim());
    if (!Number.isFinite(n) || n < 0 || n > 10000) return;
    setSaved(n);
    setOpen(false);
    setDraft("");
    persist(n);
  }

  function clear() {
    setSaved(null);
    persist(null);
  }

  if (saved != null) {
    const a = advice(saved);
    return (
      <div className="mt-3 rounded-lg border-[0.5px] border-pw-border bg-pw-inset p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm">
            <span className="text-pw-sub">Your soil test:</span>{" "}
            <span className="font-medium tabular-nums text-pw-ink">{saved} ppm</span>{" "}
            <span className="text-pw-sub">arsenic</span>
          </p>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-xs text-pw-green hover:underline"
          >
            Remove
          </button>
        </div>
        <p className={`mt-1.5 text-sm ${a.tone}`}>{a.text}</p>
        <p className="mt-1.5 text-xs text-pw-faint">
          Your measured value — this replaces the modeled estimate above for your
          property.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-pw-green hover:underline"
        >
          <FlaskConical className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Had your soil tested? Enter your result for advice specific to your yard →
        </button>
      ) : (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-pw-sub">Your arsenic result (ppm)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={10000}
              step="any"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 45"
              className="mt-1 w-32 rounded-lg border-[0.5px] border-pw-border bg-pw-card px-3 py-2 text-base text-pw-ink placeholder:text-pw-faint"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-pw-green px-3 py-2 text-sm font-medium text-white hover:bg-pw-ink"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-1 py-2 text-sm text-pw-sub hover:text-pw-green"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
