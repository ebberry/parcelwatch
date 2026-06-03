import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Calm civic" palette — see /docs/design-system.md. Color is information.
        pw: {
          bg: "#E1F5EE", // page background (pale green)
          card: "#FFFFFF", // card / primary surface
          inset: "#F7FAF8", // metric-tile inset (warm off-white)
          green: "#0F6E56", // primary deep forest green (brand)
          ink: "#04342C", // near-black green — headlines + primary numbers
          accent: "#1D9E75", // brighter green — icons + "all clear" dot
          border: "#9FE1CB", // card borders (use at 0.5px)
          divider: "#E1F5EE", // faintest dividers
          sub: "#5F5E5A", // secondary text
          // provenance line — darkened from the guide's #888780 to meet WCAG AA
          // 4.5:1 on both white cards (5.4:1) and the pale-green page (4.7:1).
          faint: "#6B6A66",
          amber: "#9C610D", // live-data flags + approaching deadlines (darkened for WCAG AA text: 4.48:1 on page bg, 5.09 on card)
        },
        // Provenance confidence dots (text label always accompanies the dot).
        confidence: {
          confirmed: "#1D9E75", // green — authoritatively verified
          live: "#9C610D", // amber — live / needs-verify (WCAG AA text)
          stale: "#9C610D", // amber — past freshness window (label differs)
          unavailable: "#888780", // grey — source unreachable
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
