"""Tests voor de typekeuze (welk Motoroccasion-model hoort bij een advertentie).
Draaien: python inkoop-radar/test_motoroccasion.py — geen netwerk nodig."""
from motoroccasion import kies_type, merk_uit_lead, model_uit_term, mooi, zoek_url

SUZUKI = [("dl-650-v-strom", "DL 650 V-STROM"), ("v-strom-650", "V-STROM 650"), ("v-strom-650-xt", "V-STROM 650 XT"),
          ("v-strom-1050", "V-STROM 1050"), ("v-strom-1050-de", "V-STROM 1050 DE"), ("sv-650", "SV 650")]
KAWASAKI = [("versys-650", "VERSYS 650"), ("versys-1000", "VERSYS 1000"), ("z-800", "Z 800"), ("z-800-e", "Z 800 E"),
            ("z-900", "Z 900"), ("z-900-rs", "Z 900 RS"), ("z-900-rs-cafe", "Z 900 RS CAFE"), ("z-90", "Z 90")]


def kies(titel, model, types):
    r = kies_type(titel, model, types)
    return r[0] if r else None


def test_meest_specifieke_variant_uit_de_titel():
    assert kies("Kawasaki Z900 2020 performance", "Z900", KAWASAKI) == "z-900"
    assert kies("Kawasaki Z900RS Cafe 2019", "Z900", KAWASAKI) == "z-900-rs-cafe"   # RS ≠ gewone Z900
    assert kies("Kawasaki z 900 rs 2021", "Z900", KAWASAKI) == "z-900-rs"
    assert kies("Suzuki V-Strom 650 XT 2018", "v-strom", SUZUKI) == "v-strom-650-xt"
    assert kies("Suzuki DL650 V-Strom 2012", "DL650", SUZUKI) == "dl-650-v-strom"


def test_woordgrenzen():
    assert kies("Kawasaki Z800 e-versie A2", "Z800", KAWASAKI) == "z-800-e"        # Z800e = A2-versie
    assert kies("Kawasaki Z800 Edition 2014", "Z800", KAWASAKI) == "z-800"         # 'Edition' ≠ E-type
    assert kies("Kawasaki Z900ABS 2018", "Z900", KAWASAKI) == "z-900"


def test_spelfouten_in_term_en_titel():
    assert kies("Suzuki V-storm 650 abs", "v-storm", SUZUKI) == "v-strom-650"
    assert kies("suzuki vstrom 1050 DE", "vstrom", SUZUKI) == "v-strom-1050-de"
    assert kies("Kawasaki Versis 650 2016", "Versis", KAWASAKI) == "versys-650"
    assert kies("Kawasaki verses 1000 tourer", "verses", KAWASAKI) == "versys-1000"


def test_liever_niets_dan_gokken():
    assert kies("Suzuki V-Strom in topstaat", "v-strom", SUZUKI) is None    # 650 of 1050?
    assert kies("Kawasaki Z650 2019", "Versis", KAWASAKI) is None           # term stond alleen in omschrijving


def test_titel_bepaalt_het_model():
    # Term 'Z900' matchte via de omschrijving ('ruil tegen Z900'), titel zegt Z800:
    # prijzen als wat het is, nooit als Z900.
    assert kies("Kawasaki Z800 2015", "Z900", KAWASAKI) == "z-800"


def test_merk_model_en_url():
    assert merk_uit_lead("https://www.2dehands.be/v/motoren/motoren-harley-davidson/m1-x", "Fat Boy") == "harley-davidson"
    assert merk_uit_lead("https://www.2dehands.be/v/motoren/motoren-overige-merken/m1-x", "Kawasaki Z900") == "kawasaki"
    assert model_uit_term("Harley-Davidson Fat Boy", "harley-davidson") == "Fat Boy"
    assert model_uit_term("Kawasaki Z900", "kawasaki") == "Z900"
    assert zoek_url("kawasaki", "z-900", 2020) == ("https://www.motoroccasion.nl/motoren/kawasaki-z-900"
                                                    "?filters=bouwjaar-vanaf-2019/bouwjaar-tot-2021/sortering-prijsoplopend")


def test_nette_modelnaam_voor_de_bodtekst():
    assert mooi("V-STROM 650 XT") == "V-Strom 650 XT"
    assert mooi("VERSYS 650") == "Versys 650"
    assert mooi("Z 900 RS CAFE") == "Z 900 RS Cafe"


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"{len(tests)} tests geslaagd")
