/* LUDEX background notification worker.
 * The FCM registration is attached to this worker by the application. Keeping
 * display logic here avoids bundling account credentials into a public file. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : "" } };
  }
  const data = payload.data || payload.notification || payload;
  const title = data.title || "LUDEX update";
  const options = {
    body: data.body || "A game you track has an update.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    image: data.image || undefined,
    tag: data.kind ? `ludex-${data.kind}` : "ludex-notification",
    renotify: true,
    data: { href: data.href || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/notifications", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.href || "/notifications", self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    /* keep the safe inbox destination */
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        existing.navigate(target.href);
        return existing.focus();
      }
      return clients.openWindow(target.href);
    }),
  );
});
