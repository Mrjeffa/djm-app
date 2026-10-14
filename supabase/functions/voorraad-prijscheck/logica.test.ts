// Tests voor logica.ts. Draaien (vanuit de repo-root):
//   npx esbuild supabase/functions/voorraad-prijscheck/logica.test.ts --bundle --platform=node --outfile=/tmp/t.mjs --format=esm && node /tmp/t.mjs
import {
  beoordeel, concurrentenUit, kiesType, kiesTypeVoorraad, lokprijsUit, marktAanbod, mooi, naarBedrag, zoekUrl, type Aanbod,
} from "./logica.ts";

let ok = 0;
function gelijk(echt: unknown, verwacht: unknown, wat: string) {
  if (JSON.stringify(echt) !== JSON.stringify(verwacht)) {
    throw new Error(`FOUT ${wat}: kreeg ${JSON.stringify(echt)}, verwacht ${JSON.stringify(verwacht)}`);
  }
  ok++;
}

// Zelfde gevallen als inkoop-radar/test_motoroccasion.py (pariteit met de Python-versie)
const SUZUKI: [string, string][] = [["dl-650-v-strom", "DL 650 V-STROM"], ["v-strom-650", "V-STROM 650"], ["v-strom-650-xt", "V-STROM 650 XT"],
  ["v-strom-1050", "V-STROM 1050"], ["v-strom-1050-de", "V-STROM 1050 DE"], ["sv-650", "SV 650"]];
const KAWASAKI: [string, string][] = [["versys-650", "VERSYS 650"], ["versys-1000", "VERSYS 1000"], ["z-800", "Z 800"], ["z-800-e", "Z 800 E"],
  ["z-900", "Z 900"], ["z-900-rs", "Z 900 RS"], ["z-900-rs-cafe", "Z 900 RS CAFE"], ["z-90", "Z 90"]];
const kies = (t: string, m: string, types: [string, string][]) => kiesType(t, m, types)?.[0] ?? null;

gelijk(kies("Kawasaki Z900 2020 performance", "Z900", KAWASAKI), "z-900", "Z900");
gelijk(kies("Kawasaki Z900RS Cafe 2019", "Z900", KAWASAKI), "z-900-rs-cafe", "Z900RS Cafe");
gelijk(kies("Kawasaki z 900 rs 2021", "Z900", KAWASAKI), "z-900-rs", "z 900 rs");
gelijk(kies("Suzuki V-Strom 650 XT 2018", "v-strom", SUZUKI), "v-strom-650-xt", "V-Strom 650 XT");
gelijk(kies("Suzuki DL650 V-Strom 2012", "DL650", SUZUKI), "dl-650-v-strom", "DL650");
gelijk(kies("Kawasaki Z800 e-versie A2", "Z800", KAWASAKI), "z-800-e", "Z800 e-versie");
gelijk(kies("Kawasaki Z800 Edition 2014", "Z800", KAWASAKI), "z-800", "Z800 Edition");
gelijk(kies("Kawasaki Z900ABS 2018", "Z900", KAWASAKI), "z-900", "Z900ABS");
gelijk(kies("Suzuki V-storm 650 abs", "v-storm", SUZUKI), "v-strom-650", "V-storm");
gelijk(kies("suzuki vstrom 1050 DE", "vstrom", SUZUKI), "v-strom-1050-de", "vstrom 1050 DE");
gelijk(kies("Kawasaki Versis 650 2016", "Versis", KAWASAKI), "versys-650", "Versis");
gelijk(kies("Kawasaki verses 1000 tourer", "verses", KAWASAKI), "versys-1000", "verses");
gelijk(kies("Suzuki V-Strom in topstaat", "v-strom", SUZUKI), null, "V-Strom zonder cc");
gelijk(kies("Kawasaki Z650 2019", "Versis", KAWASAKI), null, "term alleen in omschrijving");
gelijk(kies("Kawasaki Z800 2015", "Z900", KAWASAKI), "z-800", "titel bepaalt model");
// Voorraad: het modelveld is zowel 'titel' als 'model'
gelijk(kies("Z900", "Z900", KAWASAKI), "z-900", "voorraad Z900");
gelijk(kies("Z900 RS Cafe", "Z900 RS Cafe", KAWASAKI), "z-900-rs-cafe", "voorraad Z900 RS Cafe");
gelijk(mooi("V-STROM 650 XT"), "V-Strom 650 XT", "mooi");
gelijk(zoekUrl("kawasaki", "z-900", 2020),
  "https://www.motoroccasion.nl/motoren/kawasaki-z-900?filters=bouwjaar-vanaf-2020/bouwjaar-tot-2020/sortering-prijsoplopend", "zoekUrl");

// Concurrenten: zelfde bouwjaar, ±10.000 km, geen nieuw/BTW/zonder prijs/eigen advertentie
const a = (prijs: number | null, bouwjaar: number, km: number, x: Partial<Aanbod> = {}): Aanbod =>
  ({ prijs, bouwjaar, km, nieuw: false, btw: false, url: null, titel: "", dealer: "Dealer", ...x });
const lijst = concurrentenUit([
  a(7600, 2020, 21000), a(7400, 2020, 19000), a(7000, 2020, 35000),            // 35.000 km: te ver weg
  a(6900, 2019, 20000), a(7100, 2020, 20000, { btw: true }), a(null, 2020, 20000), // ander jaar / BTW / geen prijs
  a(7200, 2020, 20000, { dealer: "De Jonge Motoren" }), a(9900, 2020, 0, { nieuw: true }),
], 2020, 20000);
gelijk(lijst.map((c) => c.prijs), [7400, 7600], "concurrentenUit");

// marktAanbod: alle bruikbare van hetzelfde jaar (ook met veel meer km), goedkoopste eerst
gelijk(marktAanbod([a(7000, 2020, 45000), a(7600, 2020, 21000), a(6900, 2019, 20000), a(5000, 2020, 0, { nieuw: true }),
  a(6000, 2020, 50000, { dealer: "De Jonge Motoren" })], 2020).map((c) => c.prijs), [7000, 7600], "marktAanbod");

// Lokprijs: mediaan van dezelfde motoren met 20–30.000 km meer (anders 15–40.000), op €50 omlaag
const m = (prijs: number, km: number) => ({ prijs, bouwjaar: 2020, km, dealer: "X", url: null });
const markt = [m(7400, 19000), m(7600, 21000), m(7800, 22000),          // vergelijkbare km (±10.000)
               m(6200, 41000), m(6450, 45000), m(6900, 49000),          // 20–30.000 km meer
               m(5000, 75000)];                                         // veel te veel km
const lk = lokprijsUit(markt, 20000);
gelijk([lk.lokprijs, lk.band, lk.groep.length], [6450, [20000, 30000], 3], "lokprijs mediaan");
gelijk(lokprijsUit([m(6430, 37000), m(6170, 58000)], 20000).lokprijs, 6300, "lokprijs ruimere band");
gelijk(lokprijsUit([m(7400, 21000)], 20000).lokprijs, null, "geen lokgroep");

// Beoordeling: doel = lokprijs (nooit onder je minimum = inkoop + €1.000)
const g = beoordeel(7900, 4000, markt, 20000);
gelijk([g.kleur, g.advies, g.lokprijs, g.markt, g.goedkoper, g.actieNodig], ["geel", 6450, 6450, 7600, 3, true], "te hoog → lokprijs");
gelijk(beoordeel(6450, 4000, markt, 20000).kleur, "groen", "op lokprijs");
gelijk(beoordeel(6500, 4000, markt, 20000).kleur, "groen", "binnen €50 van lokprijs");
const r = beoordeel(7900, 6000, markt, 20000);                          // minimum 7000 > lokprijs 6450
gelijk([r.kleur, r.advies, r.minimum], ["rood", 7000, 7000], "lokprijs onder minimum → hooguit minimum");
const zonder = beoordeel(7900, null, markt, 20000);
gelijk([zonder.kleur, zonder.advies, zonder.minimum], ["geel", 6450, null], "zonder inkoopprijs");
const geenLok = beoordeel(7900, 4000, [m(7400, 19000), m(7600, 21000)], 20000);   // geen lokgroep → markt
gelijk([geenLok.kleur, geenLok.lokprijs, geenLok.markt, geenLok.advies], ["geel", null, 7500, 7500], "zonder lokgroep → markt");
gelijk(beoordeel(7500, 4000, [], 20000).kleur, "grijs", "geen vergelijking");
gelijk(beoordeel(null, 4000, markt, 20000).kleur, "grijs", "geen vraagprijs");
gelijk(beoordeel(6500, 6000, markt, 20000).margeTeLaag, true, "marge te laag");
gelijk(beoordeel(9000, 4000, [m(9500, 45000), m(7000, 20000)], 20000).lokprijs, 7000, "lokprijs nooit boven markt");

// Voorraad-typekeuze: modelveld met extra woorden
const YAMAHA: [string, string][] = [["mt-07", "MT 07"], ["mt-07-tracer", "MT 07 TRACER"], ["tracer-7", "TRACER 7"]];
const kiesV = (m: string, types: [string, string][]) => kiesTypeVoorraad(m, types)?.[0] ?? null;
gelijk(kiesV("Z900 ABS", KAWASAKI), "z-900", "voorraad Z900 ABS");
gelijk(kiesV("Versys 650 Tourer", KAWASAKI), "versys-650", "voorraad Versys 650 Tourer");
gelijk(kiesV("MT-07 ABS", YAMAHA), "mt-07", "voorraad MT-07 ABS");
gelijk(kiesV("MT-07 Tracer", YAMAHA), "mt-07-tracer", "voorraad MT-07 Tracer");
gelijk(kiesV("Z900RS Cafe", KAWASAKI), "z-900-rs-cafe", "voorraad Z900RS Cafe");
gelijk(kiesV("Versis 650", KAWASAKI), "versys-650", "voorraad spelfout");
gelijk(kiesV("Ninja 650", KAWASAKI), null, "voorraad onbekend model");

// Bedragen in Nederlandse (en Engelse) notatie
const bedragen: [unknown, number | null][] = [["6.500", 6500], ["€ 6.500,-", 6500], ["6500,00", 6500], ["7500.00", 7500],
  ["7500,5", 7500], ["1,000", 1000], ["1.250.000", 1250000], ["15 000", 15000], [7500.5, 7500], [6500, 6500],
  ["€ 8.500,--", 8500], ["8.500,=", 8500], ["8500 euro", 8500], ["15.000 km", 15000], ["15000km", 15000],
  ["", null], [null, null], ["abc", null]];
for (const [invoer, verwacht] of bedragen) gelijk(naarBedrag(invoer), verwacht, `naarBedrag(${JSON.stringify(invoer)})`);

console.log(`${ok} tests geslaagd`);
