"use client";

import { useId, useState, useRef, useEffect } from "react";

/**
 * Inline jargon term in prose: the word itself is the trigger (dotted underline),
 * click/Enter reveals a plain-language definition. Same dismiss behavior as
 * InfoTip (Escape, click-outside), touch-friendly, screen-reader labelled.
 * Delivers the "explain all jargon" direction without breaking sentence flow.
 */
export function Term({ children, define }: { children: React.ReactNode; define: string }) {
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
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help underline decoration-dotted decoration-pw-faint underline-offset-2 hover:decoration-pw-green focus-visible:decoration-pw-green"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-6 z-20 block w-64 rounded-lg border-[0.5px] border-pw-border bg-pw-card p-3 text-left text-xs font-normal leading-relaxed text-pw-sub shadow-lg"
        >
          {define}
        </span>
      )}
    </span>
  );
}
