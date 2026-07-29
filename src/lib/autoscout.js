// ── AutoScout24 plaatsen ──────────────────────────────────────────────────────
// De app kan het AutoScout-formulier niet zelf invullen (cross-origin), dus we
// zetten alle gegevens klaar op twee manieren:
//   1) meegecodeerd in de URL-hash, zodat het Tampermonkey-userscript
//      (public/autoscout-djm.user.js) ze op de AutoScout-pagina kan invullen;
//   2) op het klembord in leesbare vorm, zodat je ze handmatig of via de
//      Claude-browserextensie kunt gebruiken (bv. als het formulier verandert).
// AutoScout haalt techniek (kW, cc, gewicht, brandstof, bouwjaar) zelf uit de
// RDW op basis van het kenteken; die velden geven we dus niet mee.

const AS_START = "https://myarea.autoscout24.nl/vehicle/identification?moto=1";

// Compacte gegevensset die het userscript/de extensie verwacht.
export const bouwPayload = (m) => ({
  kenteken: (m.kenteken || "").toUpperCase().replace(/-/g, ""),
  merk: m.merk || "",
  model: m.model || "",
  uitvoering: m.uitvoering || "",
  bouwjaar: m.bouwjaar ? String(m.bouwjaar) : "",
  km: (m.km ?? "") === "" ? "" : String(m.km),
  prijs: (m.prijs ?? "") === "" ? "" : String(m.prijs),
  kleur: m.kleur || "",
  carrosserietype: m.carrosserietype || "",
  uitrusting: Array.isArray(m.uitrusting) ? m.uitrusting : [],
  beschrijving: m.beschrijving || "",
  fotos: Array.isArray(m.fotos) ? m.fotos : [],
});

// Base64 die ook Unicode (é, €, …) aankan — spiegelbeeld van de decode in het userscript.
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));

// Leesbaar blok voor het klembord (mens + Claude-extensie).
const leesbaar = (p) => [
  `AUTOSCOUT24 — ${p.merk} ${p.model}`.trim(),
  `Kenteken: ${p.kenteken}`,
  `Merk: ${p.merk}`,
  `Model: ${p.model}`,
  p.uitvoering && `Uitvoering: ${p.uitvoering}`,
  p.carrosserietype && `Carrosserietype: ${p.carrosserietype}`,
  p.kleur && `Kleur: ${p.kleur}`,
  p.bouwjaar && `Bouwjaar: ${p.bouwjaar}`,
  p.km !== "" && `Kilometerstand: ${p.km} km`,
  p.prijs !== "" && `Prijs: € ${p.prijs}`,
  p.uitrusting.length && `Uitrusting: ${p.uitrusting.join(", ")}`,
  p.beschrijving && `\nBeschrijving:\n${p.beschrijving}`,
  p.fotos.length && `\nFoto's (${p.fotos.length}) — downloaden en uploaden:\n${p.fotos.join("\n")}`,
].filter(Boolean).join("\n");

// Opent AutoScout in een nieuw tabblad met de gegevens klaargezet, en kopieert
// dezelfde gegevens leesbaar naar het klembord. Synchroon window.open eerst,
// zodat de popup-blokkering niet toeslaat; klembord daarna (fire-and-forget).
export const openAutoScout = (motor) => {
  const p = bouwPayload(motor);
  const url = `${AS_START}#djm=${encodeURIComponent(b64(JSON.stringify(p)))}`;
  window.open(url, "_blank");
  try { navigator.clipboard?.writeText(leesbaar(p)); } catch { /* klembord geblokkeerd — ok */ }
};
