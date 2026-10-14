#!/usr/bin/env python3
"""
Wekelijkse voorraad-prijscheck (GitHub Actions, maandagochtend).

Laat de edge function `voorraad-prijscheck` alle beschikbare voorraad vergelijken
met Motoroccasion (zelfde model + bouwjaar, ±10.000 km) en stuurt ALLEEN een
mail als er iets te doen is: een goedkopere concurrent, een concurrent onder je
minimum (inkoop + €1.000), een te lage marge, of een mislukte check.
De uitkomst staat daarnaast altijd bij de motor in de app (Voorraad).

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, DIGEST_FROM, DIGEST_TO
"""
import json
import os
import sys

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
DIGEST_FROM = os.environ.get("DIGEST_FROM", "")
DIGEST_TO = [a.strip() for a in os.environ.get("DIGEST_TO", "").split(",") if a.strip()]
PORTIE = 15  # motoren per aanroep (maximale looptijd van een edge function)


def log(msg):
    print(f"[voorraad-prijscheck] {msg}", flush=True)


def getal(n):
    """12345 → '12.345' (alleen het getal; nooit hele HTML-stukken vervangen)."""
    return f"{int(n or 0):,}".replace(",", ".")


def euro(n):
    return f"€ {getal(n)}"


def escape(s):
    return (str(s or "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def headers():
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}


def beschikbare_voorraad():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/voorraad", headers=headers(), timeout=30, params={
        "select": "id", "status": "eq.beschikbaar", "verkocht_op": "is.null"})
    r.raise_for_status()
    return [row["id"] for row in r.json()]


def check_portie(ids):
    r = requests.post(f"{SUPABASE_URL}/functions/v1/voorraad-prijscheck", headers=headers(),
                      data=json.dumps({"voorraad_ids": ids}), timeout=300)
    r.raise_for_status()
    return r.json().get("resultaten") or []


# ── Mail ──────────────────────────────────────────────────────────────────────
KLEUR = {"groen": "#16A34A", "geel": "#D97706", "rood": "#DC2626", "grijs": "#767676"}


def motor_html(r):
    b = r.get("beoordeling") or {}
    kleur = KLEUR.get(b.get("kleur"), "#767676")
    titel = f"{escape(r.get('merk'))} {escape(r.get('model'))} · {r.get('bouwjaar')} · {getal(r.get('km'))} km"
    regels = []
    if r.get("status") == "fout":
        regels.append(f'<span style="color:#DC2626">Check mislukt: {escape(r.get("toelichting"))}</span>')
    elif r.get("status") == "geen_data":
        regels.append(f'Niet te controleren: {escape(r.get("toelichting"))}')
    else:
        regels.append(f'<b style="color:{kleur}">●</b> <b>{escape(b.get("kop"))}</b>')
        if b.get("advies"):
            regels.append(f"Goedkoopste worden: <b>{euro(b['advies'])}</b>"
                          + (f" · jouw minimum {euro(b['minimum'])}" if b.get("minimum") is not None else ""))
        elif b.get("kleur") == "rood":
            regels.append(f'<span style="color:#DC2626">Laagste zit op of onder jouw minimum ({euro(b["minimum"])}) — niet volgen.</span>')
        for c in (r.get("concurrenten") or [])[:3]:
            link = f'<a href="{escape(c.get("url"))}" style="color:#111">{euro(c["prijs"])}</a>' if c.get("url") else euro(c["prijs"])
            regels.append(f'<span style="color:#555">{link} · {getal(c["km"])} km · {escape(c.get("dealer"))}</span>')
    if b.get("margeTeLaag"):
        regels.append('<span style="color:#DC2626">Let op: je vraagprijs ligt onder je minimum (inkoop + € 1.000).</span>')
    zoek = (f'<div style="font-size:11px;margin-top:4px"><a href="{escape(r["mo_url"])}" style="color:#777">'
            f'Bekijk op Motoroccasion</a></div>') if r.get("mo_url") else ""
    prijs = (f'<span style="float:right;color:#111;font-weight:400">jouw prijs <b>{euro(r["prijs"])}</b></span>'
             if r.get("prijs") else "")
    return f"""
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 4px;font-size:14px;border-left:4px solid {kleur};padding-left:12px">
        <div style="font-weight:700;color:#111">{titel} {prijs}</div>
        <div style="margin-top:4px;line-height:1.6">{'<br>'.join(regels)}</div>{zoek}
      </td></tr>"""


def maak_mail(resultaten, mislukt=0):
    """(onderwerp, html) voor de motoren die aandacht vragen, of None.
    mislukt: aantal motoren dat niet gecontroleerd kon worden (portie mislukt)."""
    aandacht = [r for r in resultaten if (r.get("beoordeling") or {}).get("actieNodig") or r.get("status") == "fout"]
    if not aandacht and not mislukt:
        return None
    volgorde = {"rood": 0, "geel": 1, "grijs": 2, "groen": 3}
    aandacht.sort(key=lambda r: (r.get("status") != "fout", volgorde.get((r.get("beoordeling") or {}).get("kleur"), 9)))
    niet_gecheckt = [r for r in resultaten if r.get("status") == "geen_data"]
    n, rest = len(aandacht), len(resultaten) - len(aandacht) - len(niet_gecheckt)
    if n:
        onderwerp = f"Prijscheck voorraad: {n} {'motor vraagt' if n == 1 else 'motoren vragen'} aandacht"
    else:
        onderwerp = "Prijscheck voorraad: check niet (volledig) gelukt"
    in_orde = "" if not rest else f"{rest} andere {'motor is' if rest == 1 else 'motoren zijn'} in orde."
    if niet_gecheckt:
        namen = ", ".join(escape(f"{r.get('merk')} {r.get('model')}") for r in niet_gecheckt[:5])
        in_orde += (f" {len(niet_gecheckt)} niet te controleren (bouwjaar of km-stand ontbreekt): {namen}"
                    f"{' …' if len(niet_gecheckt) > 5 else ''}.")
    if mislukt:
        in_orde += (f' <b style="color:#DC2626">{mislukt} motor{"en" if mislukt != 1 else ""} kon{"den" if mislukt != 1 else ""}'
                    ' niet gecontroleerd worden</b> — zie de GitHub Actions-log "Voorraad-prijscheck", of probeer'
                    ' "Check prijs" in de app.')
    html = f"""
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="border-top:4px solid #E31E24;padding:16px 0 8px">
        <h2 style="margin:0;font-size:18px;color:#111">{escape(onderwerp)}</h2>
        <p style="color:#777;font-size:13px;margin:4px 0 12px">Vergeleken met Motoroccasion: zelfde model en bouwjaar, ±10.000 km.
        {in_orde}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee">{''.join(motor_html(r) for r in aandacht)}</table>
      <p style="color:#999;font-size:11px;margin-top:16px">Automatisch gegenereerd door de DJM voorraad-prijscheck. Details en "Check prijs" vind je in de app onder Voorraad.</p>
    </div>"""
    return onderwerp, html


def stuur_mail(onderwerp, html):
    if not (RESEND_API_KEY and DIGEST_FROM and DIGEST_TO):
        log("WAARSCHUWING: Resend-config ontbreekt — mail overgeslagen.")
        return
    r = requests.post("https://api.resend.com/emails", timeout=30,
                      headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                      data=json.dumps({"from": DIGEST_FROM, "to": DIGEST_TO, "subject": onderwerp, "html": html}))
    if r.status_code >= 300:
        log(f"WAARSCHUWING: mail versturen mislukt ({r.status_code}): {r.text[:300]}")
    else:
        log(f"Mail verstuurd naar {', '.join(DIGEST_TO)}.")


def main():
    if not (SUPABASE_URL and SERVICE_KEY):
        log("FOUT: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.")
        sys.exit(1)
    ids = beschikbare_voorraad()
    log(f"{len(ids)} beschikbare motor(en) in voorraad.")
    resultaten, mislukt = [], 0
    for i in range(0, len(ids), PORTIE):
        portie = ids[i:i + PORTIE]
        try:
            resultaten += check_portie(portie)
        except (requests.RequestException, ValueError) as e:
            mislukt += len(portie)
            log(f"FOUT: portie {i // PORTIE + 1} ({len(portie)} motoren) mislukt: {e}")
    for r in resultaten:
        b = r.get("beoordeling") or {}
        log(f"  {r.get('merk')} {r.get('model')} {r.get('bouwjaar')}: {r.get('status')} — {b.get('kop') or r.get('toelichting')}")
    mail = maak_mail(resultaten, mislukt)
    if mail:
        stuur_mail(*mail)
    else:
        log("Alles in orde — geen mail.")
    if mislukt:
        log(f"FOUT: {mislukt} motor(en) niet gecontroleerd.")
        sys.exit(1)  # run rood in GitHub, zodat een stille storing opvalt
    log("Klaar.")


if __name__ == "__main__":
    main()
