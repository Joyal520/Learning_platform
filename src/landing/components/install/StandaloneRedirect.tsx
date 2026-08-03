"use client";

import { useEffect } from "react";

/**
 * Detects if the app is running in standalone (installed PWA) mode
 * and redirects to /home so installed users bypass the landing page.
 */
export function StandaloneRedirect() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      window.location.replace("/home");
    }
  }, []);

  return null;
}
