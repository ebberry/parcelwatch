"use client";

import { useId, useState, useRef, useEffect } from "react";

/**
 * Accessible "what does this mean?" affordance. Click/Enter toggles a plain-
 * language definition. Works on touch (not hover-only); Escape and click-outside
 * dismiss; the button is keyboard-focusable and labelled for screen readers.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={`What does “${label}” mean?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-[0.5px] border-pw-border text-[10px] font-medium leading-none text-pw-sub hover:bg-pw-inset focus-visible:bg-pw-inset"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-6 z-20 block w-64 rounded-lg border-[0.5px] border-pw-border bg-pw-card p-3 text-left text-xs font-normal leading-relaxed text-pw-sub shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
