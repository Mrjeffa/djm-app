"""Tests voor het omzetten van 2dehands-advertenties. Draaien: python inkoop-radar/test_mapping.py"""
from fetch_leads import bouwjaar_en_km, is_particulier, map_listing


def lead(price_type, cents):
    return map_listing({"itemId": "m1", "title": "Test", "priceInfo": {"priceType": price_type, "priceCents": cents}})


def test_prijs_voor_elk_bedrag():
    assert lead("FIXED", 330000)["prijs"] == 3300
    assert lead("MIN_BID", 280000)["prijs"] == 2800     # "bieden vanaf" — was ten onrechte n.o.t.k.
    assert lead("RESERVED", 500000)["prijs"] == 5000
    assert lead("FAST_BID", 0)["prijs"] is None          # "bieden" zonder bedrag


def test_bouwjaar_en_km():
    attrs = {"attributes": [{"key": "constructionYear", "value": "2025"}, {"key": "mileage", "value": "6300"}]}
    assert bouwjaar_en_km(attrs, "Honda CB750 Hornet", "") == (2025, 6300)
    assert bouwjaar_en_km({}, "Kawasaki Z900 2020 23.450 km", "topsnelheid 240 km/h") == (2020, 23450)
    assert bouwjaar_en_km({}, "BMW R1250GS", "kilometerstand: 18.500") == (None, 18500)
    # twee verschillende km-standen in de tekst → niet gokken
    assert bouwjaar_en_km({}, "Yamaha MT-07 2019", "onderhoud bij 30.000 km, nu 42.000 km") == (2019, None)


def test_bouwjaar_uit_omschrijving_alleen_met_signaalwoord():
    assert bouwjaar_en_km({}, "Kawasaki z800e", "Kawasaki z800e de 2016 avec 44000 km")[0] == 2016
    assert bouwjaar_en_km({}, "Suzuki VZ800", "mooie motor, bouwjaar: 2010")[0] == 2010
    assert bouwjaar_en_km({}, "Honda CB500F", "bj. 2019, altijd binnen gestaan")[0] == 2019
    assert bouwjaar_en_km({}, "Yamaha MT-07", "nieuwe banden 2023, gekeurd in 2025")[0] is None
    assert bouwjaar_en_km({}, "BMW F800", "van 2008, onderhoud uit 2023")[0] is None   # twee kandidaten → niet gokken


def test_adverteerder_bedrijf_is_geen_particulier():
    assert is_particulier([], "Jan", "", "Bedrijf") is False
    assert is_particulier([], "Jan", "", "Particulier") is True


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"{len(tests)} tests geslaagd")
