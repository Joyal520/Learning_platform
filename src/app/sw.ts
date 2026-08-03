/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NavigationRoute,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";

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
    matcher: /\/api\//,
    handler: new NetworkOnly(),
    method: "GET",
  },
  // Never cache Supabase requests
  {
    matcher: /supabase\.co/,
    handler: new NetworkOnly(),
    method: "GET",
  },
  // Cache main app CSS with network-first (fast updates, offline support)
  {
    matcher: /\/assets\/css\/.+\.css$/,
    handler: new NetworkFirst({
      cacheName: "edtechra-app-styles",
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },
  // Cache main app images with cache-first
  {
    matcher: /\/assets\/images\/.+\.(png|jpg|jpeg|svg|gif|webp)$/,
    handler: new CacheFirst({
      cacheName: "edtechra-app-images",
      plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  // Cache brand logos
  {
    matcher: /\/assets\/logos\/.+\.(png|svg)$/,
    handler: new CacheFirst({
      cacheName: "edtechra-brand",
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  // Cache app icons
  {
    matcher: /\/icons\/.+\.(png|svg)$/,
    handler: new CacheFirst({
      cacheName: "edtechra-icons",
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  // Network-first for app HTML (app.html)
  {
    matcher: /\/app\.html$/,
    handler: new NetworkFirst({
      cacheName: "edtechra-app-shell",
      plugins: [new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: 24 * 60 * 60 })],
    }),
  },
  // Network-first for JS scripts (always get fresh versions)
  {
    matcher: /\/assets\/js\/.+\.js$/,
    handler: new NetworkFirst({
      cacheName: "edtechra-app-scripts",
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },
  // Network-first for page modules
  {
    matcher: /\/pages\/.+\.js$/,
    handler: new NetworkFirst({
      cacheName: "edtechra-page-modules",
      plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
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
});

// Handle navigation requests — SPA fallback for /home route
// In Serwist v9, navigation fallback is registered via NavigationRoute
serwist.registerRoute(
  new NavigationRoute(new NetworkFirst({ cacheName: "edtechra-navigations" }), {
    allowlist: [/^\/home$/],
  }),
);

serwist.addEventListeners();
