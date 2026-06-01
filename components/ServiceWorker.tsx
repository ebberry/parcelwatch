"use client";

import { useEffect } from "react";

/** Registers the service worker (production only) for installable-PWA behavior. */
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort */
      });
    }
  }, []);
  return null;
}
