"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * "Save as PDF" — opens the browser's print dialog (print-to-PDF). A beforeprint
 * hook expands any collapsed ("all clear") panels so nothing is hidden in the
 * saved file; the print stylesheet handles the rest (hides chrome, avoids ugly
 * page breaks). The button itself is .no-print so it never appears in the PDF.
 */
export function PrintReportButton() {
  useEffect(() => {
    const open = () => {
      document.querySelectorAll("details:not([open])").forEach((d) => {
        (d as HTMLDetailsElement).open = true;
        d.setAttribute("data-print-opened", "");
      });
    };
    const restore = () => {
      document.querySelectorAll("details[data-print-opened]").forEach((d) => {
        (d as HTMLDetailsElement).open = false;
        d.removeAttribute("data-print-opened");
      });
    };
    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 text-sm text-pw-sub hover:text-pw-green"
    >
      <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">Save as PDF</span>
      <span className="sr-only sm:hidden">Save as PDF</span>
    </button>
  );
}
