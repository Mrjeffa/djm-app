"""
Prijsregels van de inkoop-radar — pure functies, zonder netwerk, zodat ze los
te testen zijn (zie test_prijzen.py).

Verkoopdoel (Motoroccasion):
  - Vergelijkbaar = zelfde bouwjaar of 1 jaar ouder, km-stand max. 10.000 km
    verschil. Minder dan 3 gevonden → ook 1 jaar jonger meenemen.
  - Overslaan: nieuw/0 km, "prijs op aanvraag" (geen prijs), BTW-motoren.
  - Verkoopdoel = gemiddelde van de max. 3 goedkoopste vergelijkbare.
    Bij 1 of 2: gemiddelde van wat er is. Geen: "te weinig data".

Lokprijs (de lage kant van het verkoopdoel, waar we op inzetten):
  - We willen klanten lokken: onze motor kost ongeveer wat dezelfde motoren
    met 20.000–30.000 km MEER kosten, maar heeft minder km.
  - Lokprijs = mediaan van de prijzen van die motoren (bouwjaar ±1), afgerond
    op €50 omlaag. Geen motoren in die band → ruimer (15.000–40.000 km meer).
  - Nooit hoger dan de marktprijs (het verkoopdoel hierboven).

De inkoopadviezen (openingsbod, max, kleur, bodtekst) worden in de app
berekend uit lokprijs/verkoopdoel, zodat de vuistregels op één plek zichtbaar zijn.
"""
from statistics import median

KM_MARGE = 10_000
MAX_VERGELIJKERS = 3
LOK_BANDEN = [(20_000, 30_000), (15_000, 40_000)]  # km méér dan onze motor; eerst smal, dan ruimer


def bruikbaar(aanbod):
    """Mag dit Motoroccasion-aanbod meetellen? aanbod is een dict met
    prijs, bouwjaar, km, nieuw, btw (zoals mo_aanbod() in motoroccasion.py levert)."""
    if not aanbod.get("prijs") or aanbod["prijs"] <= 0:
        return False                      # prijs op aanvraag / geen prijs
    if aanbod.get("nieuw") or not aanbod.get("km"):
        return False                      # nieuw of 0 km
    if aanbod.get("btw"):
        return False                      # BTW-motor
    if not aanbod.get("bouwjaar"):
        return False
    return True


def vergelijkbaar(aanbod, bouwjaar, km, jaren):
    return aanbod["bouwjaar"] in jaren and abs(aanbod["km"] - km) <= KM_MARGE


def bepaal_verkoopdoel(aanbod_lijst, bouwjaar, km):
    """Geeft (verkoopdoel|None, gebruikte_vergelijkers, toelichting)."""
    if not bouwjaar or km is None:
        return None, [], "bouwjaar of km-stand onbekend in de advertentie"
    kandidaten = sorted((a for a in aanbod_lijst if bruikbaar(a)), key=lambda a: a["prijs"])

    gekozen = [a for a in kandidaten if vergelijkbaar(a, bouwjaar, km, {bouwjaar, bouwjaar - 1})]
    if len(gekozen) < MAX_VERGELIJKERS:
        gekozen = [a for a in kandidaten
                   if vergelijkbaar(a, bouwjaar, km, {bouwjaar, bouwjaar - 1, bouwjaar + 1})]
    gekozen = gekozen[:MAX_VERGELIJKERS]

    if not gekozen:
        return None, [], f"geen vergelijkbare motoren ({bouwjaar}±1, ±{KM_MARGE:,} km)".replace(",", ".")
    doel = round(sum(a["prijs"] for a in gekozen) / len(gekozen))
    return doel, gekozen, None


def bepaal_lokprijs(aanbod_lijst, bouwjaar, km, marktprijs=None):
    """Lokprijs: mediaan van dezelfde motoren (bouwjaar ±1) met 20–30.000 km
    méér (anders 15–40.000), afgerond op €50 omlaag en nooit boven de
    marktprijs. Geeft (lokprijs|None, groep, (laag, hoog)|None)."""
    if not bouwjaar or km is None:
        return None, [], None
    jaren = {bouwjaar - 1, bouwjaar, bouwjaar + 1}
    kandidaten = [a for a in aanbod_lijst if bruikbaar(a) and a["bouwjaar"] in jaren]
    for laag, hoog in LOK_BANDEN:
        groep = sorted((a for a in kandidaten if km + laag <= a["km"] <= km + hoog), key=lambda a: a["prijs"])
        if groep:
            lok = int(median(a["prijs"] for a in groep)) // 50 * 50
            if marktprijs is not None:
                lok = min(lok, marktprijs)
            return lok, groep, (laag, hoog)
    return None, [], None
