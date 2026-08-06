// Minimal service worker for PWA installability.
//
// Chrome refuses to surface the install prompt unless a service worker is
// registered AND it has a "fetch" event handler. The handler doesn't need
// to do anything — a passthrough is enough. We deliberately avoid caching
// here: this app is auth-gated, content-heavy, and shipped fresh on every
// Vercel deploy. Adding a cache layer creates more debugging headaches
// (stale dashboards, locked-out students after a deploy) than it's worth
// at this stage.
//
// If we later want offline support for specific routes, we'll layer a
// proper cache strategy on top.

const SW_VERSION = "1.0.0";

self.addEventListener("install", (event) => {
  // Activate the new SW immediately on first install / version bump.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of any already-open tabs as soon as we activate.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough — let the network handle every request. This listener
  // exists solely to satisfy the PWA install criteria.
  event.respondWith(fetch(event.request));
});

// Allow the page to ask us to skip waiting (used when we detect an update
// and want to apply it without forcing a manual reload).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Hint for debugging: bump SW_VERSION when we change anything in this file.
console.log(`[sw] ${SW_VERSION} loaded`);
