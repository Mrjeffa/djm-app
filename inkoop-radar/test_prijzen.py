"""Tests voor de prijsregels. Draaien: python inkoop-radar/test_prijzen.py"""
from prijzen import bepaal_lokprijs, bepaal_verkoopdoel, bruikbaar


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


def test_lokprijs_mediaan_van_20_tot_30k_km_meer():
    # Onze motor: 2020, 20.000 km → band 40.000–50.000 km
    aanbod = [mo(7500, 2020, 21000),                                  # vergelijkbare km: telt niet mee
              mo(6200, 2020, 41000), mo(6500, 2019, 45000), mo(6900, 2021, 49000),  # in de band
              mo(5000, 2020, 70000),                                  # te veel km
              mo(6000, 2018, 45000)]                                  # bouwjaar te oud
    lok, groep, band = bepaal_lokprijs(aanbod, 2020, 20000)
    assert band == (20000, 30000) and [a["prijs"] for a in groep] == [6200, 6500, 6900]
    assert lok == 6500                                                # mediaan, op €50 omlaag


def test_lokprijs_ruimere_band_en_afronding():
    aanbod = [mo(6430, 2020, 37000), mo(6170, 2020, 58000)]           # 17.000 en 38.000 km meer
    lok, groep, band = bepaal_lokprijs(aanbod, 2020, 20000)
    assert band == (15000, 40000) and lok == 6300                     # mediaan 6300 → 6300
    lok, _, _ = bepaal_lokprijs([mo(6449, 2020, 45000)], 2020, 20000)
    assert lok == 6400                                                # 6449 → €50 omlaag


def test_lokprijs_nooit_boven_markt_en_zonder_data():
    lok, _, _ = bepaal_lokprijs([mo(9000, 2020, 45000)], 2020, 20000, marktprijs=8000)
    assert lok == 8000
    assert bepaal_lokprijs([mo(7000, 2020, 21000)], 2020, 20000) == (None, [], None)
    assert bepaal_lokprijs([mo(7000, 2020, 45000)], 2020, None)[0] is None


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"{len(tests)} tests geslaagd")
