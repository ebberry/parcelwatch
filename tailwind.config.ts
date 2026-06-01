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
          faint: "#888780", // provenance line
          amber: "#BA7517", // live-data flags + approaching deadlines (reserved)
        },
        // Provenance confidence dots (text label always accompanies the dot).
        confidence: {
          confirmed: "#1D9E75", // green — authoritatively verified
          live: "#BA7517", // amber — live / needs-verify
          stale: "#BA7517", // amber — past freshness window (label differs)
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
