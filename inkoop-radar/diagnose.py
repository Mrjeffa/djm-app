#!/usr/bin/env python3
"""
Diagnose voor de inkoop-radar — DRY-RUN: leest alleen en print naar de log.
Schrijft niets naar Supabase en verstuurt geen mail.

Start via GitHub Actions → Inkoop-radar → Run workflow → modus "diagnose".
Handig als motoroccasion.nl of 2dehands hun site/API aanpassen: de log laat
dan zien hoe de pagina's en advertentievelden er nu uitzien.

Env:
  TEST_MODEL   (default "Kawasaki Z900") — model om op motoroccasion te bekijken
"""
import json
import os
import re

import requests
from bs4 import BeautifulSoup

TEST_MODEL = (os.environ.get("TEST_MODEL") or "Kawasaki Z900").strip()
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9",
}


def kop(t):
    print(f"\n{'=' * 20} {t} {'=' * 20}", flush=True)


def kort(s, n=600):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n] + " …"


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


# ── motoroccasion.nl ─────────────────────────────────────────────────────────
def dump_pagina(url, kaarten=2):
    kop(f"GET {url}")
    try:
        r = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
    except requests.RequestException as e:
        print(f"FOUT: {e}")
        return None
    print(f"status={r.status_code} final={r.url} len={len(r.text)} type={r.headers.get('content-type')}")
    if "text/plain" in (r.headers.get("content-type") or ""):
        print(kort(r.text, 1500))
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    print(f"title: {kort(soup.title.string if soup.title else '', 200)}")

    # Formulieren (zoek/sorteer/filters)
    for f in soup.find_all("form")[:6]:
        velden = []
        for el in f.find_all(["input", "select"])[:25]:
            naam = el.get("name")
            if not naam:
                continue
            if el.name == "select":
                opts = [f"{o.get('value')}={kort(o.get_text(), 30)}" for o in el.find_all("option")[:12]]
                velden.append(f"{naam}[{'; '.join(opts)}]")
            else:
                velden.append(f"{naam}={el.get('value', '')}({el.get('type', '')})")
        print(f"FORM action={f.get('action')} method={f.get('method')} :: {kort(' | '.join(velden), 1500)}")

    # Scripts met data (JSON/state) en externe scripts
    for s in soup.find_all("script"):
        src = s.get("src")
        txt = s.string or s.get_text() or ""
        if src:
            if "motoroccasion" in src or src.startswith("/"):
                print(f"SCRIPT src={src}")
            continue
        if s.get("type") == "application/ld+json" or s.get("id") == "__NEXT_DATA__" \
                or re.search(r"prijs|price|bouwjaar|kilometer|__INITIAL|window\.\w+\s*=", txt, re.I):
            print(f"SCRIPT type={s.get('type')} id={s.get('id')} :: {kort(txt, 1200)}")

    # Sorteer-/pagineerlinks
    gezien = set()
    for a in soup.find_all("a", href=True):
        h = a["href"]
        if re.search(r"sort|order|volgorde|prijs|price|page|pagina|[?&]p=", h, re.I) and h not in gezien:
            gezien.add(h)
            print(f"LINK {kort(a.get_text(), 40)} -> {h}")
            if len(gezien) >= 25:
                break

    # Advertentielinks + de HTML van de eerste kaarten
    adlinks = [a for a in soup.find_all("a", href=True) if re.search(r"-m\d+\.html", a["href"])]
    uniek = list(dict.fromkeys(a["href"] for a in adlinks))
    print(f"ADVERTENTIELINKS: {len(uniek)} uniek; eerste: {uniek[:5]}")
    getoond = 0
    for a in adlinks:
        kaart = a
        for _ in range(6):  # omhoog tot een blok met een €-prijs erin
            if kaart.parent is None:
                break
            kaart = kaart.parent
            if "€" in kaart.get_text() and len(kaart.get_text()) > 60:
                break
        print(f"KAART-HTML ({kaart.name} class={kaart.get('class')}): {kort(str(kaart), 3500)}")
        print(f"KAART-TEKST: {kort(kaart.get_text(' '), 600)}")
        getoond += 1
        if getoond >= kaarten:
            break
    return soup


def diagnose_motoroccasion():
    kop(f"MOTOROCCASION — testmodel '{TEST_MODEL}'")
    try:
        r = requests.get("https://www.motoroccasion.nl/robots.txt", headers=HEADERS, timeout=20)
        print("robots.txt:", kort(r.text, 1200))
    except requests.RequestException as e:
        print(f"robots.txt FOUT: {e}")

    s = slug(TEST_MODEL)
    for url in [
        f"https://www.motoroccasion.nl/motoren/{s}",
        "https://www.motoroccasion.nl/motoren/kawasaki-z-900-b24-tg1129.html",
        "https://www.motoroccasion.nl/",
    ]:
        dump_pagina(url)


# ── 2dehands ─────────────────────────────────────────────────────────────────
def diagnose_2dehands():
    kop("2DEHANDS — velden van de nieuwste motoradvertenties")
    params = {
        "l1CategoryId": "678", "limit": "30", "offset": "0",
        "searchInTitleAndDescription": "true", "viewOptions": "list-view",
        "sortBy": "SORT_INDEX", "sortOrder": "DECREASING",
    }
    try:
        r = requests.get("https://www.2dehands.be/lrp/api/search", params=params,
                         headers={**HEADERS, "Accept": "application/json"}, timeout=30)
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        print(f"FOUT: {e}")
        return
    listings = data.get("listings") or []
    print(f"status={r.status_code} listings={len(listings)}")
    motoren = [l for l in listings if "/motoren/motoren-" in (l.get("vipUrl") or "")][:6]
    for l in motoren:
        print(f"\n-- {kort(l.get('title'), 80)} | {l.get('vipUrl')}")
        print(f"   sleutels: {sorted(l.keys())}")
        for k in ("attributes", "extendedAttributes", "verticals", "categorySpecificDescription"):
            if k in l:
                print(f"   {k}: {kort(json.dumps(l[k], ensure_ascii=False), 1200)}")
        print(f"   beschrijving: {kort(l.get('description'), 300)}")


if __name__ == "__main__":
    diagnose_2dehands()
    diagnose_motoroccasion()
    print("\nKlaar (dry-run, niets weggeschreven).")
