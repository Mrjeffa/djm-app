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
- Na een databasewijziging: Supabase → Advisors (Security en Performance).

## Lokaal draaien (optioneel)
```
npm install
npm run dev
```
