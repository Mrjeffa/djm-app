# De Jonge Motoren — App

## Deployen naar Vercel

### Stap 1 — GitHub repo aanmaken
1. Ga naar github.com → maak gratis account
2. Klik "New repository" → naam: `djm-app` → Public → Create
3. Upload alle bestanden uit deze map

### Stap 2 — Vercel koppelen
1. Ga naar vercel.com → log in met GitHub
2. Klik "Add New Project" → selecteer `djm-app`
3. Klik "Deploy" — Vercel bouwt en deployt automatisch

### Stap 3 — Supabase allowlist updaten
Na deployment krijg je een URL zoals `djm-app.vercel.app`
1. Ga naar Supabase → Settings → API Keys → Publishable keys
2. Voeg je Vercel URL toe als allowed host

### Stap 4 — Supabase redirect URL instellen
1. Ga naar Supabase → Authentication → URL Configuration
2. Zet Site URL op je Vercel URL (bijv. https://djm-app.vercel.app)
3. Voeg toe aan Redirect URLs: https://djm-app.vercel.app/*

## Lokaal draaien (optioneel)
```
npm install
npm run dev
```
