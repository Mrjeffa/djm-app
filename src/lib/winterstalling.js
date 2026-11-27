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
  return [w.naam, w.merk, w.model, w.telefoon, w.email, w.werkzaamheden, w.pakket, w.nummer != null ? `#${w.nummer}` : ""]
    .some((x) => String(x || "").toLowerCase().includes(z))
    || (zKen.length >= 2 && normKenteken(w.kenteken).includes(zKen));
}

// Op nummer, daarna op naam; aanvragen (zonder nummer) achteraan
export const sorteer = (a, b) =>
  (a.nummer ?? 1e9) - (b.nummer ?? 1e9) || String(a.naam || "").localeCompare(String(b.naam || ""), "nl");

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

// Volgend vrij nummer in een seizoen
export const volgendNummer = (lijst) => Math.max(0, ...lijst.map((w) => w.nummer || 0)) + 1;

// Doorzetten naar het volgende seizoen: zelfde klant, motor en pakket; status gereserveerd,
// niet betaald, zonder werkzaamheden en opmerkingen (die horen bij dit seizoen). Wat al in het
// nieuwe seizoen staat (zelfde motor, of al doorgezet) wordt overgeslagen. Het nummer blijft
// hetzelfde als het daar nog vrij is.
export function doorzetRegels(rijen, naar, inDoel) {
  const bezet = new Set(inDoel.map((w) => w.nummer).filter(Boolean));
  const motoren = new Set(inDoel.map((w) => w.motor_id).filter(Boolean));
  const van = new Set(inDoel.map((w) => w.doorgezet_van).filter(Boolean));
  let volgend = volgendNummer(inDoel);
  const uit = [];
  for (const w of [...rijen].sort(sorteer)) {
    if (w.status === "aangevraagd" || van.has(w.id) || (w.motor_id && motoren.has(w.motor_id))) continue;
    let nummer = w.nummer && !bezet.has(w.nummer) ? w.nummer : null;
    if (!nummer) { while (bezet.has(volgend)) volgend++; nummer = volgend; }
    bezet.add(nummer);
    if (w.motor_id) motoren.add(w.motor_id);
    uit.push({
      seizoen: naar, nummer, status: "gereserveerd", klant_id: w.klant_id, motor_id: w.motor_id,
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

// Rijen voor de Excel-lijst (zelfde opzet als de lijst van de zaak)
export function excelRijen(lijst, seizoen) {
  const datum = (d) => (d ? d.split("-").reverse().join("-") : "");
  return [
    [`Winterstalling ${seizoenLabel(seizoen)}`],
    [],
    ["Nr", "Naam klant", "Merk", "Type", "Kenteken", "Pakket", "Werkzaamheden", "Mailadres", "Telefoonnummer", "Status", "Betaald", "Betaalwijze", "Binnen op", "Opgehaald op", "Opmerking"],
    ...[...lijst].sort(sorteer).map((w) => [
      w.nummer ?? "", w.naam || "", w.merk || "", w.model || "", w.kenteken ? kentekenStreepjes(w.kenteken) : "",
      w.pakket || "", w.werkzaamheden || "", w.email || "", w.telefoon || "", statusVan(w.status).label,
      w.betaald ? "Betaald" : "", BETAALWIJZEN.find((b) => b.id === w.betaalwijze)?.label || "",
      datum(w.binnen_op), datum(w.opgehaald_op), w.opmerking || "",
    ]),
  ];
}
