/*
 * Flux-o service worker: shows push notifications and opens the app when one
 * is tapped. It does no caching, so every deploy is picked up as before.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // iOS requires every push to show a notification.
  event.waitUntil(
    self.registration.showNotification(data.title || "Flux-o", {
      body: data.body || "",
      icon: "/apple-touch-icon.png",
      badge: "/favicon.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w ?? open).navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
