"""Beveiligingstest: probeert als buitenstaander (alleen de publieke anon key,
zoals iedere bezoeker die heeft) bij afgeschermde gegevens en functies te komen.
Faalt (exit 1) zodra dat ergens lukt. Leest en verwijdert niets.

Draait via .github/workflows/beveiligingstest.yml; lokaal: python scripts/beveiligingstest.py
Optioneel APP_URL=https://... om ook de beveiligingsheaders van de live app te controleren.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BRON = (Path(__file__).resolve().parent.parent / "src/lib/supabase.js").read_text()
URL = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", BRON).group(1)
ANON = re.search(r"SUPABASE_ANON_KEY\s*=\s*'([^']+)'", BRON).group(1)

# Tabellen waar een buitenstaander niets van mag zien.
AFGESCHERMD = [
    "klanten", "motoren", "km_historie", "service_beurten", "afspraken", "admins",
    "taken", "klussen", "voorraad_chassis", "voorraad_service", "voorraad_inkoop",
    "voorraad_prijscheck", "inkoop_leads", "inkoop_aanvragen", "inkoop_populair",
    "inkoop_radar_status",
]
# Functies die een buitenstaander niet mag kunnen uitvoeren (onschuldige argumenten).
RPC_VERBODEN = {
    "delete_auth_user_by_id": {"target_user_id": "00000000-0000-0000-0000-000000000000"},
    "verwijder_eigen_account": {},
    "bewaak_klanten_mutaties": {},
    "bewaak_afspraken_mutaties": {},
    "get_bezette_dagen": {},
}
# Edge functions die alleen voor admins zijn (lege opdracht: doet niets, ook als het lek zou zijn).
EDGE_ALLEEN_ADMIN = {
    "cloudinary-delete": {"urls": []},
    "voorraad-prijscheck": {},
}
HEADERS_VERPLICHT = ["content-security-policy", "strict-transport-security",
                     "x-content-type-options", "x-frame-options", "referrer-policy"]

fouten: list[str] = []


def verzoek(methode: str, url: str, body=None, extra=None):
    h = {"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=methode, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), dict(e.headers)


def controleer(naam: str, goed: bool, uitleg: str):
    print(f"{'OK  ' if goed else 'LEK '} {naam}: {uitleg}")
    if not goed:
        fouten.append(naam)


for t in AFGESCHERMD:
    status, body, _ = verzoek("GET", f"{URL}/rest/v1/{t}?select=*&limit=1")
    zichtbaar = status == 200 and body.strip() not in ("[]", "")
    controleer(f"tabel {t}", not zichtbaar, f"HTTP {status}, {'rijen zichtbaar!' if zichtbaar else 'niets zichtbaar'}")

for f, args in RPC_VERBODEN.items():
    status, body, _ = verzoek("POST", f"{URL}/rest/v1/rpc/{f}", args)
    controleer(f"rpc {f}", status >= 400, f"HTTP {status}")

for f, args in EDGE_ALLEEN_ADMIN.items():
    status, body, _ = verzoek("POST", f"{URL}/functions/v1/{f}", args)
    controleer(f"edge function {f}", status in (401, 403), f"HTTP {status} {body[:80]}")

app = os.environ.get("APP_URL", "").strip()
if app:
    req = urllib.request.Request(app, headers={"User-Agent": "beveiligingstest"})
    with urllib.request.urlopen(req, timeout=30) as r:
        h = {k.lower() for k in r.headers.keys()}
    for k in HEADERS_VERPLICHT:
        controleer(f"header {k}", k in h, "aanwezig" if k in h else "ontbreekt")
else:
    print("(APP_URL niet gezet: headers van de live app niet gecontroleerd)")

print()
if fouten:
    print(f"MISLUKT: {len(fouten)} probleem/problemen: {', '.join(fouten)}")
    sys.exit(1)
print("Alles afgeschermd.")
