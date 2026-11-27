// Het vaste adres van de app. Cloudflare Pages geeft daarnaast elke deploy een eigen adres
// (bv. d7c2cd55.djm-app.pages.dev) en elke branch een testadres. Zo'n adres blijft altijd op
// die ene versie staan: wie de app daar opent of op het beginscherm zet, krijgt nooit updates.
export const APP_URL = "https://djm-app.pages.dev";
const VAST = new URL(APP_URL).hostname;

// Draait de app op een deploy- of testadres in plaats van het vaste adres?
export const isDeployAdres = (host = window.location.hostname) =>
  host !== VAST && host.endsWith("." + VAST);

// Adres voor links in e-mails (uitnodiging, wachtwoord vergeten): nooit een deploy-adres,
// anders komt een klant op een versie die niet meer wordt bijgewerkt. Lokaal blijft lokaal.
export const appOrigin = () => (isDeployAdres() ? APP_URL : window.location.origin);
