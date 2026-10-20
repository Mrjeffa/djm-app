# De Jonge Motoren — App

React/Vite-app (PWA) met Supabase als database/login, gehost op **Cloudflare Pages**.

## Deployen (Cloudflare Pages)
Cloudflare Pages bouwt automatisch bij elke push naar `main`
(build command `npm run build`, output `dist`).
- `public/_redirects` — alle routes naar de app (nodig voor herladen).
- `public/_headers` — beveiligingsheaders (CSP e.d.) en caching. Gebruikt de
  app een nieuwe externe dienst, voeg het domein dan toe bij `connect-src`.

Supabase → Authentication → URL Configuration: Site URL en Redirect URLs
moeten naar het Cloudflare-adres van de app wijzen.

## Beveiliging
- **Wie wat mag** regelt de database (Row Level Security), niet de app: klanten
  zien alleen hun eigen gegevens, admins staan in de tabel `admins`.
  Stand van zaken: `supabase/beveiliging.sql`.
- **Edge functions** (`supabase/functions/`) controleren zelf of de aanroeper
  admin is — de publieke anon key is ook een geldige JWT, dus `verify_jwt`
  alleen is niet genoeg.
- **Controle**: `.github/workflows/beveiligingstest.yml` probeert wekelijks (en
  bij elke push) als buitenstaander bij afgeschermde gegevens te komen en
  faalt als dat lukt.
- **RLS-test** (`supabase/rls-test.sql`): probeert als klant, buitenstaander en
  beheerder te lezen en te wijzigen; wijzigt niets. Draaien in de SQL Editor.
- Na een databasewijziging: Supabase → Advisors (Security en Performance).

## Installeerbare app (PWA) en pushmeldingen
- `public/manifest.webmanifest`, `public/sw.js` en `public/icons/` maken de app
  installeerbaar. De service worker cachet alleen eigen bestanden (nooit
  Supabase-gegevens) en toont pushmeldingen.
- Klantportaal → Instellingen → **App installeren** (Android-knop of
  iPhone-uitleg); verdwijnt als de app al geïnstalleerd draait.
- Admin → Instellingen → **Pushmeldingen**: per apparaat aan/uit + testmelding.
  Triggers in de database (`supabase/push.sql`) roepen edge function
  `push-melding` aan bij een nieuwe afspraak/aanvraag, inkoop-aanvraag,
  inkoop-radar-run en klantacties. De VAPID-sleutels maakt die functie zelf aan.
  Op een iPhone werken meldingen alleen in de geïnstalleerde app.

## Lokaal draaien (optioneel)
```
npm install
npm run dev
```
