// Installeerbare app (PWA): service worker registreren en de installatievraag
// van Android/Chrome opvangen. Wordt bij het opstarten geladen (main.jsx), omdat
// de browser "beforeinstallprompt" vroeg verstuurt — vaak al vóór het
// klantportaal op het scherm staat.

let installVraag = null; // het uitgestelde beforeinstallprompt-event
const luisteraars = new Set();
const meld = () => luisteraars.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // eigen knop i.p.v. de standaardbalk van de browser
    installVraag = e;
    meld();
  });
  window.addEventListener("appinstalled", () => { installVraag = null; meld(); });

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker niet geregistreerd:", e));
    });
  }
}

// Draait de app al als geïnstalleerde app (vanaf het beginscherm)?
export const isGeinstalleerd = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
   window.matchMedia?.("(display-mode: fullscreen)").matches ||
   window.navigator.standalone === true);

export const platform = () => {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return { os: "ios", safari: !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) };
  if (/Android/.test(ua)) return { os: "android", samsung: /SamsungBrowser/.test(ua) };
  return { os: "desktop" };
};

export const kanDirectInstalleren = () => !!installVraag;

// Toont de installatievraag van de browser; geeft "accepted" of "dismissed".
export const installeer = async () => {
  if (!installVraag) return "niet-beschikbaar";
  const vraag = installVraag;
  installVraag = null; // een event kan maar één keer gebruikt worden
  meld();
  await vraag.prompt();
  const { outcome } = await vraag.userChoice;
  return outcome;
};

// Abonneer op wijzigingen (installatievraag beschikbaar / app geïnstalleerd)
export const opInstallWijziging = (f) => { luisteraars.add(f); return () => luisteraars.delete(f); };
