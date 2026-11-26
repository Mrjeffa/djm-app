// Hulpfuncties voor "Website aanpassen" (components/WebsiteBeheer.jsx).
// De website (repo djm-website) leest dezelfde tabellen; de regels hier volgen het
// werkplan en de database-checks in supabase/website_cms.sql.

// Eén plek voor het adres van de website ("Bekijk op website")
export const SITE_URL = "https://www.dejongemotoren.nl";
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

// Pagina's met vaste velden (website_blokken.pagina) en hun pad op de website
export const PAGINAS = [
  { id: "home",           naam: "Home",            pad: "/" },
  { id: "occasions",      naam: "Occasions",       pad: "/occasions" },
  { id: "werkplaats",     naam: "Werkplaats",      pad: "/werkplaats" },
  { id: "winterstalling", naam: "Winterstalling",  pad: "/winterstalling" },
  { id: "verkopen",       naam: "Motor verkopen",  pad: "/motor-verkopen" },
  { id: "proefrit",       naam: "Proefrit",        pad: "/proefrit" },
  { id: "overons",        naam: "Over ons",        pad: "/over-ons" },
  { id: "contact",        naam: "Contact",         pad: "/contact" },
  { id: "algemeen",       naam: "Algemeen (footer)", pad: "/" },
];

// SEO-sleutels seo.<id>.titel/omschrijving → pad
export const SEO_PADEN = {
  home: "/", occasions: "/occasions", werkplaats: "/werkplaats", winterstalling: "/winterstalling",
  verkopen: "/motor-verkopen", proefrit: "/proefrit", overons: "/over-ons", contact: "/contact",
  onderdelen: "/onderdelen", faq: "/veelgestelde-vragen",
};
export const SEO_ACHTERVOEGSEL = " | De Jonge Motoren";

export const FAQ_GROEPEN = [
  { id: "kopen", naam: "Kopen" },
  { id: "verkopen", naam: "Verkopen" },
  { id: "werkplaats", naam: "Werkplaats" },
  { id: "bezoek", naam: "Langskomen" },
];

export const BLOG_CATEGORIEEN = ["Koopadvies", "Vergelijking", "Verzekering", "Onderhoud", "Nieuws"];

// Variabelen die de website bij elk bezoek invult
export const VASTE_CODES = [
  { code: "{jaren}", uitleg: "aantal jaren", voorbeeld: "25" },
  { code: "{telefoon}", uitleg: "telefoonnummer", voorbeeld: "0166-606090" },
  { code: "{whatsapp}", uitleg: "WhatsApp-nummer", voorbeeld: "06-21908697" },
];
export const tariefCode = (sleutel) => `{tarief:${sleutel}}`;
export const tariefTekst = (waarde) => {
  const n = Number(String(waarde ?? "").replace(",", "."));
  return Number.isFinite(n) && String(waarde ?? "").trim() !== "" ? `€ ${n.toLocaleString("nl-NL")}` : String(waarde ?? "");
};

// Codes in een tekst invullen met voorbeeldwaarden (voor de voorbeeldweergave)
export const vulCodesIn = (tekst, tarieven = {}) =>
  String(tekst ?? "")
    .replace(/\{jaren\}/g, "25").replace(/\{telefoon\}/g, "0166-606090").replace(/\{whatsapp\}/g, "06-21908697")
    .replace(/\{tarief:([a-z0-9_]+)\}/g, (m, k) => (k in tarieven ? tariefTekst(tarieven[k]) : m));

// ── Controles (zelfde regels als de database, met uitleg voor de beheerder) ──
const HTML = /<\/?[a-z!][^>]*>/i;
const LINK = /\[([^\]]*)\]\(([^)\s]*)\)/g;

export const isInternPad = (u) => /^\/([^/\\].*)?$/.test(u);
export const isWebadres = (u) => /^https:\/\/[^\s"<>]+$/.test(u);

// Fouten in een tekst: HTML, onbekende codes, verkeerde links. extern = ook https-links toegestaan;
// codes = false: {…} niet controleren (blog en inhoud van pagina's kennen geen codes).
export function tekstFouten(tekst, { tarieven = {}, extern = false, max, min, codes = true } = {}) {
  const t = String(tekst ?? "");
  const fouten = [];
  if (max && t.length > max) fouten.push(`Te lang: ${t.length} van max. ${max} tekens.`);
  if (min && t.trim().length > 0 && t.trim().length < min) fouten.push(`Te kort: minimaal ${min} tekens.`);
  if (HTML.test(t)) fouten.push("Gebruik geen HTML-code (zoals <b> of <a>).");
  for (const [, , url] of t.matchAll(LINK)) {
    if (isInternPad(url)) continue;
    if (extern && isWebadres(url)) continue;
    fouten.push(extern
      ? `Link "${url || "(leeg)"}" klopt niet: gebruik een pad zoals /occasions of een webadres dat met https:// begint.`
      : `Link "${url || "(leeg)"}" klopt niet: alleen interne links zoals /occasions.`);
  }
  if (codes) for (const [code, k] of t.matchAll(/\{([^{}]*)\}/g)) {
    if (["jaren", "telefoon", "whatsapp"].includes(k)) continue;
    const m = k.match(/^tarief:([a-z0-9_]+)$/);
    if (m && m[1] in tarieven) continue;
    fouten.push(`Onbekende code ${code}. Kies een code uit de lijst onder het veld.`);
  }
  return fouten;
}

export function afbeeldingFouten(a, { optioneel = false } = {}) {
  const url = a?.url || "";
  if (!url) return optioneel ? [] : ["Kies een afbeelding."];
  const fouten = [];
  if (!/^https:\/\//.test(url)) fouten.push("De afbeelding moet via https komen.");
  const alt = (a.alt || "").trim();
  if (alt.length < 10 || alt.length > 125) fouten.push("Omschrijving (alt-tekst) is verplicht: 10 tot 125 tekens.");
  return fouten;
}

// Fouten per veld van website_blokken
export function blokFouten(rij, waarde, tarieven) {
  const o = rij.opties || {};
  if (rij.type === "tekst") return tekstFouten(waarde, { tarieven, max: o.max });
  if (rij.type === "tekst_lang") return tekstFouten(waarde, { tarieven, max: o.max });
  if (rij.type === "afbeelding") return afbeeldingFouten(waarde, { optioneel: !!o.optioneel });
  if (rij.type === "lijst") {
    const items = Array.isArray(waarde) ? waarde : [];
    const fouten = [];
    if (o.min_items && items.length < o.min_items) fouten.push(`Minimaal ${o.min_items} items.`);
    if (o.max_items && items.length > o.max_items) fouten.push(`Maximaal ${o.max_items} items.`);
    items.forEach((item, i) => (o.velden || []).forEach((v) => {
      const t = item?.[v.naam] ?? "";
      if (!String(t).trim()) fouten.push(`Item ${i + 1}: "${v.label}" is leeg.`);
      for (const f of tekstFouten(t, { tarieven, max: v.max })) fouten.push(`Item ${i + 1}, ${v.label}: ${f}`);
    }));
    return fouten;
  }
  return [];
}

// Slug uit een titel: kleine letters, koppeltekens, geen leestekens
export const maakSlug = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " en ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 80)
  .replace(/-+$/, "");
export const isSlug = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

// Woorden tellen in markdown-inhoud (zonder opmaaktekens)
export const telWoorden = (md) => String(md ?? "")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*\-_>`]/g, " ")
  .split(/\s+/).filter((w) => /[a-z0-9à-ÿ]/i.test(w)).length;

// Lijken twee teksten sterk op elkaar? (Jaccard op betekenisvolle woorden)
const STOP = new Set(["de", "het", "een", "en", "in", "van", "voor", "op", "bij", "je", "jouw", "met", "te", "is", "of", "aan", "tholen"]);
const woorden = (t) => new Set(String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
export function lijktOp(a, b) {
  const A = woorden(a), B = woorden(b);
  if (!A.size || !B.size) return false;
  let samen = 0;
  for (const w of A) if (B.has(w)) samen++;
  return samen / (A.size + B.size - samen) >= 0.6;
}

// Cloudinary: kleine voorbeeldversie (alleen voor eigen Cloudinary-URL's)
export const voorbeeldUrl = (url, breedte = 600) =>
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url || "")
    ? url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${breedte}/`)
    : url;

export const datumTekst = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
};
export const datumTijdTekst = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const vandaagIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
