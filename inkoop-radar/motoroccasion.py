"""
Motoroccasion.nl-opzoeker voor de inkoop-radar.

Afspraak (met de eigenaar besproken, i.v.m. hun robots.txt): per lead precies
één zoekverzoek — de modelpagina gefilterd op bouwjaar (1 ouder t/m 1 jonger)
en gesorteerd op prijs laag→hoog, alleen pagina 1. Geen vervolgpagina's.
Daarnaast hooguit één verzoek per merk per run (de gewone merkpagina) om de
juiste typenaam te vinden, bv. "Z 900 RS" i.p.v. "Z 900" voor een Z900RS.

De site levert op dezelfde URL JSON als je daarom vraagt (Accept: application/json).
"""
import re
import time
from difflib import SequenceMatcher

import requests

BASIS = "https://www.motoroccasion.nl"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "nl-NL,nl;q=0.9",
}
PAUZE_SEC = 2.0                               # rustig tempo tussen verzoeken
SORTEER_SEGMENT = "/sortering-prijsoplopend"  # = "Prijs (laag naar hoog)" op de site

_laatste_verzoek = 0.0


class MoFout(Exception):
    """Motoroccasion gaf iets anders terug dan verwacht. systemisch=True betekent
    dat de site waarschijnlijk is gewijzigd (onderhoud nodig), anders gaat het om
    één model (bv. een schrijfwijze die Motoroccasion niet kent)."""
    def __init__(self, melding, systemisch=False):
        super().__init__(melding)
        self.systemisch = systemisch


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def _get_json(url):
    global _laatste_verzoek
    wacht = PAUZE_SEC - (time.monotonic() - _laatste_verzoek)
    if wacht > 0:
        time.sleep(wacht)
    _laatste_verzoek = time.monotonic()
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    try:
        return r.json()
    except ValueError:
        raise MoFout(f"geen JSON van {url}", systemisch=True)


# ── Merk en type bepalen ─────────────────────────────────────────────────────
def merk_uit_lead(lead_url, term):
    """Merk-slug uit de 2dehands-categorie (/motoren/motoren-kawasaki/), anders
    het eerste woord van de populaire term (bv. 'Kawasaki Z900')."""
    m = re.search(r"/motoren/motoren-([a-z0-9-]+)/", (lead_url or "").lower())
    if m and m.group(1) not in ("overige-merken", "overige"):
        return m.group(1)
    woorden = (term or "").split()
    return slug(woorden[0]) if len(woorden) >= 2 else None


def model_uit_term(term, merk):
    """'Kawasaki Z900' + 'kawasaki' → 'Z900'; 'MT-07' → 'MT-07'."""
    merkdelen = {norm(d) for d in (merk or "").split("-")} | {norm(merk)}
    return " ".join(w for w in (term or "").split() if norm(w) not in merkdelen).strip()


def mooi(type_naam):
    """'V-STROM 650 XT' → 'V-Strom 650 XT' (woorden ≥4 letters netjes, afkortingen blijven)."""
    return re.sub(r"[A-Za-z]{4,}", lambda w: w.group(0).capitalize(), type_naam or "")


def types_uit(data):
    """[(typekey, typenaam)] uit de typeOptions van een Motoroccasion-antwoord."""
    out = []
    for groep in (data.get("typeOptions") or {}).values():
        for opt in ((groep or {}).get("options") or {}).values():
            key = (opt or {}).get("value") or (opt or {}).get("key")
            naam = re.sub(r"\s*\(\d+\)\s*$", "", (opt or {}).get("text") or (opt or {}).get("name") or "")
            if key and naam:
                out.append((key, naam))
    return out


def _tokens(s):
    """'Z800 e-versie' → ['z', '800', 'e', 'versie'] (ook letter/cijfer-grenzen)."""
    return re.findall(r"[a-z]+|\d+", (s or "").lower())


def _staat_in(type_naam, titel_tokens):
    """Staat het type als aaneengesloten héle woorddelen in de titel? Zo telt
    'Z800 e-versie' als Z 800 E, maar 'Z800 Edition' niet."""
    doel = norm(type_naam)
    for i in range(len(titel_tokens)):
        acc = ""
        for tok in titel_tokens[i:]:
            acc += tok
            if acc == doel:
                return True
            if not doel.startswith(acc):
                break
    return False


def _letters_cijfers(s):
    n = norm(s)
    return re.sub(r"\d", "", n), re.sub(r"\D", "", n)


def _lijkt(a, b, drempel=0.8):
    return a == b or SequenceMatcher(None, a, b).ratio() >= drempel


def kies_type(titel, model, types):
    """Kiest het Motoroccasion-type voor een advertentie. Geeft (key, naam) of None.

    1. Meest specifieke type dat in de titel staat én het populaire model bevat
       ('Z900RS Cafe' → 'Z 900 RS CAFE', niet 'Z 900').
    2. Het type dat exact het model is.
    3. Spelfout-tolerant (verkopers en zoektermen als 'V-storm', 'Versis'):
       een stukje titel lijkt op een type — letters mogen licht afwijken, maar
       cijfers moeten exact gelijk zijn (Z800 wordt nooit Z900) en er moet een
       cijfer in zitten (zonder cc is 'V-Strom' 650 óf 1050: dan liever niets)."""
    m, tokens = norm(model), _tokens(titel)
    if not m:
        return None
    in_titel = [(k, n) for k, n in types if m in norm(n) and _staat_in(n, tokens)]
    if in_titel:
        return max(in_titel, key=lambda kn: len(norm(kn[1])))
    # Alleen als de titel het model ook noemt (bv. 'Z900ABS'); stond de term
    # alleen in de omschrijving, dan bepaalt de titel welk model het is.
    exact = [(k, n) for k, n in types if norm(n) == m]
    if exact and m in norm(titel):
        return exact[0]

    m_letters, _ = _letters_cijfers(model)
    woorden = (titel or "").split()
    stukjes = {" ".join(woorden[i:i + n]) for n in range(1, 5) for i in range(len(woorden) - n + 1)}
    beste = None
    for k, naam in types:
        letters, cijfers = _letters_cijfers(naam)
        if not cijfers or not letters or not (m_letters in letters or _lijkt(m_letters, letters, 0.7)):
            continue
        for stuk in stukjes:
            s_letters, s_cijfers = _letters_cijfers(stuk)
            if s_cijfers == cijfers and _lijkt(s_letters, letters):
                score = (SequenceMatcher(None, s_letters, letters).ratio(), len(norm(naam)))
                if beste is None or score > beste[0]:
                    beste = (score, (k, naam))
    return beste[1] if beste else None


_types_per_merk = {}


def types_voor_merk(merk):
    """Typelijst van een merk via de gewone merkpagina (geen filter-URL); 1× per run."""
    if merk not in _types_per_merk:
        try:
            _types_per_merk[merk] = types_uit(_get_json(f"{BASIS}/motoren/{merk}"))
        except (requests.RequestException, MoFout):
            _types_per_merk[merk] = []
    return _types_per_merk[merk]


# ── Zoeken ───────────────────────────────────────────────────────────────────
def zoek_url(merk, type_key, bouwjaar):
    return (f"{BASIS}/motoren/{merk}-{type_key}"
            f"?filters=bouwjaar-vanaf-{bouwjaar - 1}/bouwjaar-tot-{bouwjaar + 1}{SORTEER_SEGMENT}")


def naar_aanbod(it):
    a = it.get("attributesByKey") or {}
    prijs_info = a.get("price") or {}
    prijs = prijs_info.get("amount")
    if "aanvraag" in str(prijs_info.get("priceType") or "").lower():
        prijs = None
    legacy, sl = it.get("legacyId"), it.get("slug") or "motor"
    return {
        "prijs": int(prijs) if isinstance(prijs, (int, float)) and prijs > 0 else None,
        "bouwjaar": it.get("manufactureYear"),
        "km": (a.get("odometer") or {}).get("value"),
        "nieuw": bool(a.get("new")),
        "btw": bool(a.get("vat_deductible")),
        "url": f"{BASIS}/motoren/{sl}-m{legacy}.html" if legacy else None,
        "titel": f"{it.get('brand') or ''} {it.get('type') or ''}".strip(),
        "dealer": it.get("companyName"),
    }


def zoek_aanbod(merk, type_key, bouwjaar):
    """Eén verzoek: pagina 1, gefilterd op bouwjaar±1, prijs laag→hoog.
    Geeft (aanbod_lijst, url). Gooit MoFout als de site de filters niet
    (meer) toepast — dan is er onderhoud nodig."""
    url = zoek_url(merk, type_key, bouwjaar)
    data = _get_json(url)
    filters = {f.get("key"): f.get("value") for f in data.get("activeFiltersList") or []}
    if filters.get("brand") != merk or not filters.get("type"):
        raise MoFout(f"model '{merk}-{type_key}' niet herkend door Motoroccasion")
    if "bouwjaar_vanaf" not in filters or "bouwjaar_tot" not in filters:
        raise MoFout("bouwjaarfilter niet toegepast — URL-opbouw van Motoroccasion gewijzigd?", systemisch=True)
    items = data.get("inventories") or []
    aanbod = [naar_aanbod(it) for it in items]
    # Alleen pagina 1: dat is pas betrouwbaar als die echt op prijs gesorteerd is.
    # Motoroccasion sorteert niet 100% strikt (soms staat €6.495 vóór €6.290),
    # dus pas alarm bij duidelijk ongesorteerd: >25% dalingen tussen buren.
    totaal = (data.get("metadata") or {}).get("totalCount") or len(items)
    prijzen = [a["prijs"] for a in aanbod if a["prijs"]]
    dalingen = sum(1 for a, b in zip(prijzen, prijzen[1:]) if b < a)
    if totaal > len(items) and ("sorting" not in filters or dalingen > len(prijzen) // 4):
        raise MoFout("sortering op prijs niet toegepast — URL-opbouw van Motoroccasion gewijzigd?", systemisch=True)
    # Typelijst bewust niet uit dit (op bouwjaar gefilterde) antwoord halen:
    # die kan onvolledig zijn. Alleen de merkpagina (types_voor_merk) telt.
    return aanbod, url
