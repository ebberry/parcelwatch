"use client";

import { useEffect, useState } from "react";

/**
 * Sticky, horizontally-scrollable section nav with scroll-spy. Turns the long
 * report into something you can jump around — the streamed panels make it long,
 * so give the reader a persistent map. Pure client behavior; degrades to plain
 * anchor links without JS.
 */
export function ReportNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    // The active section is the last one whose top has scrolled past the line
    // just below the sticky nav. Direct rect reads on scroll (cheap, ~5 els) —
    // no rAF, which background tabs pause.
    const update = () => {
      // At the bottom of the page the last section can't reach the line, so
      // pin it active there.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        const last = sections[sections.length - 1]?.id;
        if (last) setActive(last);
        return;
      }
      const line = 96;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (current) setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [sections]);

  const onJump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-0 z-20 -mx-5 mb-5 border-b-[0.5px] border-pw-divider bg-pw-bg/85 px-5 py-2 backdrop-blur-sm"
    >
      <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={onJump(s.id)}
                aria-current={on ? "true" : undefined}
                className={
                  "block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                  (on
                    ? "bg-pw-green text-white"
                    : "bg-pw-inset text-pw-sub hover:text-pw-green")
                }
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
