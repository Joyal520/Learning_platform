/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/* ------------------------------------------------------------------ */
/*  Additional runtime caching for the main EdTechra SPA              */
/* ------------------------------------------------------------------ */

const edtechraAppCaching: RuntimeCaching[] = [
  // Never cache API routes — let them go to the network
  {
    urlPattern: /\/api\//,
    handler: "NetworkOnly" as const,
    method: "GET",
  },
  // Never cache Supabase requests
  {
    urlPattern: /supabase\.co/,
    handler: "NetworkOnly" as const,
    method: "GET",
  },
  // Cache main app CSS with network-first (fast updates, offline support)
  {
    urlPattern: /\/assets\/css\/.+\.css$/,
    handler: "NetworkFirst" as const,
    options: { cacheName: "edtechra-app-styles", expiration: { maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 } },
  },
  // Cache main app images with cache-first
  {
    urlPattern: /\/assets\/images\/.+\.(png|jpg|jpeg|svg|gif|webp)$/,
    handler: "CacheFirst" as const,
    options: { cacheName: "edtechra-app-images", expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } },
  },
  // Cache brand logos
  {
    urlPattern: /\/assets\/logos\/.+\.(png|svg)$/,
    handler: "CacheFirst" as const,
    options: { cacheName: "edtechra-brand", expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 } },
  },
  // Cache app icons
  {
    urlPattern: /\/icons\/.+\.(png|svg)$/,
    handler: "CacheFirst" as const,
    options: { cacheName: "edtechra-icons", expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 } },
  },
  // Network-first for app HTML (app.html)
  {
    urlPattern: /\/app\.html$/,
    handler: "NetworkFirst" as const,
    options: { cacheName: "edtechra-app-shell", expiration: { maxEntries: 2, maxAgeSeconds: 24 * 60 * 60 } },
  },
  // Network-only for JS scripts (always get fresh versions)
  {
    urlPattern: /\/assets\/js\/.+\.js$/,
    handler: "NetworkFirst" as const,
    options: { cacheName: "edtechra-app-scripts", expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 } },
  },
  // Network-only for page modules
  {
    urlPattern: /\/pages\/.+\.js$/,
    handler: "NetworkFirst" as const,
    options: { cacheName: "edtechra-page-modules", expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 } },
  },
];

/* ------------------------------------------------------------------ */
/*  Firebase Messaging integration                                     */
/* ------------------------------------------------------------------ */

try {
  // Firebase messaging service worker for push notifications
  importScripts("/firebase-messaging-sw.js");
} catch (error) {
  console.warn("[SW] Firebase messaging worker unavailable:", error);
}

/* ------------------------------------------------------------------ */
/*  Serwist initialization with merged caching                        */
/* ------------------------------------------------------------------ */

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...defaultCache, ...edtechraAppCaching],
  // Handle navigation requests — SPA fallback for /home route
  navigationFallback: "/app.html",
  navigationFallbackAllowlist: [/^\/home$/],
});

serwist.addEventListeners();
