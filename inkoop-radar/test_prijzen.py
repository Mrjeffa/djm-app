"""Tests voor de prijsregels. Draaien: python inkoop-radar/test_prijzen.py"""
from prijzen import bepaal_verkoopdoel, bruikbaar


def mo(prijs, jaar, km, nieuw=False, btw=False):
    return {"prijs": prijs, "bouwjaar": jaar, "km": km, "nieuw": nieuw, "btw": btw}


def test_drie_goedkoopste_van_zelfde_of_jaar_ouder():
    aanbod = [mo(9000, 2020, 20000), mo(7000, 2020, 18000), mo(7500, 2019, 25000),
              mo(8000, 2020, 15000), mo(6000, 2018, 20000)]          # 2018 = te oud
    doel, gekozen, _ = bepaal_verkoopdoel(aanbod, 2020, 20000)
    assert [a["prijs"] for a in gekozen] == [7000, 7500, 8000]
    assert doel == 7500


def test_km_verschil_max_10000():
    aanbod = [mo(5000, 2020, 31000), mo(7000, 2020, 30000)]          # 31000 = 11.000 verschil
    doel, gekozen, _ = bepaal_verkoopdoel(aanbod, 2020, 20000)
    assert [a["prijs"] for a in gekozen] == [7000] and doel == 7000


def test_jaar_jonger_alleen_bij_minder_dan_drie():
    # genoeg (3) in jaar/jaar-1 → de goedkopere 2021 telt niet mee
    aanbod = [mo(8000, 2020, 20000), mo(8100, 2020, 20000), mo(8200, 2019, 20000), mo(6000, 2021, 20000)]
    doel, gekozen, _ = bepaal_verkoopdoel(aanbod, 2020, 20000)
    assert 2021 not in [a["bouwjaar"] for a in gekozen] and doel == 8100
    # maar 2 → 2021 komt erbij
    aanbod = [mo(8000, 2020, 20000), mo(8200, 2019, 20000), mo(9000, 2021, 20000)]
    doel, gekozen, _ = bepaal_verkoopdoel(aanbod, 2020, 20000)
    assert len(gekozen) == 3 and doel == round((8000 + 8200 + 9000) / 3)


def test_overslaan_nieuw_btw_aanvraag():
    assert not bruikbaar(mo(9000, 2025, 0))                  # 0 km
    assert not bruikbaar(mo(9000, 2025, 10, nieuw=True))     # nieuw
    assert not bruikbaar(mo(9000, 2022, 5000, btw=True))     # BTW-motor
    assert not bruikbaar(mo(None, 2022, 5000))               # prijs op aanvraag
    assert bruikbaar(mo(9000, 2022, 5000))


def test_een_of_twee_vergelijkers_en_geen_data():
    doel, gekozen, _ = bepaal_verkoopdoel([mo(7000, 2020, 20000)], 2020, 20000)
    assert doel == 7000 and len(gekozen) == 1
    doel, gekozen, toel = bepaal_verkoopdoel([mo(7000, 2015, 20000)], 2020, 20000)
    assert doel is None and gekozen == [] and toel
    doel, _, toel = bepaal_verkoopdoel([mo(7000, 2020, 20000)], None, 20000)
    assert doel is None and "onbekend" in toel


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"{len(tests)} tests geslaagd")
