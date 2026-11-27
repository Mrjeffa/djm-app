// Factuur als Excel-bestand, gemaakt vanuit de onderhoudslijst van een afspraak.
//
// Sjabloon: public/factuur-sjabloon.xlsx (de "Standaardfactuur De Jonge Motoren" van de zaak,
// zonder klantgegevens). We vullen alleen waarden in de bestaande cellen in en laten opmaak,
// formules, keuzelijsten en printinstellingen ongemoeid. Excel rekent bij openen alles opnieuw
// uit (fullCalcOnLoad in het sjabloon). Afdrukken op briefpapier: alleen kolom A–G gaat op papier.
//
// Prijzen komen uit de prijslijst (tabel prijslijst, alles ex btw), die in Instellingen als
// Excel wordt gedownload, aangevuld (bv. regels uit een Larsson-bestelling plakken) en weer
// geüpload.

export const MAX_REGELS = 26; // rij 19 t/m 44 van het sjabloon
export const BETAALWIJZEN = ["Contant/pin", "Bank 8 dagen", "Voldaan", "Aanbetaling"];

// ── Bedragen ────────────────────────────────────────────────────────────────
// "32.94 €", "€ 1.234,56", "8,56", 19.43 → getal met centen; leeg of onleesbaar → null
export function naarPrijs(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(/(?!^)-/g, "").replace(/[.,]+$/, "");
  if (!s || !/\d/.test(s)) return null;
  const komma = s.lastIndexOf(","), punt = s.lastIndexOf(".");
  // Het decimaalteken is het laatste scheidingsteken met 1 of 2 cijfers erachter ("8,56", "32.94",
  // "1.234,56", "1,234.56"); een scheidingsteken met 3 cijfers erachter is een duizendtal ("1.234").
  const laatste = Math.max(komma, punt);
  const decimaal = laatste > -1 && /^\d{1,2}$/.test(s.slice(laatste + 1)) ? laatste : -1;
  s = [...s].filter((c, i) => i === decimaal || (c !== "." && c !== ",")).join("").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
export const euro = (n) => (n == null ? "" : `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

// ── Prijslijst ──────────────────────────────────────────────────────────────
// Kolommen zoals in de bestellijst van Larsson, zodat regels er zo in te plakken zijn.
export const PRIJSLIJST_KOPPEN = ["JM-Nr.", "Omschrijving", "Fabrikant artikel nummer", "Inkoop-Netto", "Verkoopprijs", "Aantal", "Totale aankoopprijs", "Totaal verkoopprijs"];

const kop = (v) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
const KOLOM_HERKENNING = {
  jm_nummer: (k) => k.startsWith("jmnr") || k === "jm",
  omschrijving: (k) => k.startsWith("omschrijving") || k === "artikel" || k === "naam",
  artikelnummer: (k) => k.includes("fabrikant") || k.startsWith("artikelnummer") || k.startsWith("artikelnr") || k === "type",
  inkoop: (k) => k.startsWith("inkoop"),
  verkoop: (k) => k.startsWith("verkoopprijs") || k === "verkoop" || k.startsWith("prijs") || k.startsWith("stuksprijs"),
};

// Rijen (array van arrays, bv. uit sheet_to_json(header: 1)) → prijslijst.
// Zoekt de kopregel op naam, slaat "voertuig:"-regels, totalen en lege regels over.
export function leesPrijslijst(rijen) {
  const r = Array.isArray(rijen) ? rijen : [];
  const kopIndex = r.findIndex((rij) => Array.isArray(rij) && rij.some((c) => KOLOM_HERKENNING.omschrijving(kop(c))));
  if (kopIndex === -1) return { regels: [], overgeslagen: 0, fout: "Geen kolom \"Omschrijving\" gevonden. Gebruik de kopregel uit de gedownloade prijslijst." };
  const koppen = r[kopIndex].map(kop);
  const kol = {};
  for (const [veld, past] of Object.entries(KOLOM_HERKENNING)) {
    // verkoop: de eerste "Verkoopprijs", niet "Totaal verkoopprijs"
    const i = koppen.findIndex((k) => k && past(k));
    if (i > -1) kol[veld] = i;
  }
  const regels = [];
  let overgeslagen = 0;
  for (const rij of r.slice(kopIndex + 1)) {
    if (!Array.isArray(rij) || rij.every((c) => String(c ?? "").trim() === "")) continue;
    const eerste = String(rij[0] ?? "").trim().toLowerCase();
    const tekst = rij.map((c) => String(c ?? "").trim().toLowerCase()).join(" ");
    if (eerste.startsWith("voertuig") || /^totaal|^bestelnummer|^klantnummer|^besteld op/.test(eerste) || /totaal (excl|incl|bedrag)/.test(tekst)) continue;
    const waarde = (veld) => (kol[veld] == null ? "" : String(rij[kol[veld]] ?? "").trim());
    const omschrijving = waarde("omschrijving").replace(/\s+\.$/, "").replace(/\s+/g, " ");
    if (!omschrijving) { overgeslagen++; continue; }
    regels.push({
      omschrijving: omschrijving.slice(0, 300),
      artikelnummer: waarde("artikelnummer") || null,
      jm_nummer: waarde("jm_nummer") || null,
      inkoop: naarPrijs(waarde("inkoop")),
      verkoop: naarPrijs(waarde("verkoop")),
      volgorde: regels.length,
    });
  }
  return { regels, overgeslagen, fout: null };
}

// Prijslijst → rijen voor een Excel-blad (om te downloaden en aan te vullen)
export const prijslijstRijen = (regels) => [
  PRIJSLIJST_KOPPEN,
  ...(regels || []).map((x) => [x.jm_nummer || "", x.omschrijving, x.artikelnummer || "", x.inkoop ?? "", x.verkoop ?? ""]),
];

// Voorbeeldregels voor een lege prijslijst: eigen werk dat op de onderhoudslijst staat
export const VOORBEELD_PRIJSLIJST = [
  "Kleine beurt", "Grote beurt", "Arbeid (per uur)", "Klein materiaal, milieu-afvalkosten",
].map((omschrijving, volgorde) => ({ omschrijving, artikelnummer: null, jm_nummer: null, inkoop: null, verkoop: null, volgorde }));

const normaal = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Mogelijke artikelcodes in een tekst: woorden met minstens één cijfer, bv. "HF303", "CR9EK", "MCB703"
export const codesIn = (tekst) => (String(tekst ?? "").match(/[A-Za-z0-9][A-Za-z0-9./-]*\d[A-Za-z0-9./-]*|[A-Za-z0-9./-]*\d[A-Za-z0-9./-]*[A-Za-z][A-Za-z0-9./-]*/g) || [])
  .map(normaal).filter((c) => c.length >= 3);

// Prijslijstregel bij een factuurregel: eerst op artikelcode (type/toelichting), dan op naam
export function zoekInPrijslijst(omschrijving, extraTekst, prijslijst) {
  const lijst = (prijslijst || []).filter((x) => x && x.omschrijving);
  for (const code of [...codesIn(extraTekst), ...codesIn(omschrijving)]) {
    const hit = lijst.find((x) => normaal(x.artikelnummer) === code || normaal(x.jm_nummer) === code)
      || lijst.find((x) => normaal(x.omschrijving).includes(code));
    if (hit) return hit;
  }
  const naam = normaal(omschrijving);
  return lijst.find((x) => normaal(x.omschrijving) === naam) || null;
}

// ── Factuurregels uit de onderhoudslijst ────────────────────────────────────
// Uitgevoerde werkzaamheden, groot onderhoud (met type), vervangen onderdelen (met toelichting),
// en adviespunten als tekstregel (zonder bedrag).
export function factuurRegels(lijst, prijslijst) {
  const l = lijst || {};
  const regels = [];
  const voeg = (omschrijving, extra = "") => {
    const hit = zoekInPrijslijst(omschrijving, extra, prijslijst);
    regels.push({ aantal: 1, omschrijving, prijs: hit?.verkoop ?? null });
  };
  const werk = (l.werkzaamheden || []).filter((x) => x.gedaan);
  const heeftBeurt = (re) => werk.some((x) => re.test(x.naam));
  if (l.klein_onderhoud && !heeftBeurt(/kleine beurt|klein onderhoud/i)) voeg("Klein onderhoud");
  if (l.groot_onderhoud && !heeftBeurt(/grote beurt|groot onderhoud/i)) voeg("Groot onderhoud");
  for (const x of werk) voeg(x.naam);
  for (const x of (l.groot || []).filter((g) => g.gedaan)) {
    const type = (x.type || "").trim();
    voeg(type ? `${x.naam} ${type}` : x.naam, type);
  }
  for (const x of (l.controle || []).filter((c) => c.status === "vervangen")) {
    const notitie = (x.notitie || "").trim();
    voeg(notitie ? `${x.naam} ${notitie}` : x.naam, notitie);
  }
  for (const x of (l.controle || []).filter((c) => c.status === "advies")) {
    const notitie = (x.notitie || "").trim();
    regels.push({ aantal: null, omschrijving: `Advies: ${x.naam}${notitie ? ` – ${notitie}` : ""}`, prijs: null });
  }
  return regels;
}

export const regelTotaal = (r) => (r.aantal != null && r.prijs != null ? Math.round(r.aantal * r.prijs * 100) / 100 : null);
export const totaalExBtw = (regels) => Math.round((regels || []).reduce((s, r) => s + (regelTotaal(r) || 0), 0) * 100) / 100;

// ── Opmaak van gegevens ─────────────────────────────────────────────────────
// Nederlands kenteken met streepjes: "11MDGR" → "11-MD-GR", "AB123C" → "AB-123-C"
export function kentekenMetStreepjes(k) {
  const s = String(k ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 6) return String(k ?? "").toUpperCase();
  const groepen = s.match(/[A-Z]+|\d+/g) || [];
  if (groepen.length === 3) return groepen.join("-");
  return [s.slice(0, 2), s.slice(2, 4), s.slice(4)].join("-");
}

// Excel-datum (dagen sinds 30-12-1899) van "2026-11-27"
export function excelDatum(iso) {
  const [j, m, d] = String(iso).split("-").map(Number);
  return Math.round((Date.UTC(j, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

export const bestandsnaam = (nummer, naam) =>
  `Factuur ${nummer}${naam ? ` - ${String(naam).replace(/[\\/:*?"<>|]+/g, "").trim()}` : ""}.xlsx`;

// ── Het Excel-bestand ───────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kolomNr = (k) => [...k].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

// Eén cel in de werkblad-XML zetten met behoud van de opmaak (s="…"). Leeg = cel zonder waarde.
export function zetCel(xml, ref, waarde) {
  const [, kol, rij] = ref.match(/^([A-Z]+)(\d+)$/);
  const celRe = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(celRe);
  const stijl = m && (m[1].match(/\ss="(\d+)"/) || [])[1];
  const s = stijl ? ` s="${stijl}"` : "";
  let nieuw;
  if (waarde === null || waarde === undefined || waarde === "") nieuw = `<c r="${ref}"${s}/>`;
  else if (typeof waarde === "number") nieuw = `<c r="${ref}"${s} t="n"><v>${waarde}</v></c>`;
  else nieuw = `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(waarde)}</t></is></c>`;
  if (m) return xml.replace(celRe, () => nieuw);
  if (!s && nieuw === `<c r="${ref}"/>`) return xml; // leeg laten wat er niet is
  const rijRe = new RegExp(`(<row r="${rij}"[^>]*>)([\\s\\S]*?)(</row>)`);
  const rm = xml.match(rijRe);
  if (!rm) throw new Error(`Rij ${rij} ontbreekt in het factuursjabloon`);
  const cRe = /<c r="([A-Z]+)\d+"/g;
  let pos = rm[2].length, mm;
  while ((mm = cRe.exec(rm[2]))) { if (kolomNr(mm[1]) > kolomNr(kol)) { pos = mm.index; break; } }
  return xml.replace(rijRe, () => rm[1] + rm[2].slice(0, pos) + nieuw + rm[2].slice(pos) + rm[3]);
}

// Alle cellen van de factuur invullen (zie het sjabloon: links de factuur, rechts de instellingen)
export function vulWerkblad(xml, g) {
  const nummer = Number(g.nummer);
  const km = g.motor?.km;
  const cellen = {
    G3: excelDatum(g.datum), J3: "Factuur", J5: g.betaalwijze || "Contant/pin",
    J11: Number.isFinite(nummer) ? nummer - 1 : "", C16: Number.isFinite(nummer) ? nummer : String(g.nummer ?? ""),
    B9: g.klant?.naam || "", B10: g.klant?.adres || "", B11: g.klant?.plaats || "",
    B12: g.klant?.email || "", B13: g.klant?.telefoon || "", B14: "",
    F11: g.motor?.omschrijving || "", G12: g.motor?.kenteken ? kentekenMetStreepjes(g.motor.kenteken) : "",
    G13: km === "" || km == null ? "" : Number.isFinite(Number(km)) ? Number(km) : String(km),
    G14: g.motor?.vin || "", G47: "",
  };
  const regels = (g.regels || []).slice(0, MAX_REGELS);
  for (let i = 0; i < MAX_REGELS; i++) {
    const r = regels[i];
    const rij = 19 + i;
    cellen[`A${rij}`] = r && r.aantal != null && r.aantal !== "" ? Number(r.aantal) : "";
    cellen[`B${rij}`] = r ? r.omschrijving || "" : "";
    cellen[`F${rij}`] = r && r.prijs != null && r.prijs !== "" ? Number(r.prijs) : "";
    cellen[`I${rij}`] = "";
    cellen[`J${rij}`] = "";
  }
  let uit = xml;
  for (const [ref, waarde] of Object.entries(cellen)) uit = zetCel(uit, ref, waarde);
  return uit;
}

// Sjabloon (bytes) + gegevens → nieuw .xlsx-bestand (Uint8Array)
export async function maakFactuur(sjabloon, gegevens) {
  const mod = await import("xlsx");
  const CFB = (mod.CFB || mod.default?.CFB);
  const zip = CFB.read(new Uint8Array(sjabloon), { type: "array" });
  const i = zip.FullPaths.findIndex((p) => p.endsWith("xl/worksheets/sheet1.xml"));
  if (i < 0) throw new Error("Werkblad niet gevonden in het factuursjabloon");
  const xml = new TextDecoder().decode(zip.FileIndex[i].content);
  CFB.utils.cfb_add(zip, "/xl/worksheets/sheet1.xml", new TextEncoder().encode(vulWerkblad(xml, gegevens)));
  return new Uint8Array(CFB.write(zip, { fileType: "zip", type: "array", compression: true }));
}
