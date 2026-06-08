self.addEventListener("install", event => {
  console.log("Service Worker Installed");
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("Service Worker Activated");
});

self.addEventListener("fetch", event => {
  // no caching yet
});

self.addEventListener("message", event => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "icon.png"
    });
  }
});