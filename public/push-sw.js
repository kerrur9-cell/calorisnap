/* Push-only worker: deliberately does not cache or intercept app requests. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "Загляни в дневник питания." };
  }

  const title = typeof payload.title === "string" ? payload.title : "CaloriSnap";
  const body = typeof payload.body === "string" ? payload.body : "Загляни в дневник питания.";
  const safePath = value => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/day";
  const url = safePath(payload.url);
  const actions = Array.isArray(payload.actions) ? payload.actions.slice(0, 2).filter(a => typeof a.action === "string" && typeof a.title === "string").map(a => ({ action: a.action, title: a.title, url: safePath(a.url) })) : [];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag : "calorisnap-reminder",
      actions: actions.map(({ action, title }) => ({ action, title })),
      data: { url, actions },
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const selected = event.notification.data?.actions?.find(a => a.action === event.action);
  const url = selected?.url || event.notification.data?.url;
  const target = new URL(typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/day", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
