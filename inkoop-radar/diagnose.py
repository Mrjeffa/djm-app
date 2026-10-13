#!/usr/bin/env python3
"""
Diagnose / prijstest voor de inkoop-radar — DRY-RUN: leest alleen en print naar
de log. Schrijft niets naar Supabase en verstuurt geen mail.

Start via GitHub Actions → Inkoop-radar → Run workflow → modus "diagnose".
Gebruik het als een van de sites iets lijkt te hebben veranderd, of om te zien
welk verkoopdoel de radar voor een model/bouwjaar/km zou bepalen.

  1. 2dehands: leveren de advertenties nog bouwjaar, km en adverteerder-type?
  2. Motoroccasion: prijstest voor TEST_MODEL / TEST_BOUWJAAR / TEST_KM
     (precies hetzelfde ene zoekverzoek als de dagelijkse job).
  3. Als Supabase-gegevens beschikbaar zijn: wat de job voor de huidige
     populaire leads zou berekenen (alleen lezen).

Env: TEST_MODEL (default "Kawasaki Z900"), TEST_BOUWJAAR (2020), TEST_KM (20000)
"""
import json
import os

import requests

import fetch_leads as fl
import motoroccasion as mo
from prijzen import bepaal_verkoopdoel

TEST_MODEL = (os.environ.get("TEST_MODEL") or "Kawasaki Z900").strip()
TEST_BOUWJAAR = int(os.environ.get("TEST_BOUWJAAR") or 2020)
TEST_KM = int(os.environ.get("TEST_KM") or 20000)


def kop(t):
    print(f"\n{'=' * 16} {t} {'=' * 16}", flush=True)


def check_2dehands():
    kop("1) 2dehands — velden in de nieuwste motoradvertenties")
    params = {"l1CategoryId": fl.L1_CATEGORY, "limit": "30", "offset": "0", "viewOptions": "list-view",
              "searchInTitleAndDescription": "true", "sortBy": "SORT_INDEX", "sortOrder": "DECREASING"}
    try:
        r = requests.get(fl.SEARCH_URL, params=params, headers=fl.HEADERS, timeout=30)
        listings = r.json().get("listings") or []
    except (requests.RequestException, ValueError) as e:
        print(f"FOUT: {e}")
        return
    motoren = [m for m in (fl.map_listing(x) for x in listings) if m and fl.is_voertuig(m["titel"], m["url"])]
    tel = lambda veld: sum(1 for x in listings if fl.attr_waarde(x, veld) is not None)
    print(f"{len(listings)} advertenties, {len(motoren)} motoren. Met veld: bouwjaar {tel('constructionYear')}, "
          f"km {tel('mileage')}, adverteerder {tel('advertiser')}")
    print(f"Na mapping: bouwjaar bekend {sum(1 for m in motoren if m['bouwjaar'])}, "
          f"km bekend {sum(1 for m in motoren if m['km'] is not None)}, "
          f"particulier {sum(1 for m in motoren if m['is_particulier'])}")
    for m in motoren[:5]:
        print(f"  {m['titel'][:55]!r}: bouwjaar={m['bouwjaar']} km={m['km']} particulier={m['is_particulier']}")


def check_prijstypes():
    kop("1b) 2dehands — prijstypes (waarom 'n.o.t.k.'?)")
    params = {"l1CategoryId": fl.L1_CATEGORY, "limit": "100", "offset": "0", "viewOptions": "list-view",
              "searchInTitleAndDescription": "true", "sortBy": "SORT_INDEX", "sortOrder": "DECREASING"}
    try:
        listings = requests.get(fl.SEARCH_URL, params=params, headers=fl.HEADERS, timeout=30).json().get("listings") or []
    except (requests.RequestException, ValueError) as e:
        print(f"FOUT: {e}")
        return
    tel, voorbeeld = {}, {}
    for x in listings:
        pi = x.get("priceInfo") or {}
        sleutel = f"{pi.get('priceType')} (bedrag {'ja' if (pi.get('priceCents') or 0) > 0 else 'nee'})"
        tel[sleutel] = tel.get(sleutel, 0) + 1
        voorbeeld.setdefault(sleutel, []).append(f"{(x.get('title') or '')[:40]!r} {json.dumps(pi, ensure_ascii=False)}")
    for k, n in sorted(tel.items(), key=lambda kv: -kv[1]):
        print(f"{n:3}× {k}: " + " | ".join(voorbeeld[k][:2]))

    if not (fl.SUPABASE_URL and fl.SERVICE_KEY):
        return
    r = requests.get(f"{fl.SUPABASE_URL}/rest/v1/inkoop_leads", headers=fl.sb_headers(), timeout=30, params={
        "select": "ad_id,titel,url", "prijs": "is.null", "is_particulier": "eq.true",
        "order": "gevonden_op.desc", "limit": "6"})
    for lead in r.json() if r.ok else []:
        print(f"\nLead zonder prijs: {lead['titel']!r} ({lead['ad_id']})")
        try:
            gevonden = requests.get(fl.SEARCH_URL, headers=fl.HEADERS, timeout=30, params={
                "l1CategoryId": fl.L1_CATEGORY, "query": lead["titel"], "limit": "100", "offset": "0",
                "searchInTitleAndDescription": "true", "viewOptions": "list-view",
                "sortBy": "SORT_INDEX", "sortOrder": "DECREASING"}).json().get("listings") or []
            hit = next((x for x in gevonden if str(x.get("itemId")) == lead["ad_id"]), None)
            print(f"   zoeken op titel: {len(gevonden)} resultaten, advertentie {'GEVONDEN' if hit else 'niet gevonden'}")
            if hit:
                print(f"   priceInfo={json.dumps(hit.get('priceInfo'), ensure_ascii=False)} "
                      f"attributes={json.dumps(hit.get('attributes'), ensure_ascii=False)}")
        except (requests.RequestException, ValueError) as e:
            print(f"   FOUT zoeken: {e}")


def prijstest():
    kop(f"2) Motoroccasion — prijstest '{TEST_MODEL}', {TEST_BOUWJAAR}, {TEST_KM} km")
    merk = mo.merk_uit_lead("", TEST_MODEL)
    model = mo.model_uit_term(TEST_MODEL, merk) if merk else ""
    if not merk or not model:
        print("Geef het model op als 'Merk Model', bijv. 'Kawasaki Z900'.")
        return
    types = mo.types_voor_merk(merk)
    gekozen = mo.kies_type(TEST_MODEL, model, types)
    type_key, type_naam = gekozen if gekozen else (mo.slug(model), model)
    print(f"merk={merk} model={model!r} → Motoroccasion-type {type_naam!r} ({type_key}); "
          f"{len(types)} typen bekend voor dit merk")
    try:
        aanbod, url = mo.zoek_aanbod(merk, type_key, TEST_BOUWJAAR)
    except (mo.MoFout, requests.RequestException) as e:
        print(f"FOUT: {e}")
        return
    print(f"URL: {url}\n{len(aanbod)} advertenties op pagina 1 (prijs laag→hoog):")
    for a in aanbod[:12]:
        reden = "" if a["prijs"] and a["km"] and not a["nieuw"] and not a["btw"] else \
            " [overslaan: " + ", ".join(r for r, j in (("geen prijs", not a["prijs"]), ("nieuw/0 km", a["nieuw"] or not a["km"]),
                                                        ("BTW", a["btw"])) if j) + "]"
        print(f"  € {a['prijs']} · {a['bouwjaar']} · {a['km']} km · {a['dealer']}{reden}")
    doel, vgl, toel = bepaal_verkoopdoel(aanbod, TEST_BOUWJAAR, TEST_KM)
    if doel:
        print(f"VERKOOPDOEL: € {doel} op basis van {len(vgl)} vergelijker(s): "
              + ", ".join(f"€ {a['prijs']} ({a['bouwjaar']}, {a['km']} km)" for a in vgl))
    else:
        print(f"Te weinig data: {toel}")


def droog_op_leads():
    kop("3) Huidige populaire leads — wat de job zou berekenen (alleen lezen)")
    if not (fl.SUPABASE_URL and fl.SERVICE_KEY):
        print("Geen Supabase-gegevens in deze run — overgeslagen.")
        return
    try:
        w = fl.bereken_inkoopprijzen(schrijf=False, uitvoer=print)
        if w:
            print(f"WAARSCHUWING: {w}")
    except requests.RequestException as e:
        print(f"FOUT: {e}")


if __name__ == "__main__":
    check_2dehands()
    check_prijstypes()
    prijstest()
    droog_op_leads()
    print("\nKlaar (dry-run, niets weggeschreven).")
