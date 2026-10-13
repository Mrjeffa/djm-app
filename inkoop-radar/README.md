# Inkoop-radar

Dagelijkse job die nieuw geplaatste (particuliere) motoradvertenties van
**2dehands.be / 2ememain.be** ophaalt en als inkoop-leads in Supabase zet.
Nieuwe particuliere leads komen ook binnen als **digest-mail** (Resend).
De leads verschijnen in de app onder de admin-tab **Inkoop**.

## Hoe het werkt

1. GitHub Actions draait `inkoop-radar/fetch_leads.py` (cron ~07:00 Brussel).
2. Het script bevraagt de interne Adevinta zoek-API
   `https://www.2dehands.be/lrp/api/search` (categorie *Motoren*, nieuwste eerst,
   prijsrange), filtert onderdelen/accessoires eruit, en bepaalt per advertentie
   of de verkoper particulier is.
3. Nieuwe advertenties (ontdubbeld op `ad_id`) worden server-side in
   `inkoop_leads` geschreven met de **service-role key** (omzeilt RLS).
4. Bij nieuwe *particuliere* leads gaat er één digest-mail uit (prijs oplopend).
5. Leads ouder dan de bewaartermijn (Instellingen → Inkoop-radar) worden
   opgeruimd; leads op "naar inkoop" blijven staan.
6. **Inkoopadvies**: voor particuliere leads van een populair model
   (Instellingen → Populaire modellen) bepaalt `motoroccasion.py` een
   verkoopdoel, zie hieronder.
7. De gezondheid van elke run staat in `inkoop_radar_status`; de app toont
   bovenaan een melding als het API-schema mogelijk is gewijzigd.

Idempotent: twee keer draaien levert geen dubbele rijen en geen dubbele mail op.

## Inkoopadvies via Motoroccasion

Per lead **precies één zoekverzoek** op motoroccasion.nl: het model, gefilterd
op bouwjaar (1 ouder t/m 1 jonger), gesorteerd op prijs laag → hoog, alleen
pagina 1. Plus hooguit één verzoek per merk per run (de gewone merkpagina) om
de juiste typenaam te vinden. Leads van hetzelfde model en bouwjaar delen dat
verzoek. Bewust zuinig: Motoroccasion vraagt in hun robots.txt geen
filter-URL's automatisch op te halen, en dit is het afgesproken minimum.

- **Model**: het meest specifieke Motoroccasion-type dat in de titel staat
  (een Z900RS wordt met Z900RS vergeleken, niet met de Z900). Spelfouten in
  letters mogen ("V-storm", "Versis"), cijfers moeten exact kloppen. Staat de
  cilinderinhoud er niet in (bv. alleen "V-Strom"), dan geen advies.
- **Vergelijkbaar**: zelfde bouwjaar of 1 ouder, max. 10.000 km verschil;
  minder dan 3 → ook 1 jaar jonger. Overgeslagen: nieuw/0 km, prijs op
  aanvraag, BTW-motoren.
- **Verkoopdoel** = gemiddelde van de max. 3 goedkoopste vergelijkbare
  (`prijzen.py`). Het openingsbod, max en de kleurcode rekent de app uit.
- Elke 3 dagen opnieuw bepaald; max. `RADAR_MO_MAX` (40) verzoeken per run.

Testen zonder iets op te slaan: Run workflow → modus **diagnose** met een
model/bouwjaar/km. De log toont de gebruikte URL, de advertenties, het
verkoopdoel, en wat de job voor de huidige populaire leads zou berekenen.
Lokale tests (zonder netwerk): `python test_prijzen.py`, `python test_motoroccasion.py`,
`python test_mapping.py`.

Direct prijzen laten berekenen (bv. na het toevoegen van een populair model):
Run workflow → modus **alleen-prijzen**. Haalt geen nieuwe advertenties op,
ruimt niets op en stuurt geen mail.

## Eenmalige setup

### 1. Repo-secrets (Settings → Secrets and variables → Actions → **Secrets**)

| Secret | Waarde |
|---|---|
| `SUPABASE_URL` | `https://xftnovnldcdfohqlqgor.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | de **service-role** key (Supabase → Project Settings → API). **Nooit** in de frontend of git. |
| `RESEND_API_KEY` | Resend API-key |
| `DIGEST_FROM` | afzender, bv. `Inkoop-radar <radar@dejongemotoren.nl>` (geverifieerd domein in Resend) |
| `DIGEST_TO` | ontvanger(s), komma-gescheiden bij meerdere |

### 2. Repo-variables (zelfde scherm → **Variables**) — optioneel, hebben defaults

| Variable | Default | Uitleg |
|---|---|---|
| `RADAR_KEYWORD` | *(leeg)* | extra zoekterm binnen categorie Motoren |
| `RADAR_PRICE_MIN` | `0` | minimumprijs (€) |
| `RADAR_PRICE_MAX` | `8000` | maximumprijs (€) |
| `RADAR_MAX_ITEMS` | `150` | max. advertenties per run |
| `RADAR_L1_CATEGORY` | `678` | categorie-id Motoren |
| `RADAR_SEARCH_URL` | `https://www.2dehands.be/lrp/api/search` | zoek-API |
| `RADAR_BRON` | `2dehands` | label in de leads |
| `RADAR_MO_MAX` | `40` | max. Motoroccasion-zoekverzoeken per run |

### 3. Testen

Actions → **Inkoop-radar** → **Run workflow**. Vul eventueel een keyword /
max-aantal in. Bekijk de log: hij toont per stap hoeveel listings zijn
opgehaald, gemapt en nieuw waren, plus de categorie-refinements van de API.

## Onderhoud

De zoek-API is ongedocumenteerd en kan wijzigen. Het script is defensief:
als een run wél HTTP 200 geeft maar 0 advertenties kan mappen, zet het een
waarschuwing in `inkoop_radar_status` die de app bovenaan de inkoop-pagina
toont. Zie dan de Actions-log (de refinement-regels helpen om de juiste
categorie/subcategorie-id's opnieuw te bepalen).

De filters (dealer-signalen, onderdelen-woorden, verkopertype-detectie) staan
als aanpasbare constanten bovenin `fetch_leads.py`.
