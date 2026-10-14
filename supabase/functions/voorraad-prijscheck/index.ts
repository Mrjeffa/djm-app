// Edge function: voorraad-prijscheck
//
// Vergelijkt de vraagprijs van eigen voorraadmotoren met Motoroccasion.nl:
// zelfde model + bouwjaar; advies = lokprijs (prijsniveau van dezelfde motoren met
// 20–30.000 km meer), nooit onder je minimum. Per motor precies één
// zoekverzoek (pagina 1, prijs laag→hoog) + hooguit één merkpagina per merk —
// zelfde afspraak als bij de inkoop-radar i.v.m. de robots.txt van Motoroccasion.
//
// Aanroepen (POST, JSON):
//   { "voorraad_id": "<uuid>" }  → één motor (knop "Check prijs" in de app)
//   { "voorraad_ids": [...] }    → een portie motoren (wekelijkse check, ≤15 per keer
//                                  i.v.m. de maximale looptijd van een edge function)
//   { "alle": true }             → alle beschikbare voorraad
//   { "test": { merk, model, bouwjaar, km, prijs, inkoopprijs } } → rekenen zonder opslaan
//
// Toegang: alleen admins (is_admin()) of de service-role key (wekelijkse job).
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  beoordeel, kiesTypeVoorraad, marktAanbod, MO_BASIS, mooi, naarAanbod, slug, typesUit, zoekUrl, type Concurrent,
} from "./logica.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "nl-NL,nl;q=0.9",
};
const PAUZE_MS = 2000; // rustig tempo tussen verzoeken aan Motoroccasion

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class MoFout extends Error {}

const isTimeout = (e: unknown) => ["TimeoutError", "AbortError"].includes((e as Error)?.name);

async function haalJson(url: string): Promise<any> {
  let r: Response;
  try { r = await fetch(url, { headers: MO_HEADERS, signal: AbortSignal.timeout(20_000) }); }
  catch (e) { throw new MoFout(isTimeout(e) ? "Motoroccasion reageerde te traag" : `Motoroccasion niet bereikbaar: ${(e as Error).message}`); }
  if (!r.ok) throw new MoFout(`Motoroccasion gaf ${r.status}`);
  try { return await r.json(); }
  catch (e) { throw new MoFout(isTimeout(e) ? "Motoroccasion reageerde te traag" : "Motoroccasion gaf geen JSON (site gewijzigd?)"); }
}

// Wachtrij: elk verzoek wacht tot het vorige klaar is, plus PAUZE_MS — ook als
// er meerdere "Check prijs"-klikken tegelijk binnenkomen.
let wachtrij: Promise<unknown> = Promise.resolve();
let laatsteKlaar = 0;
function moJson(url: string): Promise<any> {
  const taak = wachtrij.then(async () => {
    const wacht = laatsteKlaar + PAUZE_MS - Date.now();
    if (wacht > 0) await new Promise((r) => setTimeout(r, wacht));
    try { return await haalJson(url); } finally { laatsteKlaar = Date.now(); }
  });
  wachtrij = taak.catch(() => {});
  return taak;
}

// Typelijst per merk, alleen van de gewone merkpagina. Een geslaagde lijst wordt
// onthouden; na een storing hooguit één nieuwe poging per 10 minuten, zodat we
// de merkpagina niet voor elke motor opnieuw opvragen.
const typeCache = new Map<string, [string, string][]>();
const typeFoutOp = new Map<string, number>();
async function typesVoorMerk(merk: string): Promise<[string, string][]> {
  if (typeCache.get(merk)?.length) return typeCache.get(merk)!;
  if (Date.now() - (typeFoutOp.get(merk) ?? 0) < 10 * 60_000) return [];
  try {
    const types = typesUit(await moJson(`${MO_BASIS}/motoren/${merk}`));
    if (types.length) typeCache.set(merk, types); else typeFoutOp.set(merk, Date.now());
    return types;
  } catch { typeFoutOp.set(merk, Date.now()); return []; }
}

type Motor = { merk: string | null; model: string | null; bouwjaar: number | null; km: number | null };
type Uitkomst = {
  status: "ok" | "geen_data" | "fout"; mo_model: string | null; mo_url: string | null;
  concurrenten: Concurrent[] | null; zelfde_bouwjaar: number | null; toelichting: string | null;
};

async function check(m: Motor): Promise<Uitkomst> {
  const leeg = { mo_model: null, mo_url: null, concurrenten: null, zelfde_bouwjaar: null };
  const merk = slug(m.merk), model = (m.model || "").trim();
  if (!merk || !model) return { status: "geen_data", ...leeg, toelichting: "merk of model ontbreekt" };
  // km 0 = niet ingevuld (de app slaat een leeg veld op als 0)
  if (!m.bouwjaar) return { status: "geen_data", ...leeg, toelichting: "bouwjaar ontbreekt" };
  if (!m.km || m.km <= 0) return { status: "geen_data", ...leeg, toelichting: "km-stand ontbreekt (0 km)" };

  const types = await typesVoorMerk(merk);
  const gekozen = kiesTypeVoorraad(model, types);
  if (!gekozen && types.length) {
    // Typelijst bekend maar geen passend type: geen overbodig zoekverzoek doen.
    return { status: "fout", ...leeg, toelichting: `Motoroccasion kent "${m.merk} ${model}" niet — controleer de schrijfwijze van het model` };
  }
  const [typeKey, typeNaam] = gekozen ?? [slug(model), model];
  const url = zoekUrl(merk, typeKey, m.bouwjaar);
  const data = await moJson(url);

  const filters: Record<string, string> = {};
  for (const f of data?.activeFiltersList || []) filters[f?.key] = f?.value;
  if (filters.brand !== merk || !filters.type) {
    return { status: "fout", ...leeg, toelichting: `Motoroccasion kent "${m.merk} ${model}" niet — controleer de schrijfwijze van het model` };
  }
  if (!("bouwjaar_vanaf" in filters) || !("bouwjaar_tot" in filters)) {
    throw new MoFout("bouwjaarfilter niet toegepast — URL-opbouw van Motoroccasion gewijzigd?");
  }
  const items = data?.inventories || [];
  const aanbod = items.map(naarAanbod);
  // Alleen pagina 1: bij meer pagina's moet die echt op prijs gesorteerd zijn
  // (zelfde controle als inkoop-radar/motoroccasion.py; kleine afwijkingen mogen).
  const totaal = data?.metadata?.totalCount ?? items.length;
  const prijzen = aanbod.map((a) => a.prijs).filter((p): p is number => !!p);
  const dalingen = prijzen.slice(1).filter((p, i) => p < prijzen[i]).length;
  if (totaal > items.length && (!("sorting" in filters) || dalingen > Math.floor(prijzen.length / 4))) {
    throw new MoFout("sortering op prijs niet toegepast — URL-opbouw van Motoroccasion gewijzigd?");
  }
  // Alle bruikbare advertenties van dit bouwjaar (ook met veel meer km): daaruit
  // rekent beoordeel() de vergelijkbare km én de lokgroep.
  const concurrenten = marktAanbod(aanbod, m.bouwjaar).slice(0, 30);
  return {
    status: "ok",
    mo_model: `${m.merk} ${mooi(typeNaam)}`,
    mo_url: url,
    concurrenten,
    zelfde_bouwjaar: data?.metadata?.totalCount ?? aanbod.length,
    toelichting: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Toegang: service-role key (wekelijkse job) of een ingelogde admin.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ fout: "Niet ingelogd" }, 401);
  if (token !== SERVICE_KEY) {
    const gebruiker = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: isAdmin } = await gebruiker.rpc("is_admin");
    if (isAdmin !== true) return json({ fout: "Geen toegang" }, 403);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));

  // Testmodus: rekenen zonder iets op te slaan.
  if (body?.test) {
    const t = body.test;
    try {
      const u = await check(t);
      return json({ test: { ...u, beoordeling: beoordeel(t.prijs ?? null, t.inkoopprijs ?? null, u.concurrenten, t.km ?? null) } });
    } catch (e) {
      return json({ test: { status: "fout", toelichting: String((e as Error).message) } });
    }
  }

  let q = db.from("voorraad").select("id,merk,model,bouwjaar,km,prijs,status").is("verkocht_op", null);
  if (body?.voorraad_id) q = q.eq("id", body.voorraad_id);
  else if (Array.isArray(body?.voorraad_ids) && body.voorraad_ids.length) q = q.in("id", body.voorraad_ids.slice(0, 25));
  else if (body?.alle) q = q.eq("status", "beschikbaar");
  else return json({ fout: "Geef voorraad_id, voorraad_ids, alle of test mee" }, 400);
  const { data: motoren, error } = await q;
  if (error) return json({ fout: error.message }, 500);

  const ids = (motoren || []).map((m) => m.id);
  const { data: inkoop } = ids.length
    ? await db.from("voorraad_inkoop").select("voorraad_id,inkoopprijs").in("voorraad_id", ids)
    : { data: [] as { voorraad_id: string; inkoopprijs: number }[] };
  const inkoopVan = new Map((inkoop || []).map((r) => [r.voorraad_id, r.inkoopprijs]));

  const resultaten = [];
  for (const m of motoren || []) {
    let u: Uitkomst;
    try { u = await check(m); }
    catch (e) {
      u = { status: "fout", mo_model: null, mo_url: null, concurrenten: null, zelfde_bouwjaar: null,
            toelichting: String((e as Error).message).slice(0, 300) };
    }
    const rij = { voorraad_id: m.id, gecontroleerd_op: new Date().toISOString(), ...u };
    const { error: opslagFout } = await db.from("voorraad_prijscheck").upsert(rij);
    const inkoopprijs = inkoopVan.get(m.id) ?? null;
    resultaten.push({
      ...rij, merk: m.merk, model: m.model, bouwjaar: m.bouwjaar, km: m.km, prijs: m.prijs, inkoopprijs,
      beoordeling: beoordeel(m.prijs, inkoopprijs, u.concurrenten, m.km),
      ...(opslagFout ? { opslagfout: opslagFout.message } : {}),
    });
  }
  return json({ resultaten });
});
