// Nieuwe versie van de app online? Een app op het beginscherm (of een tabblad dat open blijft)
// laadt een update pas bij een echte herstart; iPhones halen de app vaak alleen uit de
// achtergrond terug. Daarom vergelijken we af en toe het hoofdbestand van de online versie
// (index.html → /assets/index-<hash>.js) met het bestand dat nu draait. Verschillen ze, dan
// staat er een nieuwe versie online en tonen we een melding (components/UpdateMelding.jsx).
//
// Kost één klein verzoek (index.html, ~2 kB) als de app weer zichtbaar wordt, hooguit eens per
// minuut, plus elke 30 minuten zolang de app open en zichtbaar is. Offline: niets.

const MIN_TUSSENPOOS = 60 * 1000;
const INTERVAL = 30 * 60 * 1000;

const scriptUitHtml = (html) =>
  (html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/i) || html.match(/<script[^>]*src="([^"]+)"[^>]*type="module"/i) || [])[1] || null;

// Het hoofdbestand van de versie die nu draait (null in de ontwikkelomgeving)
export const huidigeVersie = () => {
  const el = document.querySelector('script[type="module"][src*="/assets/"]');
  return el ? new URL(el.getAttribute("src"), location.href).pathname : null;
};

export async function nieuweVersieBeschikbaar() {
  const huidig = huidigeVersie();
  if (!huidig) return false;
  try {
    // no-store + unieke parameter: nooit een bewaarde index.html (browser, Cloudflare of service worker)
    const r = await fetch(`/?versiecontrole=${Date.now()}`, { cache: "no-store", headers: { Accept: "text/html" } });
    if (!r.ok) return false;
    const online = scriptUitHtml(await r.text());
    return !!online && new URL(online, location.href).pathname !== huidig;
  } catch {
    return false; // offline of tijdelijk onbereikbaar: volgende keer opnieuw
  }
}

// Controleer bij openen, bij terugkeren naar de app, bij weer online komen en periodiek.
// onNieuw wordt aangeroepen zodra er een nieuwere versie online staat. Geeft een stopfunctie.
export function volgVersie(onNieuw) {
  let laatste = 0, bezig = false, gestopt = false;
  const controleer = async (forceer = false) => {
    if (gestopt || bezig || document.visibilityState !== "visible") return;
    if (!forceer && Date.now() - laatste < MIN_TUSSENPOOS) return;
    bezig = true; laatste = Date.now();
    try {
      // ook de service worker laten kijken of er een nieuwe is
      navigator.serviceWorker?.getRegistration?.().then((reg) => reg?.update()).catch(() => {});
      if (await nieuweVersieBeschikbaar()) onNieuw();
    } finally {
      bezig = false;
    }
  };
  const opZicht = () => controleer();
  const opOnline = () => controleer(true);
  document.addEventListener("visibilitychange", opZicht);
  window.addEventListener("focus", opZicht);
  window.addEventListener("online", opOnline);
  const iv = setInterval(() => controleer(true), INTERVAL);
  const start = setTimeout(() => controleer(true), 10 * 1000);
  return () => {
    gestopt = true;
    document.removeEventListener("visibilitychange", opZicht);
    window.removeEventListener("focus", opZicht);
    window.removeEventListener("online", opOnline);
    clearInterval(iv);
    clearTimeout(start);
  };
}

// Nieuwe versie laden: gewoon herladen. De service worker haalt pagina's altijd eerst van
// het netwerk, dus dit laadt de nieuwe index.html en de nieuwe bestanden. Opnieuw installeren
// of downloaden is niet nodig.
export const laadNieuweVersie = () => window.location.reload();
