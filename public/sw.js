// Service worker van De Jonge Motoren.
// - Maakt de app installeerbaar en laat hem starten zonder netwerk (laatste versie).
// - Toont pushmeldingen voor de beheerder (verstuurd door edge function push-melding).
// Bewust zuinig: alleen eigen bestanden worden gecachet, nooit Supabase/Cloudinary
// (gegevens en inloggen gaan altijd live naar de server).

const CACHE = "djm-v1";
const MAX_ASSETS = 80; // oude bestanden van eerdere versies opruimen

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const naam of await caches.keys()) if (naam !== CACHE) await caches.delete(naam);
    await self.clients.claim();
  })());
});

const ruimOp = async (cache) => {
  const sleutels = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/assets/"));
  for (const r of sleutels.slice(0, Math.max(0, sleutels.length - MAX_ASSETS))) await cache.delete(r);
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Cloudinary, RDW: altijd live

  // Pagina's: eerst het netwerk (altijd de nieuwste versie), zonder netwerk de bewaarde app
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const antwoord = await fetch(req);
        if (antwoord.ok) (await caches.open(CACHE)).put("/", antwoord.clone());
        return antwoord;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // Bestanden met een hash in de naam veranderen nooit: uit de cache als ze er zijn
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    e.respondWith((async () => {
      const bewaard = await caches.match(req);
      if (bewaard) return bewaard;
      const antwoord = await fetch(req);
      const type = antwoord.headers.get("content-type") || "";
      if (antwoord.ok && !type.includes("text/html")) {
        const cache = await caches.open(CACHE);
        await cache.put(req, antwoord.clone());
        ruimOp(cache);
      }
      return antwoord;
    })());
  }
});

// ── Pushmeldingen ────────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "De Jonge Motoren", {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/" },
  }));
});

// Tik op een melding: open de app (of breng hem naar voren) op de juiste pagina
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const doel = new URL(e.notification.data?.url || "/", self.location.origin);
  e.waitUntil((async () => {
    const vensters = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = vensters.find((c) => new URL(c.url).origin === self.location.origin);
    if (app) {
      await app.focus();
      app.postMessage({ type: "open-pagina", pagina: doel.searchParams.get("pagina") });
      return;
    }
    await self.clients.openWindow(doel.href);
  })());
});
