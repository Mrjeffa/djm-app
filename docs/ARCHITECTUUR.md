# De Jonge Motoren — architectuur van de app

Dit document beschrijft hoe de app in elkaar zit: onderdelen, tabbladen, datastromen, database,
achtergrondtaken en de koppeling met de website. Bedoeld voor een ontwikkelaar die de app overneemt
of uitbreidt. Stand: 26 november 2026.

---

## 1. Overzicht

Eén Supabase-database wordt gedeeld door drie "voorkanten" en een paar achtergrondtaken:

```mermaid
flowchart LR
  subgraph Gebruikers
    K[Klant<br/>telefoon/browser]
    A[Beheerder<br/>De Jonge Motoren]
    B[Bezoeker website]
  end

  subgraph CF[Cloudflare Pages]
    APP[djm-app<br/>React-PWA]
    WEB[djm-website<br/>Next.js]
  end

  subgraph SB[Supabase  xftnovnldcdfohqlqgor]
    AUTH[Auth<br/>inloggen]
    DB[(Postgres + RLS)]
    RT[Realtime]
    EF[Edge functions]
  end

  K --> APP
  A --> APP
  B --> WEB
  APP <--> AUTH
  APP <--> DB
  APP <-- live --> RT
  APP --> EF
  WEB -->|lezen voorraad, producten, instellingen<br/>RPC maak_afspraak / maak_inkoop_lead| DB
  DB -->|triggers via pg_net| EF
  EF -->|web push| A
  GH[GitHub Actions<br/>inkoop-radar, prijscheck,<br/>beveiligingstest] --> DB
  GH --> EF
  APP --> CLD[Cloudinary<br/>foto's]
  WEB --> CLD
```

| Onderdeel | Repo / plek | Wat |
|---|---|---|
| **App** (dit repo) | `Mrjeffa/djm-app` → Cloudflare Pages | Klantportaal én beheer-app in één PWA. |
| **Website** | `Mrjeffa/djm-website` → Cloudflare Pages (`www.dejongemotoren.nl`) | Publieke site: occasions, werkplaats, formulieren. Zie §11. |
| **Database** | Supabase-project `xftnovnldcdfohqlqgor` (Free plan, regio eu-west-3) | Postgres met Row Level Security, Auth, Realtime, edge functions. |
| **Achtergrondtaken** | `.github/workflows/` + `inkoop-radar/` (Python) | Inkoop-radar (dagelijks), voorraad-prijscheck (wekelijks), beveiligingstest. |
| **Foto's** | Cloudinary (cloud `dkfdwnep4`, preset `Djm app`) | Upload vanuit de app, tonen met transformaties (`/upload/c_scale,w_…/`). |

## 2. Techniek

- **Frontend:** React 18, Vite 6, geen router (navigatie via state), inline styles met een
  thema-object `T` (licht/donker). Geen TypeScript in `src/` (wel in `supabase/functions/`).
- **Backend:** Supabase JS v2 met de publieke anon key (`src/lib/supabase.js`). Alle rechten
  worden in de database afgedwongen met RLS — de frontend is nooit de beveiliging.
- **Hosting:** Cloudflare Pages bouwt `main` (`npm run build` → `dist/`). `public/_redirects`
  stuurt alle routes naar `index.html`; `public/_headers` zet CSP, HSTS e.d. en caching.
  **Vast adres: `https://djm-app.pages.dev`** (`src/lib/appAdres.js`). Cloudflare geeft elke
  deploy ook een eigen adres (`<hash>.djm-app.pages.dev`) en elke branch een testadres; die
  blijven altijd op die ene versie staan en krijgen dus nooit updates. Op zo'n adres toont
  `VerkeerdAdres.jsx` een waarschuwing met een knop naar het vaste adres, en links in e-mails
  (uitnodiging, wachtwoord vergeten) gaan altijd naar het vaste adres (`appOrigin()`).
- **PWA:** `public/manifest.webmanifest`, `public/sw.js`, iconen in `public/icons/`.

## 3. Mappenstructuur

```
djm-app/
├─ index.html                 # HTML-schil, fonts, manifest/iconen, theme-color
├─ public/
│  ├─ _headers                # Cloudflare: CSP, HSTS, caching (sw.js/manifest no-cache)
│  ├─ _redirects              # SPA: alles → index.html
│  ├─ manifest.webmanifest    # PWA-manifest
│  ├─ sw.js                   # service worker: cache eigen bestanden, pushmeldingen
│  ├─ factuur-sjabloon.xlsx   # factuursjabloon van de zaak (zonder klantgegevens), zie §5
│  ├─ icons/                  # app-iconen, badge, favicons
│  ├─ larsson_voertuigen.json # opzoektabel onderdelen (Larsson), lazy geladen
│  └─ autoscout-djm.user.js   # Tampermonkey-script dat het AutoScout-formulier invult
├─ src/
│  ├─ main.jsx                # React-start + import van lib/pwa.js
│  ├─ App.jsx                 # sessie, rol bepalen, lazy laden Admin/Klant, foutvangnet
│  ├─ components/
│  │  ├─ AdminApp.jsx         # beheer-app (alle pagina's en modals, ~5.800 regels)
│  │  ├─ KlantApp.jsx         # klantportaal (~2.700 regels)
│  │  ├─ LoginScreen.jsx      # inloggen, registreren, wachtwoord vergeten
│  │  ├─ WachtwoordInstellen.jsx # na reset-link
│  │  ├─ Juridisch.jsx        # privacybeleid, voorwaarden, cookiebanner
│  │  ├─ AppInstalleren.jsx   # kader "App installeren" (klantportaal)
│  │  ├─ PushInstellingen.jsx # pushmeldingen aan/uit (admin)
│  │  ├─ WebsiteBeheer.jsx    # "Website aanpassen" (admin, apart geladen): zie §5b
│  │  ├─ UpdateMelding.jsx    # melding "Nieuwe versie beschikbaar" (iedereen)
│  │  └─ AppVersie.jsx        # Instellingen → App-versie: bouwdatum + "Zoeken naar update"
│  └─ lib/
│     ├─ supabase.js          # Supabase-client + uitloggen/uitnodiging
│     ├─ foto.js              # foto's verkleinen + uploaden naar Cloudinary
│     ├─ kmstand.js           # km ↔ mijl (opslag altijd km)
│     ├─ getal.js             # Nederlandse bedragen/getallen parsen (naarBedrag)
│     ├─ pwa.js               # service worker registreren, installatievraag
│     ├─ push.js              # pushabonnement aan/uit, testmelding
│     ├─ larsson.js           # onderdelen-link zoeken (Larsson)
│     ├─ autoscout.js         # gegevens klaarzetten voor AutoScout24
│     ├─ website.js           # website-beheer: paden, controles, codes, slug, markdown-hulp
│     ├─ versie.js            # nieuwe versie online? (melding "Nieuwe versie beschikbaar")
│     ├─ appAdres.js          # vast adres van de app, herkent deploy-adressen
│     ├─ onderhoudslijst.js   # onderhoudslijst: sjabloon, opbouwen, voortgang, samenvatting
│     ├─ factuur.js           # factuur: regels, prijzen, prijslijst lezen, Excel vullen
│     └─ laden.js             # lazy laden met één keer herladen na een update
├─ supabase/
│  ├─ functions/              # edge functions (Deno): zie §9
│  ├─ *.sql                   # migraties/stand van zaken per onderwerp (zie §8.5)
│  └─ *-test.sql              # SQL-tests die alles terugdraaien (RLS, dagcapaciteit, website)
├─ inkoop-radar/              # Python: inkoop-radar, voorraad-prijscheck, diagnose, tests
├─ scripts/beveiligingstest.py # buitenstaander-test (draait in GitHub Actions)
├─ .github/workflows/         # build, beveiligingstest, inkoop-radar, voorraad-prijscheck
└─ docs/ARCHITECTUUR.md       # dit document
```

## 4. Opstart, inloggen en rollen

```
main.jsx → lib/pwa.js (service worker + installatievraag opvangen)
        → App.jsx
           ├─ #type=recovery in URL?  → WachtwoordInstellen
           ├─ geen sessie              → LoginScreen
           ├─ sessie + admin           → AdminApp   (lazy geladen chunk)
           └─ sessie + klant           → KlantApp   (lazy geladen chunk)
```

- **Sessie:** Supabase bewaart de sessie in `localStorage` (`persistSession`), ververst de
  token zelf. In de geïnstalleerde app op iOS is de opslag gescheiden van Safari: één keer
  inloggen in de app.
- **Rol:** `checkIsAdmin()` leest `admins` (RLS: alleen de eigen rij). Een hint wordt in
  `sessionStorage` (`djm_admin_v1`) bewaard zodat herladen geen laadscherm geeft. Die hint
  bepaalt alleen welk scherm je ziet; wat je mag lezen/schrijven bepaalt de database.
- **Klant koppelen** (`koppelKlant`, alleen voor niet-admins): zoekt een `klanten`-rij op e-mail;
  bestaat die zonder account, dan wordt `user_id` gezet; anders wordt er een aangemaakt.
  Bij registratie maakt de database-trigger `handle_new_auth_user` die rij meestal al aan,
  mét naam, telefoon, adres en woonplaats uit het aanmeldformulier. Het klantportaal zelf
  koppelt niet meer (dat gebeurde eerder dubbel).
- **Sessie-events:** `verwerkSessie` draait één keer per gebruiker. Een herhaalde `SIGNED_IN`
  (bv. bij terugkeren naar het tabblad) of `TOKEN_REFRESHED` laadt de app niet opnieuw; de
  admin-controle wordt hooguit elke 10 minuten herhaald.
- **Na een update:** lazy chunks die niet meer bestaan → één keer automatisch herladen
  (`laadMetHerstel` in `App.jsx`).
- **Foutvangnet:** een onverwachte React-fout toont een nette "Herlaad de app"-pagina.
- **Uitloggen** (`uitloggen()` in `lib/supabase.js`): meldt eerst de pushmeldingen van dit
  apparaat af (hooguit 3 s wachten), dan `signOut`. Zo krijgt een gedeeld apparaat geen
  beheerdersmeldingen meer.
- **Middernacht:** `TODAY` (module-variabele in AdminApp/KlantApp) wordt bijgewerkt als de app
  over middernacht open blijft (bij zichtbaar worden en elke 5 minuten).

## 5. Beheer-app (`AdminApp.jsx`)

Navigatie: state `page` (zijbalk op desktop, onderbalk op mobiel). Diepe link: `/?pagina=agenda`
(gebruikt door pushmeldingen; de service worker stuurt ook een `open-pagina`-bericht als de app
al open staat). Geldige pagina's staan in `ADMIN_PAGINAS`.

| Tabblad (`page`) | Component | Wat je er doet | Belangrijkste tabellen |
|---|---|---|---|
| `dashboard` | `Dashboard` | Overzicht van vandaag/deze week, openstaande aanvragen, klussen, taken | afspraken, klussen, taken |
| `klanten` | `KlantenPage` → `KlantDetail` | Klanten goedkeuren/afwijzen/archiveren, motoren, km, onderhoud, afspraak inplannen, uitnodigen | klanten, motoren, km_historie, service_beurten, afspraken |
| `voorraad` | `VoorraadPage` | Voorraadmotoren (foto's, km/mijl, interne opmerking, inkoopprijs, chassis), verkopen aan klant, terugkopen, proefrit, prijscheck, producten/onderdelen | voorraad (+ voorraad_intern/inkoop/chassis/prijscheck/service), producten |
| `agenda` | `AgendaPage` | Dag/week-agenda, afspraken plannen/wijzigen/afwerken/herhalen, klussen in fases, proefritten | afspraken (+ afspraken_intern), klussen, service_beurten |
| `inkoop` | `InkoopRadarPage` | Leads van 2dehands met inkoopadvies (Motoroccasion), populaire modellen | inkoop_leads, inkoop_radar_status, inkoop_populair |
| `website` | `WebsiteBeheer` (via Instellingen → "Website aanpassen") | Teksten, foto's, FAQ, blog, Google-teksten en eigen dienst-/infopagina's van de website, zie §5b | website_blokken, website_faq, blog_posts, website_paginas (+ historie) |
| `instellingen` | `InstellingenPage` | Knop "Website aanpassen", pushmeldingen, bericht aan klanten, openingstijden, afspraken per dag, gesloten periodes, tarieven, afspraaksoorten, medewerkers, kleurcategorieën, inkoop-radar, import/export (xlsx) | instellingen, push_abonnementen |

**Belangrijke modals:** `AfspraakModal` (nieuwe afspraak: bestaande klant / nieuwe klant / intern,
soorten, medewerkers, kleurcategorie, herhalen, klus-fases), `AfspraakEditModal`, `AfwerkModal`
(afwerken + onderhoud registreren + interne opmerking), `ProefritModal`, `VoorraadModal` /
`VoorraadEditModal`, `KlantModal`, `MotorModal`, `ServiceModal`, `ProductModal`, `UitnodigingModal`.

**Data laden** (`laadAlles` in de hoofdcomponent, één keer bij openen, alles in **één ronde**
tegelijk met `Promise.all`):
- klanten, voorraad (actief + 30 dagen na verkoop), afspraken (vanaf 12 maanden terug, met
  `AFSPRAAK_VELDEN` = klantnaam, motor en `afspraken_intern(opmerking)`), producten,
  voorraad_service, klussen, voorraad_chassis/inkoop/prijscheck/intern, inkoop_leads (500),
  radarstatus, populaire modellen, instellingen, en motoren + km_historie + service_beurten
  van alle klanten (incl. banddatums).
- Samengevoegd per klant/motor met `groepeer()` (Map) en `Map`-opzoekingen, niet met herhaald
  filteren. Servicehistorie in de beheer-app: nieuwste eerst.
- Tabellen die meegroeien worden per 1000 rijen opgehaald met `alleRijen()` (Supabase geeft
  max. 1000 rijen per verzoek).
- Opruimen op de achtergrond (`ruimVerlopenOp`): verlopen voorraad/producten 30 dagen na
  verkoop. In een paar verzoeken voor alle motoren samen: servicehistorie naar de klantmotor
  kopiëren, rijen verwijderen, en pas daarna de foto's via `cloudinary-delete`.
- Ophalen dat mislukt (bv. inkoop herladen zonder netwerk) laat de bestaande lijst staan.

**Live bijwerken (Realtime):** kanaal `admin-afspraken` (INSERT/UPDATE/DELETE op afspraken) en
`admin-klanten` (nieuwe/gewijzigde klanten). Realtime past RLS toe. Wat de app zelf net heeft
opgeslagen en ook via realtime binnenkomt, wordt op `id` ontdubbeld (afspraken, herhalingen,
nieuwe klant). Kanalen worden bij sluiten met `removeChannel` opgeruimd.

**Verkoop, inruil en terugkopen** (pagina Voorraad / klantdetail):
- *Verkopen aan klant* (`verkoop`): voorraad → `verkocht` (+ `verkocht_aan`, foto's 30 dagen
  bewaard), nieuwe klantmotor met `source_voorraad_id`, servicehistorie gekopieerd naar
  `service_beurten`. Mislukt de eerste stap, dan verandert er niets.
- *Verkoopproces* (`VerkoopProces`): altijd dezelfde stappen — klant + extra's kiezen en
  verkopen, dan de afspraak "Motor klaarmaken", dan "Afhalen / afleveren". Start vanuit
  Voorraad → Verkopen, vanuit een bestaande klant (+ Motor → "Uit voorraad", `MotorModal`; klant
  staat vast), of vanuit Klant toevoegen met "Uit voorraad": dan wordt eerst de klant
  opgeslagen (`addKlant`, geeft `{fout, klant}`), loopt het verkoopproces met die klant vast
  gekozen, en volgt daarna de uitnodiging voor het klantportaal. Breek je de verkoop af, dan
  staat de klant er zonder motor en verkoop je later via Voorraad.
- *Extra's bij verkoop*: de lijst (Afleverpakket, Garantiepakket, Slot, …) staat in
  `instellingen.verkoop_extras` en is aan te passen in Instellingen → Extra's bij verkoop
  (toevoegen, verwijderen, volgorde; direct opgeslagen). In het voorraadformulier vink je per
  motor uit wat hij al heeft; dat komt in `voorraad.extras_niet_aanbieden` (wat níet wordt
  aangeboden, zodat een later toegevoegde extra bij bestaande motoren gewoon wordt aangeboden).
  In "Motor verkopen" staan alleen de aangeboden extra's als vinkjes, plus een vrij veld
  "Overige extra's". De keuze gaat naar `motor_verkoop_extras` (per klantmotor, alleen admin;
  de voorraadregel verdwijnt na 30 dagen) en wordt vooraf ingevuld in de opmerkingen van de
  afspraak "Motor klaarmaken". Bij de klant staat de regel "Extra's bij aankoop" op de
  motorkaart; aan te passen via de motor → Wijzigen (alles leeg = regel weg).
- *Inruilen* (`inruilMotorVanKlant`): nieuwe voorraadmotor (hoogste km-stand, `km_eenheid` km),
  servicehistorie naar `voorraad_service` (`kopieerServiceNaarVoorraad`), pas dan de klantmotor
  verwijderen. Mislukt de voorraadmotor of het kopiëren, dan blijft de klantmotor staan.
- *Terugkopen* (`terugkopenMotor`): zoekt de klantmotor via `source_voorraad_id` (niet op
  kenteken), kopieert de service uit de klanttijd terug naar `voorraad_service`, zet de
  voorraad weer op beschikbaar en verwijdert de klantmotor.

**Onderhoudslijst** (afspraak openen → Onderhoudslijst; niet bij proefritten en interne
afspraken zonder motor): naar het papieren formulier van de werkplaats. Werkzaamheden uit de
afspraak (soort) + zelf toegevoegde, controlepunten met oké / advies / vervangen / n.v.t. (plus
toelichting), groot onderhoud (uitgevoerd + type), km-stand en opmerkingen. Elke wijziging wordt
na 0,7 s opgeslagen in `onderhoudslijsten` (en direct bij sluiten, wegklikken of weer online);
zolang dat niet lukt staat een reservekopie in `localStorage` die bij openen voorgaat als hij
nieuwer is. Kan de lijst niet geladen worden, dan is hij niet te bewerken (anders zou een lege
lijst de echte overschrijven). Het sjabloon staat in `instellingen.onderhoudslijst` (Instellingen →
Onderhoudslijst) en komt via `OnderhoudSjabloonContext`. Ingevulde punten worden met hun naam
bewaard: een aangepast sjabloon voegt punten toe of laat lege punten weg, maar ingevulde blijven.
Bij **Afwerken** worden "Uitgevoerde werkzaamheden" en de km-stand uit de lijst ingevuld
(`samenvatting()` in `lib/onderhoudslijst.js`).

**Factuur (Excel)** (afspraak openen → Factuur maken; `FactuurModal`, logica in `lib/factuur.js`):
- Regels uit de onderhoudslijst (`factuurRegels`), op volgorde: uitgevoerde werkzaamheden, groot
  onderhoud met type, **materiaal** (controlepunten uit `sjabloon.materiaal` bij Oké of Vervangen,
  met de factuurtekst + toelichting; dezelfde tekst één keer, en niet als het al bij groot
  onderhoud staat), overige vervangen onderdelen met toelichting, de **vaste regels**
  (`sjabloon.factuur_standaard`, standaard "Klein materiaal, milieu-afvalkosten" en "Arbeid";
  "Arbeid…" krijgt als aantal de duur van de afspraak) en adviespunten als tekstregel. Niet
  ingevuld: de werkzaamheden uit de afspraak + de vaste regels. Te controleren en aan te vullen
  (max 26 regels). Materiaalpunten en vaste regels staan in het sjabloon van de onderhoudslijst
  (`instellingen.onderhoudslijst`) en zijn in Instellingen aan te passen.
- Prijzen ex btw uit de `prijslijst`: eerst op artikelcode in type/toelichting (woorden met een
  cijfer, bv. HF303 → artikelnummer, JM-nummer of in de omschrijving), dan op exact dezelfde
  omschrijving, dan op de naam zonder type ("Olie" bij "Olie 10W40"). Leeg = in Excel invullen.
- Factuurnummer: `beheer_instellingen.laatste_factuurnummer` + 1, per factuur aan te passen;
  na downloaden wordt het laatste nummer bijgewerkt (als het hoger is) en komt
  `{nummer, datum}` in `lijst.factuur` van de afspraak (opnieuw downloaden = zelfde nummer).
  In Instellingen → Facturen en prijslijst is het laatste nummer handmatig te zetten.
- Het bestand: `public/factuur-sjabloon.xlsx` (de Standaardfactuur van de zaak, zonder
  klantgegevens en zonder bewaarde formule-uitkomsten). `maakFactuur()` past alleen celwaarden
  aan in het werkblad-XML (zip via `xlsx`.CFB), zodat opmaak, formules, keuzelijsten en het
  afdrukbereik (A–G, briefpapier) blijven. Bij elke formule zet `formuleUitkomsten()` de juiste
  uitkomst (labels, regeltotalen, btw, totaal, controle), zodat het bestand ook klopt in de
  beveiligde weergave van Excel en in voorbeeldweergaven, die niet zelf rekenen; bij bewerken
  rekent Excel opnieuw (`fullCalcOnLoad`). Km in mijlen: label "Mijlenstand:". Tekstregels
  (zonder aantal en prijs) krijgen een lege kortingscel, zodat lange tekst doorloopt.
  Facturen worden niet in de app bewaard; de zaak slaat het bestand op de computer op.
- Prijslijst: Instellingen → downloaden als Excel (JM-Nr., Omschrijving, Fabrikant artikel
  nummer, Inkoopprijs ex btw, Verkoopprijs ex btw; prijzen per stuk/dienst/uur, in dezelfde
  volgorde als de eerste kolommen van een Larsson-bestelling), aanvullen, uploaden. `leesPrijslijst()` zoekt de kopregel en slaat "voertuig:"- en totaalregels over;
  uploaden vervangt de hele lijst in één transactie (`vervang_prijslijst`).

**Foutafhandeling:** opslaan in de beheer-app controleert de `error` van Supabase en toont een
melding (klant toevoegen, uitnodigen, voorraad toevoegen/wijzigen, verkoop, afwerken,
instellingen, gesloten dagen). Een mislukte voorraadwijziging gooit geen foto's weg; net
geüploade foto's van een mislukte opslag worden opgeruimd.

**Gevoelige gegevens staan apart** (omdat `voorraad` en `afspraken` voor anderen leesbaar zijn):
`voorraad_inkoop` (inkoopprijs), `voorraad_chassis`, `voorraad_intern` (interne opmerking),
`afspraken_intern` (interne opmerking bij afspraak), `motor_verkoop_extras` (extra's bij
aankoop; klanten mogen hun eigen motor wijzigen, dit niet). Alleen admin (RLS).

## 5a. Hoe de tabbladen samenhangen

Tabbladen praten niet rechtstreeks met elkaar: ze delen de **database**. Wat het ene tabblad
opslaat, verschijnt in het andere (en in het klantportaal en op de website) via dezelfde
tabellen. Doorlinks binnen de app zijn er maar een paar.

```mermaid
flowchart TB
  subgraph Beheer[Beheer-app]
    DASH[Dashboard]
    KL[Klanten<br/>klanten · meldingen · archief]
    VR[Voorraad]
    AG[Agenda]
    INK[Inkoop]
    INST[Instellingen]
  end
  subgraph Portaal[Klantportaal]
    PM[Motor]
    PS[Service]
    PK[Km Stand]
    PV[Voorraad]
    PC[Contact]
    PI[Instellingen]
  end
  WEB[Website]

  DASH -- "+ Nieuw / sessie toevoegen" --> AG
  VR -- "verkopen: klantmotor + service" --> KL
  KL -- "inruilen: motor + service" --> VR
  VR -- "proefrit" --> AG
  AG -- "afwerken: servicebeurt, km, banden" --> KL
  INST -- "openingstijden, gesloten dagen, max/dag, soorten, opmerking" --> AG
  INST --> PS
  INST --> WEB
  VR -- "beschikbaar/gereserveerd, foto's, prijs" --> PV
  VR --> WEB
  KL -- "motor, onderhoud, km" --> PM
  PS -- "aanvraag (aangevraagd) + push" --> AG
  PC -- "dienstaanvraag zonder dag" --> AG
  PV -- "proefritaanvraag" --> AG
  PV -- "Neem contact op" --> PC
  PM -- "Motor toevoegen" --> PI
  PM -- "eigen onderhoud (melding)" --> KL
  PK -- "km-stand" --> KL
  PI -- "motor toevoegen (push)" --> KL
  WEB -- "maak_afspraak" --> AG
  WEB -- "maak_inkoop_lead" --> INK
```

| Van | Naar | Via | Hoe |
|---|---|---|---|
| Dashboard | Agenda | `onNav("agenda")` | knop "+ Nieuw" en "sessie toevoegen" bij een klus |
| Klanten → Meldingen/Archief | Klantdetail | `setSel(id)` + `setPageTab("klanten")` | tik op een melding of gearchiveerde klant |
| Pushmelding | elke pagina | `/?pagina=…` of `open-pagina`-bericht van de service worker | `ADMIN_PAGINAS` |
| Portaal Voorraad | Portaal Contact | `onNaarContact` | "Neem contact op" bij een motor/product |
| Portaal Motor | Portaal Instellingen | `onNaarInstellingen` | "Motor toevoegen" (opent het formulier) |
| Agenda (afwerken) | Klanten / portaal Motor | `service_beurten`, `km_historie`, `motoren` | servicebeurt + km + banden bij de klantmotor |
| Voorraad (verkopen) | Klanten / portaal Motor | `motoren` (`source_voorraad_id`), `service_beurten`, `motor_verkoop_extras` | klant krijgt de motor met servicehistorie; gekozen extra's staan bij de klantmotor (alleen beheerder) |
| Portaal Service/Contact/Voorraad | Agenda + Dashboard | `afspraken` (`status = aangevraagd`) | realtime + pushmelding |
| Instellingen | Agenda, portaal, website | `instellingen` (één rij) | openingstijden, gesloten dagen, max per dag, soorten, tarieven, opmerking |

## 5b. Website aanpassen (`WebsiteBeheer.jsx`)

Beheer van de inhoud van www.dejongemotoren.nl zonder developer. Uitgangspunt: **vaste velden per
pagina, geen vrije paginabouwer** (werkplan "Website aanpassen in de DJM-app", fase 1 t/m 5).
Ingang: Instellingen → "Website aanpassen" (`page = "website"`, ook `/?pagina=website`).

| Scherm | Tabel | Wat |
|---|---|---|
| Startscherm | alle | Tegels per pagina + FAQ, Blog, Google-teksten, Dienst- en infopagina's, met "laatst gewijzigd" |
| Pagina-editor (Home, Occasions, Werkplaats, Winterstalling, Motor verkopen, Proefrit, Over ons, Contact, Algemeen) | `website_blokken` (`pagina = …`) | Velden per sectie, volledig gestuurd door de data (`type`, `label`, `opties`). Alleen gewijzigde velden worden opgeslagen. Per veld: "Vorige versies" (`website_blokken_historie`) en "Standaard herstellen" (`standaard`). |
| Google-teksten | `website_blokken` (`pagina = 'seo'`) | Titel (max 45) en omschrijving (120–160) per pagina, met Google-voorbeeld. Leeg = website gebruikt de huidige tekst. |
| Veelgestelde vragen | `website_faq` | 4 groepen (Kopen, Verkopen, Werkplaats, Langskomen); vraag, antwoord, interne link, tonen ja/nee, volgorde (↑↓) |
| Blog | `blog_posts` | Lijst + editor: titel, slug (automatisch uit titel), korte beschrijving (= Google), categorie, afbeelding, inhoud (markdown-subset met werkbalk en voorbeeld), concept/gepubliceerd. Slug van een gepubliceerd artikel wijzigen → oude slug in `oude_slugs` (website verwijst door). |
| Dienst- en infopagina's | `website_paginas` (+ `_historie`) | Sjabloon Dienst (`/werkplaats/<slug>`) of Info (`/info/<slug>`); prijs, duur, afspraaksoort, FAQ (max 8), Google-teksten, in menu, volgorde, vorige versies. Bij publiceren waarschuwingen (te kort, geen prijs, lijkt op een andere pagina). |

**Veldtypes** (`website_blokken.type`): `tekst` (één regel, `opties.max`), `tekst_lang` (alinea's,
`**vet**`, `[tekst](/pad)`), `afbeelding` (`{url, alt, breedte, hoogte}`; upload naar Cloudinary
via `uploadAfbeelding` in `lib/foto.js`, alt-tekst 10–125 tekens verplicht), `lijst` (items met
`opties.velden`, `min_items`/`max_items`).

**Codes** die de website bij elk bezoek invult: `{jaren}`, `{telefoon}`, `{whatsapp}`,
`{tarief:<sleutel uit instellingen.diensten_tarieven>}`. Onder een tekstveld staan ze als knopjes
om in te voegen; een onbekende code blokkeert het opslaan.

**Veiligheid:** schrijven alleen met de ingelogde admin-sessie (RLS `is_admin()`), geen
service-role in de app. De database weigert bovendien `javascript:`/`data:`-links, afbeeldingen
zonder https en FAQ-links naar een ander domein (`//…`). Een RLS-weigering geeft geen fout maar
0 rijen: de editor controleert dat en meldt "Niet opgeslagen".

**Niet opgeslagen wijzigingen:** waarschuwing bij teruggaan, bij een ander tabblad in de app
(`zetVerlaatGuard` in AdminApp) en bij sluiten/verversen van de browser.

**Contract met de website:** de sleutels in `website_blokken` (bv. `home.hero.titel1`). Niet
hernoemen of verwijderen; toevoegen kan, maar de website toont een nieuwe sleutel pas als die
hem gebruikt. Zie §11 voor hoe de website de velden leest.

## 6. Klantportaal (`KlantApp.jsx`)

Navigatie: state `tab` (onderbalk; instellingen via het tandwiel).

| Tab | Component | Wat de klant doet | Tabellen / functies |
|---|---|---|---|
| `motor` | `MijnMotor` | Eigen motor(en), onderhoudsstatus, servicegeschiedenis | motoren, service_beurten, km_historie |
| `service` | `ServiceTab` → `Afspraak` | Afspraak aanvragen (dagkeuze met volle dagen), eigen onderhoud invoeren, eigen afspraken zien | afspraken, service_beurten, rpc `get_bezette_dagen` |
| `km` | `KmStand` | Km-stand doorgeven | km_historie |
| `voorraad` | `VoorraadTab` | Occasions en onderdelen bekijken, proefrit aanvragen | rpc `voorraad_overzicht` (te koop + 30 dagen verkocht), producten, afspraken |
| `contact` | `Contact` | Diensten aanvragen: schade, consignatie, aankoopkeuring, zoekopdracht, winterstalling, seizoensklaarmaak (met foto's) | afspraken (`dag_gekozen=false` zonder datum) |
| `instellingen` | `Instellingen` | App installeren, gegevens, wachtwoord, motoren toevoegen/verwijderen, thema, gegevens downloaden, account verwijderen | klanten, motoren, rpc `verwijder_eigen_account` |

**Toegang per status** (`klanten.status`): alleen `goedgekeurd` komt in het portaal.
`in_afwachting` → "Account wordt beoordeeld", `afgewezen` → "niet goedgekeurd",
`gearchiveerd` of iets anders → "Account niet actief". Geen klantrecord → "Wacht op
goedkeuring". Lukt het laden niet (netwerk) → "Laden mislukt" met knop "Opnieuw proberen"
(voorheen leek dat op "wacht op goedkeuring").

**Data laden** (drie rondes, binnen een ronde alles tegelijk):
1. klantrecord (`user_id`, `maybeSingle`), volle dagen (rpc), instellingen, voorraad (rpc
   `voorraad_overzicht`: geen klantnummer, geen kenteken van verkochte motoren), producten;
2. alleen als goedgekeurd: eigen afspraken + motoren (zonder `klant_verwijderd_op`);
3. km_historie + service_beurten van die motoren (oplopend; schermen nemen het laatste element
   als "laatste service"). De huidige km-stand is de **hoogste** stand (`hoogsteKm`).

Volle dagen worden bij het wisselen naar service/contact/voorraad hooguit eens per minuut
opnieuw opgehaald, en altijd na een eigen aanvraag of een "dag vol"-weigering. Live: kanaal
`klant-afspraken-<klant-id>` (UPDATE/INSERT gefilterd op `klant_id`; DELETE alleen op id).
`localStorage`/`sessionStorage` gaan via `leesOpslag`/`schrijfOpslag` (werkt ook als opslag
geblokkeerd is, zoals in een privévenster).

**Regels die de database bewaakt** (de app toont ze alleen):
- Een klant ziet/wijzigt alleen eigen gegevens; status, e-mail en koppeling kan alleen de
  beheerder wijzigen (trigger `bewaak_klanten_mutaties`).
- Nieuwe afspraak van een klant krijgt altijd status `aangevraagd`; daarna mag de klant alleen
  `melding_gezien` wijzigen (trigger `bewaak_afspraken_mutaties`).
- Max. afspraken per dag (trigger `afspraken_dagcapaciteit`, zie §8.3).
- Motor verwijderen: zonder garage-historie echt weg, anders alleen verborgen
  (`motoren.klant_verwijderd_op`, policy `klant_motoren_verwijderen`).

## 7. PWA en pushmeldingen

- **Service worker** (`public/sw.js`, cache `djm-v2`): cachet alleen eigen bestanden.
  Navigatie network-first met offline-fallback (alleen een echte HTML-pagina wordt als `/`
  bewaard); `/assets/*` cache-first (hash in de naam); `/icons/*` uit de cache en op de
  achtergrond ververst. Supabase/Cloudinary/RDW nooit. Toont pushmeldingen en opent bij een
  tik de juiste pagina.
- **Updates:** een app op het beginscherm (of een tabblad dat open blijft) laadt een nieuwe
  versie pas bij een echte herstart. `lib/versie.js` vergelijkt daarom het hoofdbestand van de
  online versie (`index.html` → `/assets/index-<hash>.js`) met wat er draait: bij het openen, bij
  terugkeren naar de app (hooguit eens per minuut), bij weer online komen en elke 30 minuten.
  Is er een nieuwe versie, dan toont `components/UpdateMelding.jsx` (op elk scherm, ook voor
  klanten en op het inlogscherm) "Nieuwe versie beschikbaar" met **Vernieuwen** (herladen; de
  service worker haalt pagina's eerst van het netwerk, dus dat laadt de nieuwe versie) en
  **Later**. Bewust geen automatisch herladen: dan zou een half ingevuld formulier verloren gaan.
  Ook bij `pageshow` (iPhone haalt de app bevroren uit de achtergrond) wordt gecontroleerd.
  Opent de app vers, dan draait hij al de nieuwste versie en komt er dus geen melding.
- **App-versie:** `vite.config.js` bakt de bouwdatum en commit (`CF_PAGES_COMMIT_SHA`) in de app
  (`__APP_VERSIE__`). Instellingen → App-versie (beheer en klantportaal) toont die plus het adres
  (rood bij een deploy-adres) en heeft
  "Zoeken naar update" (`zoekUpdate()`; bij een nieuwe versie verschijnt ook de melding).
- **Installeren:** `lib/pwa.js` vangt `beforeinstallprompt` op; `AppInstalleren.jsx` toont de
  knop (Android) of de iPhone-uitleg.
- **Push (alleen beheerder):** `PushInstellingen.jsx` → `lib/push.js` meldt het apparaat aan
  (`push_abonnementen`; lukt het opslaan niet, dan wordt de browser-aanmelding teruggedraaid). De database stuurt bij gebeurtenissen via `pg_net` een verzoek naar de
  edge function `push-melding`, die de melding opbouwt uit de database en verstuurt.
  Gebeurtenissen: nieuwe afspraak/aanvraag (status `aangevraagd`), inkoop-aanvraag, inkoop-radar
  (één per run), nieuwe klant (na e-mailbevestiging), klant voegt motor/onderhoud toe, klant
  verwijdert account. Eigen acties van de beheerder geven geen melding. Op iPhone alleen in de
  geïnstalleerde app (iOS 16.4+).

## 8. Database

### 8.1 Tabellen

| Tabel | Inhoud | Wie mag wat (RLS) |
|---|---|---|
| `admins` | beheerders (user-id) | eigen rij lezen |
| `klanten` | klantgegevens, `user_id` (koppeling account), `status` | klant: eigen rij lezen/wijzigen; admin: alles |
| `motoren` | motoren van klanten (`klant_verwijderd_op` = verborgen voor klant; `source_voorraad_id` = gekocht uit voorraad; `onderdelen_link` alleen http(s), constraint) | klant: eigen lezen/toevoegen/wijzigen, verwijderen zonder garage-historie; admin: alles |
| `km_historie` | km-standen per motor | klant: eigen; admin: alles |
| `service_beurten` | onderhoud (`klant_invoer` = door klant ingevoerd) | klant: lezen eigen, eigen invoer toevoegen/wijzigen; admin: alles |
| `afspraken` | afspraken en aanvragen (`status`, `dag_gekozen`, `type`, `soort`, `medewerker_namen`, `categorie`, klus-velden) | klant: eigen lezen/aanvragen; admin: alles; website: alleen via `maak_afspraak` |
| `afspraken_intern` | interne opmerking bij een afspraak | alleen admin |
| `voorraad` | voorraadmotoren (`km` altijd km, `km_eenheid` km/mijl, foto's, status, `verkocht_op`, `verkocht_aan` = klant-id koper, `extras_niet_aanbieden` = extra's die de motor al heeft) | bezoeker (anon): te koop + 30 dagen na verkoop, **alleen de websitekolommen** (kolomrechten: geen `kenteken`, `verkocht_aan`, onderdelen-link, banden, extra's); klant: niet rechtstreeks, via `voorraad_overzicht()`; admin: alles |
| `voorraad_inkoop` / `voorraad_chassis` / `voorraad_intern` / `voorraad_prijscheck` / `voorraad_service` | inkoopprijs, chassisnr., interne opmerking, Motoroccasion-check, onderhoud vóór verkoop | alleen admin |
| `motor_verkoop_extras` | extra's bij aankoop per klantmotor (`extras` text[], `overig`); verdwijnt met de motor | alleen admin |
| `onderhoudslijsten` | ingevulde onderhoudslijst per afspraak (`afspraak_id`, `lijst` jsonb, `bijgewerkt_op`); verdwijnt met de afspraak | alleen admin |
| `beheer_instellingen` | één rij (`id=1`) met instellingen die alleen de beheerder mag zien: `laatste_factuurnummer` | alleen admin |
| `prijslijst` | artikelen voor facturen: `omschrijving`, `artikelnummer`, `jm_nummer`, `inkoop`, `verkoop` (ex btw), `volgorde` | alleen admin |
| `producten` | onderdelen/accessoires te koop | iedereen: actief en niet verkocht; admin: alles |
| `klussen` | meerdaagse klussen met fases | alleen admin |
| `taken` | takenlijst beheerder | alleen admin (eigen) |
| `instellingen` | één rij (`id=1`): openingstijden, gesloten dagen, tarieven, soorten, medewerkers, kleurcategorieën, `verkoop_extras` (lijst extra's bij verkoop), `onderhoudslijst` (sjabloon), `max_afspraken_per_dag`, `inkoop_bewaar_dagen` (`website_content`: oud, niet meer gebruikt) | iedereen lezen; admin wijzigen |
| `inkoop_leads` / `inkoop_radar_status` / `inkoop_populair` / `inkoop_aanvragen` | inkoop-radar en inkoopaanvragen van de website | alleen admin (+ service role) |
| `push_abonnementen` | pushapparaten van admins | admin: eigen |
| `push_log` / `push_sleutels` | verstuurde meldingen, VAPID-sleutels | alleen server (service role) |
| `website_blokken` | alle teksten/foto's van de website per pagina (`sleutel`, `pagina`, `sectie`, `label`, `type`, `waarde`, `standaard`, `opties`) | iedereen lezen; admin wijzigen |
| `website_blokken_historie` / `website_paginas_historie` | eerdere versies (trigger bij elke wijziging) | alleen admin |
| `website_faq` | veelgestelde vragen per groep | iedereen: actieve vragen; admin: alles |
| `blog_posts` | blogartikelen (markdown-subset), `oude_slugs` voor doorverwijzen | iedereen: gepubliceerd; admin: alles |
| `website_paginas` | eigen dienst- en infopagina's (sjabloon `dienst`/`info`) | iedereen: gepubliceerd; admin: alles |

### 8.2 Functies (RPC) — aan te roepen via de API

| Functie | Voor wie | Wat |
|---|---|---|
| `is_admin()` | iedereen (nodig voor RLS) | is de aanroeper beheerder? |
| `maak_afspraak(...)` | website (anoniem) | afspraak/proefrit aanvragen met controles (invoer, 3 per telefoon per 24 u, open dag, dagcapaciteit). Geen datum of vandaag = aanvraag zonder dag. Weigering = fout (RAISE). |
| `maak_inkoop_lead(...)` | website (anoniem) | "wij kopen je motor"-aanvraag → `inkoop_aanvragen` |
| `get_drukke_datums(start, eind)` | website (anoniem) | aantal meetellende afspraken per dag (alleen datums + aantallen) |
| `get_bezette_dagen()` | ingelogd (klantportaal) | volle dagen (≥ `max_afspraken_per_dag`) |
| `voorraad_overzicht()` | ingelogd (klantportaal) | voorraad te koop + 30 dagen na verkoop, alleen veilige kolommen; kenteken alleen van motoren die nog te koop zijn |
| `verwijder_eigen_account()` | klant | account opheffen (klantrecord gearchiveerd, login verwijderd) |
| `delete_auth_user_by_id(id)` | admin | login van een klant verwijderen |
| `vervang_prijslijst(regels)` | admin (security invoker, controleert `is_admin()`) | hele prijslijst in één transactie vervangen (upload) |

Functies in schema `private` (niet via de API bereikbaar): `meld_push` (pushtrigger),
`telt_voor_dagcapaciteit`, `max_afspraken_per_dag`, `bewaak_dagcapaciteit`,
`verplaats_interne_opmerking`, `motor_heeft_garagehistorie`.

### 8.3 Regels en triggers

| Trigger | Tabel | Wat |
|---|---|---|
| `on_auth_user_created` | auth.users | `handle_new_auth_user`: klantrecord aanmaken/koppelen bij registratie, met naam/telefoon/adres/woonplaats uit het formulier; een gearchiveerd record gaat terug naar `in_afwachting` |
| `klanten_bewaak` | klanten | klant mag status/e-mail/koppeling niet zelf wijzigen |
| `afspraken_bewaak` | afspraken | klant: nieuwe aanvraag = `aangevraagd`; daarna alleen `melding_gezien` |
| `afspraken_dagcapaciteit` | afspraken | klant/website: geen afspraak op een volle dag (advisory lock tegen gelijktijdig boeken) |
| `afspraken_interne_opmerking_apart` | afspraken | vangnet: oude kolom `interne_opmerking` → `afspraken_intern` |
| `push_*` (8 stuks) | afspraken, inkoop_aanvragen, inkoop_radar_status, motoren, service_beurten, klanten, auth.users | pushmelding klaarzetten (pg_net → `push-melding`) |

**Dagcapaciteit:** een dag is vol bij `instellingen.max_afspraken_per_dag` (nu 1) afspraken die
meetellen: niet geannuleerd, en niet een aanvraag zonder gekozen dag (`dag_gekozen = false`)
die nog niet is ingepland. De beheerder mag altijd inplannen.

### 8.4 Realtime

Publicatie `supabase_realtime`: `afspraken`, `klanten`.

### 8.5 Migraties en SQL-bestanden

Wijzigingen worden als migratie toegepast (Supabase → migraties) en per onderwerp bewaard in
`supabase/*.sql`: `beveiliging.sql`, `rls.sql`, `push.sql`, `voorraad_velden.sql`,
`afspraken_intern_en_motoren.sql`, `dagcapaciteit.sql`, `website_koppeling.sql`,
`links_en_registratie.sql` (onderdelen-links alleen http(s), registratiegegevens),
`verkochte_voorraad.sql` (verkochte motoren 30 dagen zichtbaar zonder kenteken/koper),
`website_cms.sql` (website-beheer: tabellen, regels, startinhoud), `verkoop_extras.sql`
(extra's bij verkoop), `onderhoudslijst.sql` (onderhoudslijst per afspraak), `facturen.sql`
(factuurnummer en prijslijst), plus
`supabase/functions/voorraad-prijscheck/schema.sql` en `inkoop-radar/schema.sql`. Ze zijn
herhaalbaar. Tests (draaien in de SQL Editor, draaien alles terug): `rls-test.sql`,
`dagcapaciteit-test.sql`, `website-test.sql`, `verkochte-voorraad-test.sql`, `website-cms-test.sql`,
`verkoop-extras-test.sql`, `onderhoudslijst-test.sql`, `facturen-test.sql`.

## 9. Edge functions (`supabase/functions/`)

| Functie | Aangeroepen door | Toegang | Wat |
|---|---|---|---|
| `cloudinary-delete` | beheer-app | alleen admin, alleen eigen Cloudinary-URL's | foto's verwijderen |
| `voorraad-prijscheck` | beheer-app ("Check prijs"), wekelijkse job | admin of service role | voorraad vergelijken met Motoroccasion (logica in `logica.ts`, gedeeld met de app) |
| `push-melding` | database-triggers (pg_net), beheer-app (sleutel/test) | trigger-aanroepen worden zelf in de database geverifieerd; sleutel/test alleen admin | web push versturen (VAPID/aes128gcm via WebCrypto, `webpush.ts`) |
| `cloudinary-sign` | (nog) niets in deze app | alleen admin | handtekening voor ondertekende uploads; staat live maar wordt niet gebruikt. De code staat niet in `main` maar op de oude branch `claude/agent-skills-context-engineering-dgakz3` (eigen geschiedenis). Opruimen of afmaken. |

Let op: `verify_jwt` alleen is niet genoeg — de publieke anon key is ook een geldige JWT. Elke
functie controleert zelf `is_admin()` waar nodig.

## 10. Achtergrondtaken (GitHub Actions)

| Workflow | Wanneer | Wat |
|---|---|---|
| `build.yml` | elke push naar main en elke PR | `npm ci && npm run build` |
| `beveiligingstest.yml` | elke push + maandag 05:17 UTC | `scripts/beveiligingstest.py`: probeert als buitenstaander bij afgeschermde tabellen/functies te komen |
| `inkoop-radar.yml` | dagelijks 05:00 UTC + handmatig (modi normaal / alleen-prijzen / diagnose / diagnose-voorraad) | `inkoop-radar/fetch_leads.py`: 2dehands-advertenties ophalen, inkoopadvies via Motoroccasion, leads opschonen, digest-mail (Resend) |
| `voorraad-prijscheck.yml` | maandag 06:00 UTC | `inkoop-radar/voorraad_check.py`: alle voorraad laten checken via de edge function, mail bij actie |

Secrets (GitHub → Settings → Secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`DIGEST_FROM`, `DIGEST_TO`. Zie `inkoop-radar/README.md`.

## 11. Koppeling met de website (`Mrjeffa/djm-website`)

De website is een Next.js 15-site (App Router, edge-rendering via `@cloudflare/next-on-pages`)
op Cloudflare Pages (`https://www.dejongemotoren.nl`). Hij gebruikt dezelfde database met de
**publieke** sleutel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) en
heeft geen service-role key. Elke pagina wordt per verzoek opgebouwd (geen ISR/cache).

| Website | Database | Richting |
|---|---|---|
| Alle pagina's (`layout.tsx` → `getInstellingen.ts`) | `instellingen` (openingstijden, gesloten dagen/weken, `max_afspraken_per_dag`, opmerking, tarieven, soorten) | lezen |
| Alle pagina's (`lib/cms.ts`, `lib/faq.ts`, `lib/blog.ts`, `lib/paginas.ts`) | `website_blokken`, `website_faq`, `blog_posts`, `website_paginas` (website-beheer, §5b) | lezen |
| Occasions, occasion-detail, home, proefrit, sitemap, llms.txt (`lib/motors.ts`) | `voorraad` (te koop + 30 dagen na verkoop, alleen de websitekolommen; o.a. merk, model, bouwjaar, km, `km_eenheid`, prijs, foto's, `verkocht_op`) | lezen |
| Onderdelen, sitemap (`lib/producten.ts`) | `producten` (actief, niet verkocht) | lezen |
| Proefrit- en werkplaatsformulier (`forms/shared.tsx`) | rpc `get_drukke_datums` (vandaag + 120 dagen) | lezen in de browser |
| Proefritformulier (`ProefritForm.tsx`) | rpc `maak_afspraak` (type `proefrit`) | schrijven |
| Werkplaats-/winterstallingformulier (`WerkplaatsForm.tsx`) | rpc `maak_afspraak` (type `service`) | schrijven |
| Inkoopformulier (`InkoopForm.tsx`, home + `/motor-verkopen`) | rpc `maak_inkoop_lead` | schrijven |
| Foto's (`lib/cloudinary.ts`) | URL's uit `voorraad.fotos` / `producten.fotos` | alleen tonen |

Wat de beheerder in de app doet, verschijnt dus direct op de website: voorraad op
"beschikbaar" zetten, foto's, prijs, producten, openingstijden en gesloten dagen
(Instellingen), en alles uit "Website aanpassen" (§5b). Aanvragen van de website komen in de app binnen als
afspraak met status `aangevraagd` (agenda/dashboard, pushmelding) of als inkoop-aanvraag.

De website linkt niet naar de app (de app wordt alleen in tekst genoemd).

**Website-beheer (§5b) aan de website-kant** (repo djm-website, sinds 26 november 2026):
- `src/lib/cms.ts`: één query per bezoek naar `website_blokken` (React `cache`), met terugval
  op de tekst in de code als een veld leeg is, een onbekende code bevat of de database
  onbereikbaar is. Vult `{jaren}`, `{telefoon}`, `{whatsapp}` en `{tarief:…}` in. Ook de
  Google-teksten (`seo.<pagina>.titel/omschrijving`) in `generateMetadata`.
- `src/lib/faq.ts` (`website_faq`), `src/lib/blog.ts` (`blog_posts`, doorverwijzen vanaf
  `oude_slugs`), `src/lib/paginas.ts` (`website_paginas`): FAQ en blog vallen bij een
  onbereikbare database terug op de inhoud in de code. De vraag over openingstijden maakt de
  website zelf.
- Routes `/werkplaats/[slug]` (dienst) en `/info/[slug]` (info) via `components/EigenPagina.tsx`;
  dienstpagina's als kaarten op `/werkplaats`; pagina's met "Tonen in menu" in de footer;
  sitemap en `llms.txt` nemen blog en eigen pagina's mee.
- `components/Markdown.tsx`: de markdown-subset; links alleen naar `/pad` of `https://`, HTML
  en `javascript:` worden gewone tekst.
- `instellingen.website_content` wordt niet meer gelezen (kolom kan later weg).

Een wijziging in de app staat dus direct op de website (elke pagina wordt per bezoek
opgebouwd).

**Bekende punten in de website-code** (repo djm-website, nog niet aangepast):
- Formulieren kijken alleen naar `error`. Sinds november 2026 geeft `maak_afspraak` bij een
  weigering een echte fout, zodat de site "Versturen lukte niet" toont i.p.v. "Bedankt"; de
  precieze reden (`error.message`) wordt nog niet getoond.
- Zonder gekozen datum stuurt de site vandaag mee; de database behandelt dat als aanvraag
  zonder dag. Netter: `p_datum: null` sturen.
- `formatKm` (`lib/motors.ts`) toont het km-getal met "mijl" erachter zonder om te rekenen;
  gebruik km ÷ 1,609344 (zoals `src/lib/kmstand.js` in de app).
- Valt terug op 5 afspraken per dag als `instellingen` niet laadt (database: 1).
- Leesfouten bij voorraad/producten worden niet getoond ("alles verkocht").
- `public/_headers` heeft geen CSP/HSTS.

## 12. Externe diensten

| Dienst | Waar | Wat |
|---|---|---|
| Supabase | overal | database, inloggen, realtime, edge functions |
| Cloudinary | `lib/foto.js`, `cloudinary-delete` | foto-opslag (unsigned preset `Djm app`) |
| RDW open data (`opendata.rdw.nl`) | voorraad/klant-motor toevoegen | merk/model/bouwjaar op kenteken |
| Motoroccasion.nl | inkoop-radar, `voorraad-prijscheck` | marktprijzen (één verzoek per motor, robots.txt gerespecteerd) |
| 2dehands.be | inkoop-radar | nieuwe advertenties |
| Larsson (`mike2.larsson.nl`) | `lib/larsson.js` | onderdelen bestellen (link) |
| AutoScout24 | `lib/autoscout.js` + userscript | advertentie klaarzetten |
| Resend | inkoop-radar | digest-mail |
| Web push (Google/Apple/Mozilla) | `push-melding` | meldingen naar admin-apparaten |
| Google Calendar, WhatsApp | links | afspraak in agenda zetten, delen |

## 13. Beveiliging in het kort

- RLS op alle tabellen; gevoelige velden in aparte admin-tabellen; triggers bewaken wat klanten
  mogen wijzigen.
- Publieke formulieren alleen via `SECURITY DEFINER`-functies met invoercontroles en limieten.
- Edge functions controleren zelf of de aanroeper admin is.
- Links die van buiten komen (onderdelen-link van een klant, advertentie-URL's uit de
  inkoop-radar) gaan in de app door `veiligeUrl()` (`lib/larsson.js`): alleen http(s), zodat een
  `javascript:`-link niet in de beheer-app kan draaien. De database dwingt dat ook af voor
  `onderdelen_link` (constraints `*_onderdelen_link_http`).
- Voorraad: verkochte motoren zijn 30 dagen zichtbaar (website en portaal), maar kenteken,
  klantnummer van de koper, chassisnummer, inkoopprijs en interne opmerking niet. Kenteken en
  `verkocht_aan` zijn voor bezoekers afgeschermd met kolomrechten, voor klanten via
  `voorraad_overzicht()`; chassis, inkoop en opmerking staan in admin-tabellen.
- `public/_headers`: CSP (alleen eigen scripts; verbindingen naar Supabase, Cloudinary, RDW),
  HSTS, nosniff, geen framing, referrer-policy, permissions-policy.
- Controle: `scripts/beveiligingstest.py` (GitHub Actions), `supabase/rls-test.sql`,
  Supabase → Advisors.
- Nog in Supabase in te stellen: lek-wachtwoordcontrole (Pro-plan), eigen SMTP, wachtwoordeisen.

## 14. Ontwikkelen

```bash
npm install
npm run dev        # lokaal (geen service worker in dev)
npm run build      # productie-build in dist/
# logica-tests voorraad-prijscheck:
npx esbuild supabase/functions/voorraad-prijscheck/logica.test.ts --bundle --platform=node --format=esm --outfile=/tmp/t.mjs && node /tmp/t.mjs
# inkoop-radar tests:
cd inkoop-radar && python test_prijzen.py && python test_motoroccasion.py && python test_mapping.py
# database-tests: plak supabase/rls-test.sql, dagcapaciteit-test.sql of website-test.sql in de
# SQL Editor; ze draaien alles terug en melden de uitkomst in de foutmelding
```

Afspraken in de code:
- Namen en teksten in het Nederlands.
- Datums als lokale datum (`lokaleDatum()`), niet `toISOString()` — die is UTC en geeft rond
  middernacht de verkeerde dag. Rekenen met datums via `lokaleDag()` / `plusDagen()`
  (AdminApp), niet `new Date("JJJJ-MM-DD")`: dat is UTC-middernacht en schoof rond de overgang
  zomer-/wintertijd een week of periode een dag op.
- Supabase gooit geen fout maar geeft `{ data, error }` terug: altijd `error` controleren en de
  gebruiker een melding geven; pas daarna de schermstatus bijwerken.
- Meerdere onafhankelijke verzoeken tegelijk (`Promise.all`), niet na elkaar.
- `voorraad.km` altijd in kilometers; `km_eenheid` alleen voor weergave.
- Bedragen/getallen van invoer altijd via `naarBedrag()` (`lib/getal.js`).
- Nieuwe externe dienst in de app → domein toevoegen aan `connect-src` in `public/_headers`.
- Nieuwe tabel → RLS aanzetten, policies schrijven, toevoegen aan `scripts/beveiligingstest.py`
  (als hij afgeschermd moet zijn) en aan dit document.
- Wijzigingen via een PR naar `main`; Cloudflare Pages zet `main` live.
