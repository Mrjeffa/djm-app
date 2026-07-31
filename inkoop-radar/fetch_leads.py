#!/usr/bin/env python3
"""
Inkoop-radar — haalt dagelijks nieuw geplaatste (particuliere) motoradvertenties
op van 2dehands.be / 2ememain.be, ontdubbelt ze en schrijft ze als inkoop-leads
in Supabase. Bij nieuwe particuliere leads gaat er een digest-mail via Resend.

De API (https://www.2dehands.be/lrp/api/search) is de interne Adevinta zoek-API
die 2dehands én 2ememain bedienen. Ze is ongedocumenteerd; de parameters,
headers en veld-mapping hieronder zijn overgenomen uit de MIT-referentie
PonClick/marktplaats-mcp (identieke backend als Marktplaats). Alles is defensief
geschreven: verandert het schema, dan zetten we een waarschuwing in Supabase die
de app bovenaan de inkoop-pagina toont.

Env (GitHub Actions repo-secrets / vars):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (verplicht — schrijven omzeilt RLS)
  RESEND_API_KEY, DIGEST_FROM, DIGEST_TO    (verplicht voor de mail)
  RADAR_KEYWORD      (default "")           — extra zoekterm binnen categorie Motoren
  RADAR_PRICE_MIN    (default "0")
  RADAR_PRICE_MAX    (default "8000")
  RADAR_MAX_ITEMS    (default "150")
  RADAR_SEARCH_URL   (default 2dehands.be)
  RADAR_L1_CATEGORY  (default "678" = Motoren)
  RADAR_BRON         (default "2dehands")
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests

# ── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
DIGEST_FROM = os.environ.get("DIGEST_FROM", "")
DIGEST_TO = [a.strip() for a in os.environ.get("DIGEST_TO", "").split(",") if a.strip()]

KEYWORD = os.environ.get("RADAR_KEYWORD", "").strip()
PRICE_MIN = int(os.environ.get("RADAR_PRICE_MIN", "0"))
PRICE_MAX = int(os.environ.get("RADAR_PRICE_MAX", "8000"))
MAX_ITEMS = int(os.environ.get("RADAR_MAX_ITEMS", "150"))
SEARCH_URL = os.environ.get("RADAR_SEARCH_URL", "https://www.2dehands.be/lrp/api/search")
L1_CATEGORY = os.environ.get("RADAR_L1_CATEGORY", "678")  # 678 = Motoren
BRON = os.environ.get("RADAR_BRON", "2dehands")
SITE_BASE = "https://www.2dehands.be"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# Traits die op een zakelijke verkoper wijzen (uit de referentie-repo).
BUSINESS_TRAITS = {
    "ADMARKT_CONSOLE", "CUSTOMER_SUPPORT_BUSINESS_LINE", "SELLER_PROFILE_URL",
    "VERIFIED_SELLER", "UNIQUE_SELLING_POINTS", "SHOPPING_CART",
}
# Naam-patronen die op een handelaar wijzen.
BUSINESS_NAME_PATTERNS = [
    r"\.nl$", r"\.be$", r"\.com$", r"b\.?v\.?$", r"bvba", r"webshop", r"shop\b",
    r"store\b", r"handel", r"garage", r"motors?\b", r"bikes?\b", r"moto\b", r"outlet",
]
# Extra vangnet: deze woorden in de beschrijving markeren als dealer (aanpasbaar).
DEALER_SIGNALS = [
    "garantie", "btw", "financiering", "keuring inbegrepen", "professionele verkoper",
    "showroom", "bedrijfsgarantie", "12 maanden garantie", "leasing", "gekeurd voor verkoop",
]
# Titels met deze woorden zijn onderdelen/accessoires, geen voertuig → overslaan.
PART_SIGNALS = [
    "onderdeel", "onderdelen", "uitlaat", "demper", "spatbord", "kuip", "koplamp",
    "spiegel", "spiegels", "stuur", "tankdop", "zadel", "remklauw", "remschijf",
    "ketting", "tandwiel", "kettingkast", "velg", "velgen", "band", "banden",
    "accu", "batterij", "windscherm", "koffer", "kofferset", "helm", "jas", "pak",
    "handschoen", "handschoenen", "kleding", "laars", "laarzen", "sticker", "stickers",
    "pack", "onderdelenpakket", "krukas", "cilinder", "carburateur", "bougie",
    "startmotor", "dynamo", "kabelboom", "brommer onderdelen",
]


def log(msg):
    print(f"[inkoop-radar] {msg}", flush=True)


def fail(msg, code=1):
    log(f"FOUT: {msg}")
    sys.exit(code)


# ── Verkopertype ─────────────────────────────────────────────────────────────
def is_particulier(traits, seller_name, description):
    if set(traits or []) & BUSINESS_TRAITS:
        return False
    naam = (seller_name or "").lower()
    for p in BUSINESS_NAME_PATTERNS:
        if re.search(p, naam):
            return False
    oms = (description or "").lower()
    if any(sig in oms for sig in DEALER_SIGNALS):
        return False
    return True


def is_voertuig(titel):
    t = (titel or "").lower()
    return not any(sig in t for sig in PART_SIGNALS)


# ── Mapping ──────────────────────────────────────────────────────────────────
def map_listing(item):
    """Zet één API-listing om naar een lead-rij. Geeft None bij te weinig velden."""
    ad_id = item.get("itemId") or item.get("id")
    titel = (item.get("title") or "").strip()
    if not ad_id or not titel:
        return None  # zonder id/titel is de mapping mislukt

    price_info = item.get("priceInfo", {}) or {}
    price_type = price_info.get("priceType", "")
    cents = price_info.get("priceCents", 0) or 0
    prijs = cents // 100 if price_type in ("FIXED", "RESERVED") and cents > 0 else None

    loc = item.get("location", {}) or {}
    seller = item.get("sellerInformation", {}) or {}
    beschrijving = item.get("description", "") or ""
    traits = item.get("traits", []) or []

    pics = item.get("pictures", []) or []
    foto = ""
    if pics:
        foto = pics[0].get("largeUrl") or pics[0].get("mediumUrl") or pics[0].get("extraSmallUrl") or ""
        if foto and foto.startswith("//"):
            foto = "https:" + foto

    vip = item.get("vipUrl") or ""
    url = (SITE_BASE + vip) if vip.startswith("/") else (vip or f"https://link.2dehands.be/{ad_id}")

    return {
        "ad_id": str(ad_id),
        "titel": titel,
        "beschrijving": beschrijving[:2000],
        "prijs": prijs,
        "plaats": loc.get("cityName"),
        "land": loc.get("countryName") or loc.get("countryAbbreviation"),
        "verkoper_id": str(seller.get("sellerId")) if seller.get("sellerId") is not None else None,
        "verkoper_naam": seller.get("sellerName"),
        "is_particulier": is_particulier(traits, seller.get("sellerName"), beschrijving),
        "url": url,
        "foto_url": foto or None,
        "bron": BRON,
        "advertentie_datum": parse_datum(item.get("date")),
        "status": "nieuw",
    }


def parse_datum(val):
    """Alleen een echte ISO-datum bewaren; relatieve teksten ('Vandaag') negeren."""
    if not val or not isinstance(val, str):
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


# ── API ophalen ──────────────────────────────────────────────────────────────
def haal_listings():
    limit = min(100, MAX_ITEMS)
    verzameld = []
    offset = 0
    facets_gelogd = False
    while len(verzameld) < MAX_ITEMS:
        params = {
            "l1CategoryId": L1_CATEGORY,
            "limit": str(limit),
            "offset": str(offset),
            "searchInTitleAndDescription": "true",
            "viewOptions": "list-view",
            "sortBy": "SORT_INDEX",       # op datum
            "sortOrder": "DECREASING",    # nieuwste eerst
            "attributeRanges[]": [f"PriceCents:{PRICE_MIN * 100}:{PRICE_MAX * 100}"],
        }
        if KEYWORD:
            params["query"] = KEYWORD
        log(f"GET offset={offset} limit={limit} …")
        resp = requests.get(SEARCH_URL, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        listings = data.get("listings")
        if listings is None:
            log("WAARSCHUWING: geen 'listings'-veld in respons — schema mogelijk gewijzigd.")
            return verzameld, False
        if not facets_gelogd:
            # Subcategorie-refinements loggen zodat we onderdelen later gericht kunnen uitsluiten.
            for key in ("facets", "refinements", "categoriesById", "searchCategoryOptions"):
                if key in data:
                    log(f"refinement '{key}': {json.dumps(data[key])[:1500]}")
            facets_gelogd = True
        if not listings:
            break
        verzameld.extend(listings)
        if len(listings) < limit:
            break
        offset += limit
        time.sleep(1.0)  # niet hameren
    return verzameld[:MAX_ITEMS], True


# ── Supabase REST ────────────────────────────────────────────────────────────
def sb_headers(extra=None):
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def bestaande_ad_ids(ad_ids):
    """Welke van deze ad_ids staan al in de tabel? (voor dedup + nieuw-detectie)"""
    bestaand = set()
    for i in range(0, len(ad_ids), 100):
        brok = ad_ids[i:i + 100]
        lijst = ",".join(f'"{a}"' for a in brok)
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/inkoop_leads",
            params={"select": "ad_id", "ad_id": f"in.({lijst})"},
            headers=sb_headers(), timeout=30,
        )
        r.raise_for_status()
        bestaand.update(row["ad_id"] for row in r.json())
    return bestaand


def insert_leads(leads):
    if not leads:
        return
    # ignore-duplicates maakt het idempotent bij gelijktijdige/herhaalde runs.
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/inkoop_leads?on_conflict=ad_id",
        headers=sb_headers({"Prefer": "resolution=ignore-duplicates,return=minimal"}),
        data=json.dumps(leads), timeout=60,
    )
    if r.status_code >= 300:
        fail(f"Insert mislukt ({r.status_code}): {r.text[:500]}")


def update_status(http_ok, gevonden, gemapt, nieuw, waarschuwing):
    body = {
        "id": 1,
        "laatste_run": datetime.now(timezone.utc).isoformat(),
        "http_ok": http_ok,
        "gevonden": gevonden,
        "gemapt": gemapt,
        "nieuw": nieuw,
        "waarschuwing": waarschuwing,
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/inkoop_radar_status?on_conflict=id",
        headers=sb_headers({"Prefer": "resolution=merge-duplicates,return=minimal"}),
        data=json.dumps(body), timeout=30,
    )
    if r.status_code >= 300:
        log(f"WAARSCHUWING: status bijwerken mislukt ({r.status_code}): {r.text[:300]}")


# ── Digest-mail ──────────────────────────────────────────────────────────────
def stuur_digest(nieuwe_particulier):
    if not nieuwe_particulier:
        log("Geen nieuwe particuliere leads — geen mail.")
        return
    if not (RESEND_API_KEY and DIGEST_FROM and DIGEST_TO):
        log("WAARSCHUWING: Resend-config ontbreekt — mail overgeslagen.")
        return

    leads = sorted(nieuwe_particulier, key=lambda x: (x["prijs"] is None, x["prijs"] or 0))
    rijen = ""
    for l in leads:
        prijs = f"€ {l['prijs']:,}".replace(",", ".") if l["prijs"] is not None else "n.o.t.k."
        foto = (f'<img src="{l["foto_url"]}" width="90" height="68" '
                f'style="object-fit:cover;border-radius:4px;display:block">') if l.get("foto_url") else ""
        plaats = l.get("plaats") or ""
        rijen += f"""
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px">{foto}</td>
          <td style="padding:8px;font-size:14px">
            <a href="{l['url']}" style="color:#111;text-decoration:none;font-weight:600">{escape(l['titel'])}</a>
            <div style="color:#777;font-size:12px;margin-top:2px">{escape(plaats)} · {BRON}</div>
          </td>
          <td style="padding:8px;text-align:right;font-weight:700;white-space:nowrap;color:#111">{prijs}</td>
        </tr>"""

    html = f"""
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="border-top:4px solid #E31E24;padding:16px 0 8px">
        <h2 style="margin:0;font-size:18px;color:#111">Inkoop-radar — {len(leads)} nieuwe particuliere lead(s)</h2>
        <p style="color:#777;font-size:13px;margin:4px 0 12px">Gesorteerd op prijs (laag → hoog). Bron: {BRON}.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee">{rijen}</table>
      <p style="color:#999;font-size:11px;margin-top:16px">Automatisch gegenereerd door de DJM inkoop-radar.</p>
    </div>"""

    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        data=json.dumps({
            "from": DIGEST_FROM, "to": DIGEST_TO,
            "subject": f"Inkoop-radar: {len(leads)} nieuwe lead(s)", "html": html,
        }), timeout=30,
    )
    if r.status_code >= 300:
        log(f"WAARSCHUWING: mail versturen mislukt ({r.status_code}): {r.text[:300]}")
    else:
        log(f"Digest-mail verstuurd naar {', '.join(DIGEST_TO)}.")


def escape(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    if not (SUPABASE_URL and SERVICE_KEY):
        fail("SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.")

    http_ok, waarschuwing = True, None
    listings, ok = [], True
    try:
        listings, ok = haal_listings()
    except requests.RequestException as e:
        http_ok = False
        waarschuwing = f"API-aanroep mislukt: {e}"
        log(waarschuwing)

    log(f"{len(listings)} listings opgehaald.")

    voertuigen = [m for m in (map_listing(x) for x in listings) if m]
    voertuigen = [m for m in voertuigen if is_voertuig(m["titel"])]
    gemapt = len(voertuigen)
    log(f"{gemapt} voertuig-leads na mapping + onderdelen-filter.")

    # Defensieve schema-check: wel 200 + listings, maar niets gemapt → alarm.
    if http_ok and listings and gemapt == 0:
        waarschuwing = ("API-schema mogelijk gewijzigd: "
                        f"0 van {len(listings)} listings gemapt.")
        log("WAARSCHUWING: " + waarschuwing)
    if not ok and http_ok:
        waarschuwing = waarschuwing or "API-respons miste het 'listings'-veld (schema mogelijk gewijzigd)."

    nieuw_count = 0
    nieuwe_particulier = []
    if voertuigen:
        alle_ids = [m["ad_id"] for m in voertuigen]
        try:
            bestaand = bestaande_ad_ids(alle_ids)
        except requests.RequestException as e:
            fail(f"Kon bestaande ad_ids niet ophalen: {e}")
        nieuw = [m for m in voertuigen if m["ad_id"] not in bestaand]
        # Ontdubbelen binnen de batch zelf (zelfde ad_id twee keer).
        gezien = set()
        uniek = []
        for m in nieuw:
            if m["ad_id"] in gezien:
                continue
            gezien.add(m["ad_id"])
            uniek.append(m)
        nieuw = uniek
        nieuw_count = len(nieuw)
        log(f"{nieuw_count} nieuwe leads (na dedup tegen bestaande).")
        insert_leads(nieuw)
        nieuwe_particulier = [m for m in nieuw if m["is_particulier"]]

    update_status(http_ok, len(listings), gemapt, nieuw_count, waarschuwing)
    stuur_digest(nieuwe_particulier)
    log("Klaar.")


if __name__ == "__main__":
    main()
