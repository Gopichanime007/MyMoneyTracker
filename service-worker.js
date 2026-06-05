const CACHE_NAME = "moneytracker-cache-v2";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/styles/style.css",
  "/assets/scripts/storage.js",
  "/assets/scripts/script.js",
  "/assets/scripts/savings.js",
  "/assets/scripts/order.js",
  "/assets/scripts/orders.js",
  "/assets/scripts/quotation.js",
  "/assets/scripts/budgetperiod.js",
  "/assets/scripts/remo/attachments.js",
  "/assets/scripts/remo/attachments-worker.js",
  "/pages/savings.html",
  "/pages/orders.html",
  "/pages/order.html",
  "/pages/quotation.html",
  "/pages/budgetperiod.html"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const network = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, network.clone()).catch(() => {});
      return network;
    } catch (err) {
      const fallback = await caches.match("/index.html");
      return fallback || Response.error();
    }
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "icon.png"
    });
  }
});