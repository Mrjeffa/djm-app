// Edge function: push-melding
//
// Stuurt pushmeldingen naar de apparaten van de beheerder(s).
//
// Aanroepen (POST, JSON):
//   { "tabel", "id", "soort" }  → vanuit een databasetrigger (pg_net, zie supabase/push.sql)
//                                  bij een nieuwe afspraak, inkoop-aanvraag of klantactie.
//                                  De functie leest de gegevens zelf uit de database en
//                                  meldt elke gebeurtenis hooguit één keer (push_log), dus een
//                                  nagemaakte aanroep kan geen valse of dubbele meldingen sturen.
//   { "sleutel": true }          → publieke VAPID-sleutel om je aan te melden (alleen admin).
//   { "test": true }             → testmelding naar je eigen apparaten (alleen admin).
//
// VAPID-sleutels: maakt de functie zelf aan bij het eerste gebruik en bewaart ze in
// tabel push_sleutels (RLS zonder policies: alleen de server kan erbij). Er hoeft dus
// geen geheim met de hand ingevoerd te worden.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { b64url, stuurPush, type Abonnement, type Vapid } from "./webpush.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_PER_UUR = 30; // rem tegen een stortvloed (bv. spam via het websiteformulier)
const ONDERWERP = "https://dejongemotoren.nl"; // contact voor de pushdiensten (VAPID "sub")

// VAPID-sleutelpaar ophalen, of bij het allereerste gebruik aanmaken
async function haalVapid(db: SupabaseClient): Promise<Vapid> {
  const lees = async () => (await db.from("push_sleutels").select("publiek,prive_jwk").eq("id", 1).maybeSingle()).data;
  let rij = await lees();
  if (!rij) {
    const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const publiek = b64url.encode(await crypto.subtle.exportKey("raw", paar.publicKey));
    const prive_jwk = await crypto.subtle.exportKey("jwk", paar.privateKey);
    // Twee gelijktijdige aanroepen: de eerste wint, de tweede leest diens sleutels
    await db.from("push_sleutels").upsert({ id: 1, publiek, prive_jwk }, { onConflict: "id", ignoreDuplicates: true });
    rij = await lees();
  }
  if (!rij) throw new Error("VAPID-sleutels niet beschikbaar");
  const { kty, crv, x, y, d } = rij.prive_jwk as JsonWebKey;
  return { publicKey: rij.publiek, privateJwk: { kty, crv, x, y, d }, subject: ONDERWERP };
}

// Is de aanroeper een ingelogde admin? Geeft dan zijn user-id terug.
async function adminVan(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const gebruiker = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: isAdmin }, { data: wie }] = await Promise.all([gebruiker.rpc("is_admin"), gebruiker.auth.getUser(token)]);
  return isAdmin === true && wie?.user ? wie.user.id : null;
}

const TYPE_LABEL: Record<string, string> = {
  schade: "Schademelding", consignatie: "Consignatie", aankoopkeuring: "Aankoopkeuring",
  zoekopdracht: "Zoekopdracht", winterstalling: "Winterstalling", seizoenscheck: "Seizoenscheck",
  service: "Service", proefrit: "Proefrit",
};
const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const datum = (d?: string | null) => {
  if (!d) return "";
  const [j, m, dg] = d.split("-").map(Number);
  const w = new Date(Date.UTC(j, m - 1, dg)).getUTCDay();
  return `${DAGEN[w]} ${dg}-${m}`;
};
const motorTekst = (m?: { merk?: string | null; model?: string | null } | null) =>
  m ? [m.merk, m.model].filter(Boolean).join(" ") : "";
const zin = (...delen: (string | null | undefined | false)[]) => delen.filter(Boolean).join(" · ");

type Melding = { title: string; body: string; url: string; tag: string };

// Stel de melding samen uit de database (niet uit de aanroep). null = niets melden.
async function maakMelding(db: SupabaseClient, tabel: string, id: string, soort: string): Promise<Melding | null> {
  if (tabel === "afspraken") {
    const { data: a } = await db.from("afspraken")
      .select("id,type,soort,datum,tijd,naam,status,klant_id,motor_id,voorraad_motor_id").eq("id", id).maybeSingle();
    if (!a || a.status !== "aangevraagd") return null; // zelf ingeplande afspraken niet melden
    const [klant, motor, vrd] = await Promise.all([
      a.klant_id ? db.from("klanten").select("naam").eq("id", a.klant_id).maybeSingle() : null,
      a.motor_id ? db.from("motoren").select("merk,model").eq("id", a.motor_id).maybeSingle() : null,
      a.voorraad_motor_id ? db.from("voorraad").select("merk,model").eq("id", a.voorraad_motor_id).maybeSingle() : null,
    ]);
    const titel = a.type === "proefrit" ? "Nieuwe proefrit-aanvraag"
      : a.type === "service" ? "Nieuwe afspraak-aanvraag"
      : `Nieuwe aanvraag: ${TYPE_LABEL[a.type] ?? a.type}`;
    return {
      title: titel,
      body: zin(a.naam || klant?.data?.naam, motorTekst(vrd?.data ?? motor?.data), datum(a.datum),
        a.klant_id ? "via klantportaal" : "via website"),
      url: "/?pagina=agenda", tag: `afspraak-${a.id}`,
    };
  }

  if (tabel === "inkoop_aanvragen") {
    const { data: i } = await db.from("inkoop_aanvragen").select("*").eq("id", id).maybeSingle();
    if (!i) return null;
    return {
      title: "Nieuwe inkoop-aanvraag",
      body: zin(i.naam, [i.merk, i.model, i.bouwjaar].filter(Boolean).join(" "),
        i.km != null ? `${Number(i.km).toLocaleString("nl-NL")} km` : null, i.telefoon),
      url: "/?pagina=inkoop", tag: `inkoop-${i.id}`,
    };
  }

  if (tabel === "inkoop_radar_status") {
    const { data: s } = await db.from("inkoop_radar_status").select("laatste_run,nieuw").maybeSingle();
    // Alleen de run die de trigger meldde (en die net gedraaid heeft)
    const run = s?.laatste_run ? new Date(s.laatste_run).getTime() : NaN;
    if (!s?.nieuw || run !== new Date(id).getTime() || Date.now() - run > 3 * 3600_000) return null;
    const { count } = await db.from("inkoop_leads").select("ad_id", { count: "exact", head: true })
      .gte("gevonden_op", new Date(Date.now() - 6 * 3600_000).toISOString()).not("mo_verkoopdoel", "is", null);
    return {
      title: "Inkoop-radar",
      body: `${s.nieuw} nieuwe advertentie${s.nieuw === 1 ? "" : "s"}${count ? `, waarvan ${count} met inkoopadvies` : ""}`,
      url: "/?pagina=inkoop", tag: "inkoop-radar",
    };
  }

  if (tabel === "users") { // nieuwe klant heeft zijn e-mailadres bevestigd
    const { data: admin } = await db.from("admins").select("id").eq("id", id).maybeSingle();
    if (admin) return null;
    const { data: u } = await db.auth.admin.getUserById(id);
    if (!u?.user?.email_confirmed_at) return null;
    const { data: k } = await db.from("klanten").select("naam,email").eq("user_id", id).maybeSingle();
    const meta = u.user.user_metadata ?? {};
    const naam = k?.naam || [meta.voornaam, meta.achternaam].filter(Boolean).join(" ") || k?.email || u.user.email;
    return { title: "Nieuwe klant geregistreerd", body: `${naam ?? "Onbekend"} wacht op goedkeuring`, url: "/?pagina=klanten", tag: `klant-${id}` };
  }

  if (tabel === "motoren") {
    const { data: m } = await db.from("motoren").select("merk,model,kenteken,klant_id").eq("id", id).maybeSingle();
    if (!m) return null;
    const { data: k } = await db.from("klanten").select("naam").eq("id", m.klant_id).maybeSingle();
    return {
      title: "Klant heeft een motor toegevoegd",
      body: zin(k?.naam, [motorTekst(m), m.kenteken && `(${m.kenteken})`].filter(Boolean).join(" ")),
      url: "/?pagina=klanten", tag: `motor-${id}`,
    };
  }

  if (tabel === "service_beurten") {
    const { data: s } = await db.from("service_beurten").select("omschrijving,km,klant_invoer,motor_id").eq("id", id).maybeSingle();
    if (!s?.klant_invoer) return null;
    const { data: m } = await db.from("motoren").select("merk,model,klant_id").eq("id", s.motor_id).maybeSingle();
    const { data: k } = m ? await db.from("klanten").select("naam").eq("id", m.klant_id).maybeSingle() : { data: null };
    return {
      title: "Klant heeft onderhoud ingevoerd",
      body: zin(k?.naam, motorTekst(m), s.omschrijving),
      url: "/?pagina=klanten", tag: `service-${id}`,
    };
  }

  if (tabel === "klanten" && soort === "gearchiveerd") {
    const { data: k } = await db.from("klanten").select("naam,email,status").eq("id", id).maybeSingle();
    if (!k || k.status !== "gearchiveerd") return null;
    return { title: "Klant heeft account verwijderd", body: k.naam || k.email || "Onbekende klant", url: "/?pagina=klanten", tag: `klant-weg-${id}` };
  }

  return null;
}

// Stuur naar alle (of één gebruikers) apparaten; verlopen abonnementen opruimen.
async function verstuur(db: SupabaseClient, vapid: Vapid, melding: Melding, alleenVan?: string) {
  const { data: admins } = await db.from("admins").select("id");
  const adminIds = (admins ?? []).map((a) => a.id);
  let q = db.from("push_abonnementen").select("id,user_id,endpoint,p256dh,auth").in("user_id", adminIds);
  if (alleenVan) q = q.eq("user_id", alleenVan);
  const { data: abonnementen } = await q;
  const uitkomsten = await Promise.all((abonnementen ?? []).map(async (ab) => {
    try {
      const r = await stuurPush(ab as Abonnement, melding, vapid);
      if (r.status === 404 || r.status === 410) await db.from("push_abonnementen").delete().eq("id", ab.id);
      return r;
    } catch (e) {
      return { ok: false, status: 0, tekst: (e as Error).message };
    }
  }));
  return {
    apparaten: uitkomsten.length,
    verstuurd: uitkomsten.filter((u) => u.ok).length,
    fouten: uitkomsten.filter((u) => !u.ok).map((u) => `${u.status} ${u.tekst}`.trim()),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ fout: "Alleen POST" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ fout: "Ongeldige JSON" }, 400); }

  // Publieke sleutel ophalen / testmelding: alleen een ingelogde admin
  if (body.sleutel || body.test) {
    const adminId = await adminVan(req);
    if (!adminId) return json({ fout: "Geen toegang" }, 403);
    const vapid = await haalVapid(db);
    if (body.sleutel) return json({ publiekeSleutel: vapid.publicKey });
    return json(await verstuur(db, vapid, {
      title: "Testmelding", body: "Pushmeldingen werken op dit apparaat ✔", url: "/?pagina=instellingen", tag: "test",
    }, adminId));
  }

  const tabel = String(body.tabel ?? ""), id = String(body.id ?? ""), soort = String(body.soort ?? "nieuw");
  if (!tabel || !id) return json({ fout: "tabel en id verplicht" }, 400);
  // Kenmerken zijn uuid's (behalve bij de radar: tijdstip van de run)
  if (tabel !== "inkoop_radar_status" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return json({ overgeslagen: true });
  }

  let melding: Melding | null = null;
  try { melding = await maakMelding(db, tabel, id, soort); }
  catch (e) { console.error("melding samenstellen mislukt:", (e as Error).message); }
  if (!melding) return json({ overgeslagen: true });

  // Elke gebeurtenis maar één keer melden
  const { error: logFout } = await db.from("push_log").insert({ tabel, record_id: id, soort });
  if (logFout) return logFout.code === "23505" ? json({ dubbel: true }) : json({ fout: logFout.message }, 500);

  const { count } = await db.from("push_log").select("tabel", { count: "exact", head: true })
    .gte("verstuurd_op", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) > MAX_PER_UUR) return json({ overgeslagen: "te veel meldingen dit uur" });

  // Af en toe het logboek opschonen
  if (Math.random() < 0.05) await db.from("push_log").delete().lt("verstuurd_op", new Date(Date.now() - 90 * 86400_000).toISOString());

  return json(await verstuur(db, await haalVapid(db), melding));
});
