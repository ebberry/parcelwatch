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
        // Provenance confidence states — single source of truth for the badge.
        // Chosen for WCAG AA contrast on white (all >= 4.5:1 for normal text).
        confidence: {
          confirmed: "#15803d", // green-700
          live: "#0369a1", // sky-700
          stale: "#b45309", // amber-700
          unavailable: "#6b7280", // gray-500
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
