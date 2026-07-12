import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globPatterns: [
            "**/*.{js,css,html,ico,png,jpg,jpeg,webp,avif,svg,gif,woff,woff2,ttf,otf,json,webmanifest,txt}",
          ],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          runtimeCaching: [
            // ANY image (book scans, almanac icons, storage covers, remote imgs)
            // — CacheFirst with long expiration and LRU eviction under quota.
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "cc-images-v1",
                expiration: {
                  maxEntries: 5000,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: { statuses: [0, 200] },
                matchOptions: { ignoreVary: true },
              },
            },
            // App-shell HTML: NetworkFirst with a fast fallback
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-navigations",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            // Supabase Data API GETs: SWR for instant offline reads
            {
              urlPattern: ({ url, request }) =>
                url.hostname.endsWith(".supabase.co") &&
                url.pathname.startsWith("/rest/v1/") &&
                request.method === "GET",
              handler: "StaleWhileRevalidate",
              method: "GET",
              options: {
                cacheName: "supabase-rest",
                expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Supabase Storage objects (PDFs, images): CacheFirst
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith(".supabase.co") &&
                url.pathname.startsWith("/storage/v1/object/"),
              handler: "CacheFirst",
              options: {
                cacheName: "supabase-storage",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Supabase writes / RPC: Background-sync queue so offline writes
            // replay when connectivity returns.
            {
              urlPattern: ({ url, request }) =>
                url.hostname.endsWith(".supabase.co") &&
                (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/")) &&
                ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
              handler: "NetworkOnly",
              method: "POST",
              options: {
                backgroundSync: {
                  name: "cc-writes",
                  options: { maxRetentionTime: 24 * 60 },
                },
              },
            },
            // Same-origin static assets
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && (request.destination === "style" || request.destination === "script" || request.destination === "font" || request.destination === "image"),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
