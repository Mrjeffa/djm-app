// Pure rekenlogica van de voorraad-prijscheck — geen netwerk, geen Deno-API's,
// zodat zowel de edge function als de app (Vite) dit bestand kan gebruiken en
// het los te testen is (zie logica.test.ts).
//
// De Motoroccasion-typekeuze is een port van inkoop-radar/motoroccasion.py
// (zelfde regels, zelfde tests). Pas je daar iets aan, doe het hier ook.

export const MO_BASIS = "https://www.motoroccasion.nl";
export const KM_MARGE = 10_000;          // "ongeveer dezelfde km-stand"
export const MIN_MARGE = 1_000;          // vraagprijs minimaal inkoop + €1.000
export const EIGEN_DEALER = "De Jonge Motoren"; // eigen advertenties niet als concurrent tellen

export type Aanbod = {
  prijs: number | null; bouwjaar: number | null; km: number | null;
  nieuw: boolean; btw: boolean; url: string | null; titel: string; dealer: string | null;
};
export type Concurrent = { prijs: number; bouwjaar: number; km: number; dealer: string | null; url: string | null };

/** Bedrag/aantal uit (Nederlandse) invoer → geheel getal, of null.
 *  "6.500", "€ 6.500,-", "15 000" → 6500 / 15000 (punt/spatie = duizendtal);
 *  "6500,00", "7500.00", "7500,5" → 6500 / 7500 (1–2 cijfers na punt/komma = decimalen);
 *  "1,000" / "1.250.000" → 1000 / 1250000. (parseInt("6.500") zou 6 geven.) */
export function naarBedrag(v: unknown): number | null {
  let s = String(v ?? "").trim().replace(/[€\s]/g, "").replace(/[.,]-$/, "");
  s = s.replace(/[.,]\d{1,2}$/, "");   // decimalen weg
  s = s.replace(/[.,]/g, "");          // duizendtallen weg
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export const norm = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const slug = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ── Typekeuze (port van motoroccasion.kies_type) ──────────────────────────────
const tokens = (s?: string | null) => (s || "").toLowerCase().match(/[a-z]+|\d+/g) || [];

function staatIn(typeNaam: string, titelTokens: string[]): boolean {
  const doel = norm(typeNaam);
  for (let i = 0; i < titelTokens.length; i++) {
    let acc = "";
    for (const tok of titelTokens.slice(i)) {
      acc += tok;
      if (acc === doel) return true;
      if (!doel.startsWith(acc)) break;
    }
  }
  return false;
}

const lettersCijfers = (s: string): [string, string] => {
  const n = norm(s);
  return [n.replace(/\d/g, ""), n.replace(/\D/g, "")];
};

// Ratcliff/Obershelp-gelijkenis (zoals Python's difflib.SequenceMatcher.ratio)
function overeenkomsten(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0, ia = 0, ib = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) { best = k; ia = i; ib = j; }
    }
  }
  if (!best) return 0;
  return best + overeenkomsten(a.slice(0, ia), b.slice(0, ib)) + overeenkomsten(a.slice(ia + best), b.slice(ib + best));
}
export const gelijkenis = (a: string, b: string) =>
  a.length + b.length ? (2 * overeenkomsten(a, b)) / (a.length + b.length) : 1;
const lijkt = (a: string, b: string, drempel = 0.8) => a === b || gelijkenis(a, b) >= drempel;

/** Kiest het Motoroccasion-type ([key, naam]) voor een titel/model, of null.
 *  1. meest specifieke type dat in de titel staat en het model bevat;
 *  2. type dat exact het model is (als de titel het model noemt);
 *  3. spelfout-tolerant: letters mogen licht afwijken, cijfers exact. */
export function kiesType(titel: string, model: string, types: [string, string][]): [string, string] | null {
  const m = norm(model), toks = tokens(titel);
  if (!m) return null;
  const inTitel = types.filter(([, n]) => norm(n).includes(m) && staatIn(n, toks));
  if (inTitel.length) return inTitel.reduce((a, b) => (norm(b[1]).length > norm(a[1]).length ? b : a));
  const exact = types.filter(([, n]) => norm(n) === m);
  if (exact.length && norm(titel).includes(m)) return exact[0];

  const [mLetters] = lettersCijfers(model);
  const woorden = (titel || "").split(/\s+/).filter(Boolean);
  const stukjes = new Set<string>();
  for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= woorden.length; i++) stukjes.add(woorden.slice(i, i + n).join(" "));
  let beste: { score: [number, number]; type: [string, string] } | null = null;
  for (const [k, naam] of types) {
    const [letters, cijfers] = lettersCijfers(naam);
    if (!cijfers || !letters || !(letters.includes(mLetters) || lijkt(mLetters, letters, 0.7))) continue;
    for (const stuk of stukjes) {
      const [sL, sC] = lettersCijfers(stuk);
      if (sC === cijfers && lijkt(sL, letters)) {
        const score: [number, number] = [gelijkenis(sL, letters), norm(naam).length];
        if (!beste || score[0] > beste.score[0] || (score[0] === beste.score[0] && score[1] > beste.score[1])) {
          beste = { score, type: [k, naam] };
        }
      }
    }
  }
  return beste ? beste.type : null;
}

/** Typekeuze voor eigen voorraad: het modelveld kan extra woorden bevatten
 *  ("Z900 ABS", "Versys 650 Tourer"). Neem het langste Motoroccasion-type dat
 *  als hele woorddelen in het model staat; anders de gewone (spelfout-tolerante) keuze. */
export function kiesTypeVoorraad(model: string, types: [string, string][]): [string, string] | null {
  const toks = tokens(model);
  const erin = types.filter(([, n]) => norm(n).length >= 3 && staatIn(n, toks));
  if (erin.length) return erin.reduce((a, b) => (norm(b[1]).length > norm(a[1]).length ? b : a));
  return kiesType(model, model, types);
}

/** [typekey, typenaam] uit de typeOptions van een Motoroccasion-antwoord. */
export function typesUit(data: any): [string, string][] {
  const out: [string, string][] = [];
  for (const groep of Object.values(data?.typeOptions || {}) as any[]) {
    for (const opt of Object.values(groep?.options || {}) as any[]) {
      const key = opt?.value || opt?.key;
      const naam = String(opt?.text || opt?.name || "").replace(/\s*\(\d+\)\s*$/, "");
      if (key && naam) out.push([key, naam]);
    }
  }
  return out;
}

export const mooi = (typeNaam: string) => (typeNaam || "").replace(/[A-Za-z]{4,}/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

/** Eén zoekverzoek: zelfde bouwjaar, prijs laag → hoog, alleen pagina 1. */
export const zoekUrl = (merk: string, typeKey: string, bouwjaar: number) =>
  `${MO_BASIS}/motoren/${merk}-${typeKey}?filters=bouwjaar-vanaf-${bouwjaar}/bouwjaar-tot-${bouwjaar}/sortering-prijsoplopend`;

export function naarAanbod(it: any): Aanbod {
  const a = it?.attributesByKey || {};
  const pi = a.price || {};
  let prijs = typeof pi.amount === "number" && pi.amount > 0 ? Math.round(pi.amount) : null;
  if (String(pi.priceType || "").toLowerCase().includes("aanvraag")) prijs = null;
  const legacy = it?.legacyId, sl = it?.slug || "motor";
  return {
    prijs, bouwjaar: it?.manufactureYear ?? null, km: a.odometer?.value ?? null,
    nieuw: !!a.new, btw: !!a.vat_deductible,
    url: legacy ? `${MO_BASIS}/motoren/${sl}-m${legacy}.html` : null,
    titel: `${it?.brand || ""} ${it?.type || ""}`.trim(), dealer: it?.companyName ?? null,
  };
}

/** Vergelijkbare concurrenten: zelfde bouwjaar, ±KM_MARGE km, met prijs, geen
 *  nieuw/0 km, geen BTW-motor, niet je eigen advertentie. Goedkoopste eerst. */
export function concurrentenUit(aanbod: Aanbod[], bouwjaar: number, km: number, eigenDealer = EIGEN_DEALER): Concurrent[] {
  const eigen = norm(eigenDealer);
  return aanbod
    .filter((a) => a.prijs && a.prijs > 0 && !a.nieuw && a.km && !a.btw && a.bouwjaar === bouwjaar
      && Math.abs((a.km as number) - km) <= KM_MARGE && !(eigen && norm(a.dealer).includes(eigen)))
    .map((a) => ({ prijs: a.prijs as number, bouwjaar: a.bouwjaar as number, km: a.km as number, dealer: a.dealer, url: a.url }))
    .sort((x, y) => x.prijs - y.prijs);
}

// ── Beoordeling (gedeeld door app en wekelijkse mail) ─────────────────────────
export type Beoordeling = {
  kleur: "groen" | "geel" | "rood" | "grijs";
  kop: string;
  advies: number | null;          // prijs om de goedkoopste te worden (als dat boven je minimum blijft)
  minimum: number | null;         // inkoop + €1.000
  margeTeLaag: boolean;           // vraagprijs ligt nu al onder je minimum
  actieNodig: boolean;            // voor de mail
};

/** Net onder de goedkoopste concurrent, afgerond op €50 naar beneden. */
export const nietDuurderDan = (prijs: number) => Math.floor((prijs - 1) / 50) * 50;

export function beoordeel(vraagprijs: number | null, inkoopprijs: number | null, concurrenten: Concurrent[] | null): Beoordeling {
  const minimum = inkoopprijs != null ? inkoopprijs + MIN_MARGE : null;
  const margeTeLaag = minimum != null && vraagprijs != null && vraagprijs < minimum;
  const laagste = (concurrenten || [])[0];
  const euro = (n: number) => `€${n.toLocaleString("nl-NL")}`;

  if (!vraagprijs) return { kleur: "grijs", kop: "Geen vraagprijs ingevuld", advies: null, minimum, margeTeLaag, actieNodig: false };
  if (!laagste) {
    return { kleur: "grijs", kop: "Geen vergelijkbare motor op Motoroccasion", advies: null, minimum, margeTeLaag, actieNodig: margeTeLaag };
  }
  const n = concurrenten!.length;
  if (laagste.prijs >= vraagprijs) {
    const kop = laagste.prijs === vraagprijs
      ? `Even duur als de goedkoopste (${n} vergelijkbaar)`
      : `Jij bent het goedkoopst (${n} vergelijkbaar)`;
    return { kleur: "groen", kop, advies: null, minimum, margeTeLaag, actieNodig: margeTeLaag };
  }
  const goedkoper = concurrenten!.filter((c) => c.prijs < vraagprijs).length;
  const kop = `${goedkoper} goedkoper aangeboden — laagste ${euro(laagste.prijs)}`;
  // Onder de goedkoopste kan alleen als je minimum daar nog onder ligt.
  if (minimum != null && minimum >= laagste.prijs) {
    return { kleur: "rood", kop, advies: null, minimum, margeTeLaag, actieNodig: true };
  }
  // Net onder de goedkoopste (op €50), maar nooit onder je minimum.
  const advies = minimum != null ? Math.max(nietDuurderDan(laagste.prijs), minimum) : nietDuurderDan(laagste.prijs);
  return { kleur: "geel", kop, advies, minimum, margeTeLaag, actieNodig: true };
}
