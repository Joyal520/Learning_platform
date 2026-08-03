"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const platformTimer = window.setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosDevice = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsIOS(iosDevice);
      setIsInstalled(standalone || iosStandalone);
    }, 0);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(platformTimer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  return useMemo(
    () => ({
      canInstall: Boolean(deferredPrompt),
      isInstalled,
      isIOS,
      install,
    }),
    [deferredPrompt, install, isIOS, isInstalled],
  );
}
