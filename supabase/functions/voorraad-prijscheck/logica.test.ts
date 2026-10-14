// Tests voor logica.ts. Draaien (vanuit de repo-root):
//   npx esbuild supabase/functions/voorraad-prijscheck/logica.test.ts --bundle --platform=node --outfile=/tmp/t.mjs --format=esm && node /tmp/t.mjs
import {
  beoordeel, concurrentenUit, kiesType, kiesTypeVoorraad, mooi, naarBedrag, nietDuurderDan, zoekUrl, type Aanbod,
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

// Beoordeling
const c = (...prijzen: number[]) => prijzen.map((p) => ({ prijs: p, bouwjaar: 2020, km: 20000, dealer: "X", url: null }));
gelijk(beoordeel(7500, 6000, c(7600, 7900)).kleur, "groen", "goedkoopst");
gelijk(beoordeel(7500, 6000, []).kleur, "grijs", "geen vergelijking");
const geel = beoordeel(7900, 6000, c(7495, 7800));
gelijk([geel.kleur, geel.advies, geel.minimum, geel.actieNodig], ["geel", 7450, 7000, true], "goedkopere boven minimum");
const rood = beoordeel(7900, 6900, c(7495));
gelijk([rood.kleur, rood.advies, rood.minimum], ["rood", null, 7900], "goedkopere onder minimum");
const zonderInkoop = beoordeel(7900, null, c(7495));
gelijk([zonderInkoop.kleur, zonderInkoop.advies, zonderInkoop.minimum], ["geel", 7450, null], "zonder inkoopprijs");
gelijk(beoordeel(6500, 6000, c(7000)).margeTeLaag, true, "marge te laag");
gelijk(nietDuurderDan(7500), 7450, "nietDuurderDan 7500");
gelijk(nietDuurderDan(7495), 7450, "nietDuurderDan 7495");
// Minimum net onder de goedkoopste: nog te onderbieden → geel met advies = minimum (niet rood)
const krap = beoordeel(7900, 6025, c(7040));
gelijk([krap.kleur, krap.advies, krap.minimum], ["geel", 7025, 7025], "minimum net onder goedkoopste");
gelijk(beoordeel(7900, 6040, c(7040)).kleur, "rood", "minimum gelijk aan goedkoopste");

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
  ["", null], [null, null], ["abc", null]];
for (const [invoer, verwacht] of bedragen) gelijk(naarBedrag(invoer), verwacht, `naarBedrag(${JSON.stringify(invoer)})`);

console.log(`${ok} tests geslaagd`);
