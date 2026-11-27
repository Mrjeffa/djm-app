// Onderhoudslijst per afspraak (naar het papieren formulier van de werkplaats).
// Het sjabloon staat in instellingen.onderhoudslijst; de ingevulde lijst per afspraak in de
// tabel onderhoudslijsten (zie supabase/onderhoudslijst.sql). De namen van de punten staan in
// de ingevulde lijst zelf: een later aangepast sjabloon verandert een ingevulde lijst niet.
//
// Vorm van een ingevulde lijst:
// { klein_onderhoud: bool, groot_onderhoud: bool, km: "12345", km_eenheid: "km" | "mijl",
//   werkzaamheden: [{ naam, gedaan, extra? }],      // uit de afspraak (soort) + zelf toegevoegd
//   controle:      [{ naam, status, notitie }],      // status: oke | advies | vervangen | nvt | null
//   groot:         [{ naam, gedaan, type }],         // groot onderhoud: uitgevoerd + type onderdeel
//   opmerking: "",
//   factuur: { nummer, datum } | null }                // laatst gemaakte factuur voor deze afspraak

export const STANDAARD_SJABLOON = {
  controle: [
    "Verlichting voor / achter", "Dashboardverlichting", "Fuel conditioner",
    "Smeerpunten (standaard, stepjes, etc.)", "Olie", "Oliefilter", "Koelvloeistof check, niveau, kleur",
    "Accu laadspanning meten", "Accu boutjes, vloeistofniveau", "Cardan olie", "Ketting/tandwielen",
    "Remschijven voor/achter", "Remblokken voor", "Remvloeistof voor", "Remblokken achter",
    "Remvloeistof achter", "Hydraulische koppelingsbediening", "Bandenprofiel + spanning",
    "Gaskabel/koppelingskabel", "Voorvork-keerring lekkage", "Wiellagers (geluid + speling)",
    "Balhoofdlagers", "Algemene visuele inspectie",
  ],
  groot: ["Oliefilter", "Luchtfilter", "Bougies", "Kleppen stellen"],
};

export const STATUSSEN = [
  { id: "oke", label: "Oké", titel: "In orde" },
  { id: "advies", label: "Advies", titel: "Adviespunt voor de klant" },
  { id: "vervangen", label: "Vervangen", titel: "Vervangen" },
  { id: "nvt", label: "N.v.t.", titel: "Niet aanwezig op deze motor" },
];

const lijstVan = (x, terugval) => (Array.isArray(x) ? x.filter((n) => typeof n === "string" && n.trim()) : terugval);

export const geldigSjabloon = (s) => ({
  controle: lijstVan(s?.controle, STANDAARD_SJABLOON.controle),
  groot: lijstVan(s?.groot, STANDAARD_SJABLOON.groot),
});

// "Kleine beurt, Voorband vervangen" → ["Kleine beurt", "Voorband vervangen"]
export const soortenVan = (soort) => String(soort || "").split(",").map((x) => x.trim()).filter(Boolean);

// Punten uit het sjabloon (in die volgorde) met wat al was ingevuld; eerder ingevulde punten
// die niet meer in het sjabloon staan blijven staan.
const voegSamen = (oud, namen, leeg, heeftWaarde) => {
  const bestaand = Array.isArray(oud) ? oud.filter((x) => x && typeof x.naam === "string") : [];
  const opNaam = new Map(bestaand.map((x) => [x.naam, x]));
  const uit = namen.map((naam) => ({ ...leeg(naam), ...(opNaam.get(naam) || {}), naam }));
  for (const x of bestaand) if (!namen.includes(x.naam) && heeftWaarde(x)) uit.push(x);
  return uit;
};

// Een nieuwe of opgeslagen lijst gereed maken om te tonen
export function bouwLijst(opgeslagen, sjabloon, afspraak) {
  const o = opgeslagen && typeof opgeslagen === "object" ? opgeslagen : {};
  const sj = geldigSjabloon(sjabloon);
  const soorten = soortenVan(afspraak?.soort);
  const werkOud = Array.isArray(o.werkzaamheden) ? o.werkzaamheden.filter((x) => x && typeof x.naam === "string") : [];
  const werk = [...werkOud, ...soorten.filter((n) => !werkOud.some((x) => x.naam === n)).map((naam) => ({ naam, gedaan: false }))];
  return {
    klein_onderhoud: typeof o.klein_onderhoud === "boolean" ? o.klein_onderhoud : soorten.some((x) => /kleine beurt|klein onderhoud/i.test(x)),
    groot_onderhoud: typeof o.groot_onderhoud === "boolean" ? o.groot_onderhoud : soorten.some((x) => /grote beurt|groot onderhoud/i.test(x)),
    km: typeof o.km === "string" ? o.km : o.km != null ? String(o.km) : "",
    km_eenheid: o.km_eenheid === "mijl" ? "mijl" : "km",
    werkzaamheden: werk,
    controle: voegSamen(o.controle, sj.controle, (naam) => ({ naam, status: null, notitie: "" }), (x) => !!x.status || !!x.notitie),
    groot: voegSamen(o.groot, sj.groot, (naam) => ({ naam, gedaan: false, type: "" }), (x) => !!x.gedaan || !!x.type),
    opmerking: typeof o.opmerking === "string" ? o.opmerking : "",
    // gemaakte factuur (nummer + datum), zie FactuurModal
    factuur: o.factuur && typeof o.factuur === "object" ? o.factuur : null,
  };
}

// Is er al iets ingevuld?
export const isIngevuld = (l) => !!l && (
  !!l.km || !!l.opmerking ||
  (l.werkzaamheden || []).some((x) => x.gedaan) ||
  (l.controle || []).some((x) => x.status || x.notitie) ||
  (l.groot || []).some((x) => x.gedaan || x.type));

export function voortgang(l) {
  const controle = l?.controle || [];
  const tel = (st) => controle.filter((x) => x.status === st).length;
  return {
    gecontroleerd: controle.filter((x) => x.status).length,
    totaal: controle.length,
    advies: tel("advies"),
    vervangen: tel("vervangen"),
    werkGedaan: (l?.werkzaamheden || []).filter((x) => x.gedaan).length,
    werkTotaal: (l?.werkzaamheden || []).length,
    grootGedaan: (l?.groot || []).filter((x) => x.gedaan).length,
  };
}

// Korte regel voor in de afspraakdetails
export function voortgangTekst(l) {
  if (!isIngevuld(l)) return "Nog niet ingevuld";
  const v = voortgang(l);
  return [
    `${v.gecontroleerd} van ${v.totaal} punten gecontroleerd`,
    v.advies && `${v.advies} adviespunt${v.advies > 1 ? "en" : ""}`,
    v.vervangen && `${v.vervangen} vervangen`,
    v.werkTotaal && `werkzaamheden ${v.werkGedaan}/${v.werkTotaal}`,
  ].filter(Boolean).join(" · ");
}

const metNotitie = (x) => (x.notitie?.trim() ? `${x.naam} (${x.notitie.trim()})` : x.naam);

// Tekst voor "Uitgevoerde werkzaamheden" bij afwerken (komt in de servicehistorie van de klant)
export function samenvatting(l) {
  if (!isIngevuld(l)) return "";
  const regels = [];
  const soort = [l.klein_onderhoud && "Klein onderhoud", l.groot_onderhoud && "Groot onderhoud"].filter(Boolean).join(" + ");
  if (soort) regels.push(soort);
  const uitgevoerd = [
    ...(l.werkzaamheden || []).filter((x) => x.gedaan).map((x) => x.naam),
    ...(l.groot || []).filter((x) => x.gedaan).map((x) => (x.type?.trim() ? `${x.naam} (${x.type.trim()})` : x.naam)),
  ];
  if (uitgevoerd.length) regels.push(`Uitgevoerd: ${uitgevoerd.join(", ")}`);
  const controle = l.controle || [];
  const vervangen = controle.filter((x) => x.status === "vervangen").map(metNotitie);
  if (vervangen.length) regels.push(`Vervangen: ${vervangen.join(", ")}`);
  const oke = controle.filter((x) => x.status === "oke").length;
  if (oke) regels.push(`Gecontroleerd en in orde: ${oke} punt${oke > 1 ? "en" : ""}`);
  const advies = controle.filter((x) => x.status === "advies").map(metNotitie);
  if (advies.length) regels.push(`Adviespunten: ${advies.join(", ")}`);
  return regels.join("\n");
}

// Reservekopie op dit apparaat zolang opslaan niet gelukt is (geen netwerk in de werkplaats)
const sleutel = (afspraakId) => `djm-onderhoudslijst-${afspraakId}`;
export function leesReservekopie(afspraakId) {
  try { const r = JSON.parse(localStorage.getItem(sleutel(afspraakId)) || "null"); return r && r.lijst ? r : null; } catch { return null; }
}
export function schrijfReservekopie(afspraakId, lijst) {
  try { localStorage.setItem(sleutel(afspraakId), JSON.stringify({ lijst, bewaard: new Date().toISOString() })); } catch { /* geen opslag beschikbaar */ }
}
export function wisReservekopie(afspraakId) {
  try { localStorage.removeItem(sleutel(afspraakId)); } catch { /* niets */ }
}
