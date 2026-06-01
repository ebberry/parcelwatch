import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// Body / data / numbers — clean neutral sans, two weights, tabular figures.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});

// The one place character lives: the property address headline. Warm serif.
const lora = Lora({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ParcelWatch — your property, explained",
  description:
    "One trustworthy place to understand a specific address and what's changing around it. Every data point shows its source and date.",
  applicationName: "ParcelWatch",
};

// Mobile-first, installable PWA target.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e56",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen bg-pw-bg font-sans text-pw-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
