// Winterstalling: één regel per motor per seizoen (tabel winterstalling, zie
// supabase/winterstalling.sql). Seizoen = het jaar waarin de winter begint: 2026 = 2026/2027.

export const STATUSSEN = [
  { id: "aangevraagd", label: "Aanvraag", kleur: "#D97706" },
  { id: "gereserveerd", label: "Gereserveerd", kleur: "#2563EB" },
  { id: "binnen", label: "Binnen", kleur: "#16A34A" },
  { id: "opgehaald", label: "Opgehaald", kleur: "#767676" },
];
export const statusVan = (id) => STATUSSEN.find((s) => s.id === id) || STATUSSEN[1];

export const BETAALWIJZEN = [
  { id: "contant", label: "Contant" },
  { id: "pin", label: "Pin" },
  { id: "bank", label: "Bank" },
];

export const PAKKETTEN = ["Alleen stalling", "Met poetsbeurt", "Met kleine beurt", "Met grote beurt"];

// Januari t/m maart hoort bij de lopende winter, vanaf april bij de komende (zelfde regel als
// vraag_winterstalling_aan in de database)
export function huidigSeizoen(datum = new Date()) {
  return datum.getFullYear() - (datum.getMonth() < 3 ? 1 : 0);
}
export const seizoenLabel = (s) => `${s}/${s + 1}`;

const normKenteken = (k) => String(k || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
export { normKenteken };

// "Honda CBF600 · AB-123-C"
export function motorTekst(w, metKenteken = true) {
  const naam = [w?.merk, w?.model].filter(Boolean).join(" ");
  const k = metKenteken && w?.kenteken ? kentekenStreepjes(w.kenteken) : "";
  return [naam, k].filter(Boolean).join(" · ");
}
function kentekenStreepjes(k) {
  const s = normKenteken(k);
  if (s.length !== 6) return s;
  const g = s.match(/[A-Z]+|\d+/g) || [];
  return g.length === 3 ? g.join("-") : [s.slice(0, 2), s.slice(2, 4), s.slice(4)].join("-");
}

// Zoeken op naam, motor, kenteken, telefoon, e-mail en werkzaamheden
export function past(w, zoek) {
  const z = String(zoek || "").trim().toLowerCase();
  if (!z) return true;
  const zKen = normKenteken(z);
  return [w.naam, w.merk, w.model, w.telefoon, w.email, w.werkzaamheden, w.pakket]
    .some((x) => String(x || "").toLowerCase().includes(z))
    || (zKen.length >= 2 && normKenteken(w.kenteken).includes(zKen));
}

// Tussenvoegsels tellen niet mee bij het sorteren (zoals in een telefoonboek: "Frans de Koning"
// staat bij de K)
const TUSSENVOEGSELS = new Set(["van", "de", "der", "den", "het", "'t", "t", "te", "ter", "ten", "in", "op",
  "aan", "bij", "uit", "onder", "over", "voor", "v/d", "vd", "v.d.", "v.d", "d'", "l'", "la", "le", "von",
  "vom", "zu", "del", "della", "da", "das", "dos", "di", "du", "des"]);
const isTussen = (woord) => TUSSENVOEGSELS.has(woord.toLowerCase());

// "Frans de Koning" → { voornaam: "Frans", achternaam: "Koning" }. Eén woord ("Meijer") geldt
// als achternaam; zonder tussenvoegsel is het laatste woord de achternaam.
export function naamDelen(naam) {
  const w = String(naam || "").trim().split(/\s+/).filter(Boolean);
  if (w.length <= 1) return { voornaam: "", achternaam: w[0] || "" };
  const start = isTussen(w[0]) ? 0 : 1; // "Van Heusden": geen voornaam
  let i = w.findIndex((x, j) => j >= start && isTussen(x));
  if (i === -1) return { voornaam: w.slice(0, -1).join(" "), achternaam: w[w.length - 1] };
  const voornaam = w.slice(0, i).join(" ");
  while (i < w.length - 1 && isTussen(w[i])) i++;
  return { voornaam, achternaam: w.slice(i).join(" ") };
}

const vergelijk = (a, b) => String(a || "").localeCompare(String(b || ""), "nl", { sensitivity: "base", numeric: true });
// Op achternaam, dan voornaam (richting -1 = Z-A); zonder naam altijd achteraan
const naamVolgorde = (richting) => (a, b) => {
  const na = naamDelen(a.naam), nb = naamDelen(b.naam);
  return (!na.achternaam - !nb.achternaam)
    || richting * (vergelijk(na.achternaam, nb.achternaam) || vergelijk(na.voornaam, nb.voornaam));
};
export const opAchternaam = naamVolgorde(1);
const STATUS_VOLGORDE = ["aangevraagd", "gereserveerd", "binnen", "opgehaald"];

export const SORTERINGEN = [
  { id: "achternaam", label: "Achternaam (A-Z)", fn: opAchternaam },
  { id: "achternaam_za", label: "Achternaam (Z-A)", fn: naamVolgorde(-1) },
  { id: "motor", label: "Merk en type", fn: (a, b) => (!a.merk - !b.merk) || vergelijk(motorTekst(a, false), motorTekst(b, false)) || opAchternaam(a, b) },
  { id: "status", label: "Status", fn: (a, b) => STATUS_VOLGORDE.indexOf(a.status) - STATUS_VOLGORDE.indexOf(b.status) || opAchternaam(a, b) },
  { id: "onbetaald", label: "Niet betaald eerst", fn: (a, b) => (!!a.betaald - !!b.betaald) || opAchternaam(a, b) },
  { id: "binnen_op", label: "Binnen op (oudste eerst)", fn: (a, b) => (!a.binnen_op - !b.binnen_op) || vergelijk(a.binnen_op, b.binnen_op) || opAchternaam(a, b) },
  { id: "nieuwste", label: "Laatst toegevoegd", fn: (a, b) => vergelijk(b.aangemaakt, a.aangemaakt) || opAchternaam(a, b) },
];
export const sorteerFn = (id) => (SORTERINGEN.find((x) => x.id === id) || SORTERINGEN[0]).fn;
export const sorteer = opAchternaam;

export function telling(lijst) {
  const actief = lijst.filter((w) => w.status !== "aangevraagd");
  return {
    totaal: actief.length,
    aanvragen: lijst.length - actief.length,
    gereserveerd: actief.filter((w) => w.status === "gereserveerd").length,
    binnen: actief.filter((w) => w.status === "binnen").length,
    opgehaald: actief.filter((w) => w.status === "opgehaald").length,
    betaald: actief.filter((w) => w.betaald).length,
  };
}

// Doorzetten naar het volgende seizoen: zelfde klant, motor en pakket; status gereserveerd,
// niet betaald, zonder werkzaamheden en opmerkingen (die horen bij dit seizoen). Wat al in het
// nieuwe seizoen staat (zelfde motor, of al doorgezet) wordt overgeslagen.
export function doorzetRegels(rijen, naar, inDoel) {
  const motoren = new Set(inDoel.map((w) => w.motor_id).filter(Boolean));
  const van = new Set(inDoel.map((w) => w.doorgezet_van).filter(Boolean));
  const uit = [];
  for (const w of [...rijen].sort(sorteer)) {
    if (w.status === "aangevraagd" || van.has(w.id) || (w.motor_id && motoren.has(w.motor_id))) continue;
    if (w.motor_id) motoren.add(w.motor_id);
    uit.push({
      seizoen: naar, status: "gereserveerd", klant_id: w.klant_id, motor_id: w.motor_id,
      naam: w.naam, telefoon: w.telefoon, email: w.email, merk: w.merk, model: w.model, kenteken: w.kenteken,
      pakket: w.pakket, werkzaamheden: null, opmerking: null, betaald: false, betaalwijze: null,
      bron: "doorgezet", doorgezet_van: w.id,
    });
  }
  return uit;
}

// Al doorgezet naar het volgende seizoen?
export const isDoorgezet = (w, alle) =>
  alle.some((x) => x.seizoen === w.seizoen + 1 && (x.doorgezet_van === w.id || (w.motor_id && x.motor_id === w.motor_id)));

// Rijen voor de Excel-lijst (zelfde opzet als de lijst van de zaak), in de gekozen volgorde
export function excelRijen(lijst, seizoen, sortering = "achternaam") {
  const datum = (d) => (d ? d.split("-").reverse().join("-") : "");
  return [
    [`Winterstalling ${seizoenLabel(seizoen)}`],
    [],
    ["Naam klant", "Merk", "Type", "Kenteken", "Pakket", "Werkzaamheden", "Mailadres", "Telefoonnummer", "Status", "Betaald", "Betaalwijze", "Binnen op", "Opgehaald op", "Opmerking"],
    ...[...lijst].sort(sorteerFn(sortering)).map((w) => [
      w.naam || "", w.merk || "", w.model || "", w.kenteken ? kentekenStreepjes(w.kenteken) : "",
      w.pakket || "", w.werkzaamheden || "", w.email || "", w.telefoon || "", statusVan(w.status).label,
      w.betaald ? "Betaald" : "", BETAALWIJZEN.find((b) => b.id === w.betaalwijze)?.label || "",
      datum(w.binnen_op), datum(w.opgehaald_op), w.opmerking || "",
    ]),
  ];
}
