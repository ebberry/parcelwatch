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
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold leading-none text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-6 z-20 block w-64 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-gray-600 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
