import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ParcelWatch",
    short_name: "ParcelWatch",
    description:
      "Your property, explained — with the receipts. Every figure shows its source and date.",
    start_url: "/",
    display: "standalone",
    background_color: "#E1F5EE",
    theme_color: "#0F6E56",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
