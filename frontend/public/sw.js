const CACHE_NAME = "quickserve-pos-shell-v2";

function scopeUrl(path = "") {
  return new URL(path, self.registration.scope).toString();
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = scopeUrl("index.html");
  const indexResponse = await fetch(indexUrl, { cache: "reload" });

  if (indexResponse.ok) {
    await cache.put(indexUrl, indexResponse.clone());
    const html = await indexResponse.text();
    const assetUrls = Array.from(
      html.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      (match) => new URL(match[1], indexUrl).toString()
    ).filter((url) => !new URL(url).pathname.includes("/api/"));

    await Promise.allSettled(
      assetUrls.map(async (url) => {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok || response.type === "opaque") {
          await cache.put(url, response);
        }
      })
    );
  }

  await Promise.allSettled(
    [scopeUrl(), scopeUrl("logo-1.png")].map((url) => cache.add(url))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(scopeUrl("index.html"))) ||
            (await caches.match(scopeUrl())) ||
            Response.error()
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
