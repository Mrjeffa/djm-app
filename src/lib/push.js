// Pushmeldingen voor de beheerder: dit apparaat aan- of afmelden.
// Het versturen gebeurt door de edge function push-melding (zie supabase/push.sql).
import { supabase } from "./supabase.js";
import { isGeinstalleerd, platform } from "./pwa.js";

export const pushOndersteund = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhone/iPad: pushmeldingen werken alleen in de geïnstalleerde app (iOS 16.4+)
export const moetEerstInstalleren = () => platform().os === "ios" && !isGeinstalleerd();

const naarBytes = (b64) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

const registratie = async () => {
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return reg;
};

const apparaatNaam = () => {
  const p = platform();
  return `${p.os === "ios" ? "iPhone/iPad" : p.os === "android" ? "Android" : "Computer"} · ${new Date().toLocaleDateString("nl-NL")}`;
};

const functieFout = async (error) => {
  try { const b = await error.context?.json?.(); if (b?.fout) return b.fout; } catch { /* geen json */ }
  return error.message || "Onbekende fout";
};

// Huidige aanmelding van dit apparaat (of null)
export const huidigAbonnement = async () => {
  if (!pushOndersteund()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
};

export const zetPushAan = async () => {
  const toestemming = await Notification.requestPermission();
  if (toestemming !== "granted") {
    throw new Error(toestemming === "denied"
      ? "Meldingen zijn geblokkeerd. Sta ze toe in de instellingen van je telefoon of browser (bij deze app/website) en probeer opnieuw."
      : "Geen toestemming gegeven voor meldingen.");
  }
  const { data, error } = await supabase.functions.invoke("push-melding", { body: { sleutel: true } });
  if (error) throw new Error(await functieFout(error));
  const sleutel = naarBytes(data.publiekeSleutel);
  const reg = await registratie();
  let sub = await reg.pushManager.getSubscription();
  // Oude aanmelding met een andere sleutel: eerst afmelden
  const oudeSleutel = sub?.options?.applicationServerKey;
  if (sub && oudeSleutel && new Uint8Array(oudeSleutel).join() !== sleutel.join()) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutel });
  const j = sub.toJSON();
  const { error: dbFout } = await supabase.from("push_abonnementen")
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, apparaat: apparaatNaam() }, { onConflict: "endpoint" });
  if (dbFout) throw new Error("Aanmelden opslaan mislukt: " + dbFout.message);
};

export const zetPushUit = async () => {
  const sub = await huidigAbonnement();
  if (!sub) return;
  await supabase.from("push_abonnementen").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
};

export const stuurTestmelding = async () => {
  const { data, error } = await supabase.functions.invoke("push-melding", { body: { test: true } });
  if (error) throw new Error(await functieFout(error));
  return data; // { apparaten, verstuurd, fouten }
};
