"""
Prijsregels van de inkoop-radar — pure functies, zonder netwerk, zodat ze los
te testen zijn (zie test_prijzen.py).

Verkoopdoel (Motoroccasion):
  - Vergelijkbaar = zelfde bouwjaar of 1 jaar ouder, km-stand max. 10.000 km
    verschil. Minder dan 3 gevonden → ook 1 jaar jonger meenemen.
  - Overslaan: nieuw/0 km, "prijs op aanvraag" (geen prijs), BTW-motoren.
  - Verkoopdoel = gemiddelde van de max. 3 goedkoopste vergelijkbare.
    Bij 1 of 2: gemiddelde van wat er is. Geen: "te weinig data".

De inkoopadviezen (openingsbod, max, kleur, bodtekst) worden in de app
berekend uit het verkoopdoel, zodat de vuistregels op één plek zichtbaar zijn.
"""

KM_MARGE = 10_000
MAX_VERGELIJKERS = 3


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
