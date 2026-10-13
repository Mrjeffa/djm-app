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


def structuur(obj, pad="$", diepte=0, max_diepte=4):
    """Print de vorm van een JSON-object (sleutels, types, lijstlengtes)."""
    if diepte > max_diepte:
        return
    if isinstance(obj, dict):
        print(f"{'  ' * diepte}{pad}: dict({len(obj)}) sleutels={list(obj.keys())[:40]}")
        for k, v in list(obj.items())[:40]:
            if isinstance(v, (dict, list)):
                structuur(v, f"{pad}.{k}", diepte + 1, max_diepte)
    elif isinstance(obj, list):
        print(f"{'  ' * diepte}{pad}: list({len(obj)})")
        if obj and isinstance(obj[0], (dict, list)):
            structuur(obj[0], f"{pad}[0]", diepte + 1, max_diepte)


def dump_json(url):
    kop(f"GET (JSON) {url}")
    try:
        r = requests.get(url, headers={**HEADERS, "Accept": "application/json"}, timeout=30)
        print(f"status={r.status_code} final={r.url} len={len(r.text)} type={r.headers.get('content-type')}")
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        print(f"FOUT: {e}")
        return None
    structuur(data)
    # Zoek de eerste lijst met dicts die op advertenties lijkt en toon 2 items volledig.
    def vind(o):
        if isinstance(o, list) and o and isinstance(o[0], dict) and len(o) >= 3:
            return o
        if isinstance(o, dict):
            for v in o.values():
                x = vind(v)
                if x:
                    return x
        return None
    items = vind(data)
    if items:
        print(f"EERSTE ITEMLIJST: {len(items)} items")
        for it in items[:2]:
            print(f"ITEM: {kort(json.dumps(it, ensure_ascii=False), 3000)}")
    # Ook alles wat naar paginering/sortering/totaal ruikt
    if isinstance(data, dict):
        for k, v in data.items():
            if re.search(r"page|total|count|sort|order|meta|pagination|links", k, re.I):
                print(f"META {k}: {kort(json.dumps(v, ensure_ascii=False), 800)}")
    return data


def dump_js(url, patroon=r"sort|order|price|prijs|page"):
    kop(f"JS {url}")
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except requests.RequestException as e:
        print(f"FOUT: {e}")
        return
    print(f"status={r.status_code} len={len(r.text)}")
    gezien = 0
    for m in re.finditer(patroon, r.text, re.I):
        s = max(0, m.start() - 120)
        print(f"…{kort(r.text[s:m.end() + 160], 300)}…")
        gezien += 1
        if gezien >= 25:
            break


def diagnose_motoroccasion():
    kop(f"MOTOROCCASION — testmodel '{TEST_MODEL}'")
    s = slug(TEST_MODEL)
    basis = f"https://www.motoroccasion.nl/motoren/{s}"

    # 1) Zelfde modelpagina als HTML (wat een browser ziet) en als JSON
    dump_pagina_html(basis)
    dump_json(basis)
    # 2) Varianten die mogelijk sorteren/pagineren (zonder ?filters=, robots.txt)
    for variant in [f"{basis}?sort=price-asc", f"{basis}?page=2"]:
        dump_json(variant)
    # 3) De zoek-/filter-scripts: hoe worden sortering en paginering doorgegeven?
    dump_js("https://www.motoroccasion.nl/min/js/inventory_filters.js")
    dump_js("https://www.motoroccasion.nl/min/js/search-form.js")


def dump_pagina_html(url):
    """Als dump_pagina, maar dwingt HTML af en toont tegels/paginering/sortering."""
    kop(f"GET (HTML) {url}")
    try:
        r = requests.get(url, headers={**HEADERS, "Accept": "text/html"}, timeout=30)
    except requests.RequestException as e:
        print(f"FOUT: {e}")
        return
    print(f"status={r.status_code} final={r.url} len={len(r.text)} type={r.headers.get('content-type')}")
    soup = BeautifulSoup(r.text, "html.parser")
    print(f"title: {kort(soup.title.string if soup.title else '', 200)}")
    klassen = {}
    for art in soup.find_all("article"):
        k = " ".join(art.get("class") or [])
        klassen[k] = klassen.get(k, 0) + 1
    print(f"ARTICLE-klassen: {klassen}")
    for sel in soup.find_all("select"):
        opts = [f"{o.get('value')}={kort(o.get_text(), 30)}" for o in sel.find_all("option")[:15]]
        print(f"SELECT name={sel.get('name')} id={sel.get('id')} :: {opts}")
    for el in soup.find_all(attrs={"data-sort": True})[:10]:
        print(f"DATA-SORT: {kort(str(el), 300)}")
    for a in soup.find_all("a", href=True):
        if re.search(r"page|pagina|sort|[?&]p=", a["href"], re.I):
            print(f"LINK {kort(a.get_text(), 30)} -> {a['href']}")
    tegels = [a for a in soup.find_all("article") if a.find("a", href=re.compile(r"-m\d+\.html"))]
    print(f"TEGELS met advertentielink: {len(tegels)}")
    for t in tegels[:2]:
        print(f"TEGEL-HTML: {kort(str(t), 2500)}")
    # totaal/teller-tekst
    m = re.search(r"(\d[\d.]*)\s+(?:nieuwe en gebruikte|motoren|resultaten)", soup.get_text(" "), re.I)
    if m:
        print(f"TELLER: {m.group(0)}")


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
    if os.environ.get("DIAGNOSE_2DEHANDS", "1") == "1":
        diagnose_2dehands()
    diagnose_motoroccasion()
    print("\nKlaar (dry-run, niets weggeschreven).")
