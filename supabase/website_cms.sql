-- Website-beheer (CMS) voor www.dejongemotoren.nl, fase 1 t/m 5 van het werkplan
-- ("Werkplan: Website aanpassen in de DJM-app", 26 november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migraties "website_cms_schema" en
-- "website_cms_seed".
--
-- Contract met de website (repo djm-website): de sleutels in website_blokken. Niet hernoemen
-- of verwijderen; toevoegen mag (de website toont een nieuwe sleutel pas als die hem gebruikt).
--
-- Lezen: iedereen (de website); blog en pagina's alleen als ze gepubliceerd zijn, FAQ alleen actief.
-- Schrijven: alleen de beheerder (RLS met is_admin()); wijzigingen komen in een historietabel.
-- Fase 6 (aanbetalen met Mollie) staat hier bewust niet in.
-- Na het toepassen (26-11-2026, migraties "website_cms_teksten_gelijk_aan_live" en
-- "website_cms_home_gelijk_aan_live"): verkopen.intro, home.inkoop.tekst, home.werkplaats.tekst
-- en home.over.tekst kregen de teksten die toen live stonden, en de vier blogartikelen uit de
-- website (src/content/blog.ts) zijn in blog_posts gezet.

-- ══ SCHEMA ═══════════════════════════════════════════════════════════════════
-- 4.1 Blokken: alle losse teksten en afbeeldingen, generiek beschreven
create table public.website_blokken (
  sleutel        text primary key,                 -- bv. 'home.hero.titel1' (contract met website)
  pagina         text not null,                    -- 'home', 'occasions', 'werkplaats', ...
  sectie         text not null,                    -- kop in de editor, bv. 'Hero'
  label          text not null,                    -- veldnaam in de editor
  type           text not null check (type in ('tekst','tekst_lang','afbeelding','lijst')),
  waarde         jsonb not null,                   -- huidige inhoud (zie §6 voor formaat per type)
  standaard      jsonb not null,                   -- originele inhoud, voor "Standaard herstellen"
  opties         jsonb not null default '{}'::jsonb, -- max, velden, min_items, max_items, formaat, hulp
  volgorde       int  not null default 0,
  bijgewerkt_op  timestamptz not null default now(),
  bijgewerkt_door uuid references auth.users(id) on delete set null
);

alter table public.website_blokken enable row level security;
create policy website_blokken_lezen on public.website_blokken for select using (true);
create policy website_blokken_admin on public.website_blokken for all
  using (public.is_admin()) with check (public.is_admin());

-- 4.2 Historie: elke wijziging bewaren, zodat de admin kan terugzetten
create table public.website_blokken_historie (
  id            bigint generated always as identity primary key,
  sleutel       text not null references public.website_blokken(sleutel) on delete cascade,
  waarde        jsonb not null,
  gewijzigd_op  timestamptz not null default now(),
  gewijzigd_door uuid
);
alter table public.website_blokken_historie enable row level security;
create policy website_blokken_historie_admin on public.website_blokken_historie for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.website_blokken_bewaar_historie()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.waarde is distinct from old.waarde then
    insert into public.website_blokken_historie (sleutel, waarde, gewijzigd_door)
    values (old.sleutel, old.waarde, auth.uid());
    new.bijgewerkt_op := now();
    new.bijgewerkt_door := auth.uid();
  end if;
  return new;
end $$;

create trigger website_blokken_historie_trg
  before update on public.website_blokken
  for each row execute function public.website_blokken_bewaar_historie();

-- 4.3 Veelgestelde vragen
create table public.website_faq (
  id          uuid primary key default gen_random_uuid(),
  groep       text not null check (groep in ('kopen','verkopen','werkplaats','bezoek')),
  vraag       text not null check (char_length(vraag) between 5 and 140),
  antwoord    text not null check (char_length(antwoord) between 20 and 900),
  link_href   text check (link_href is null or link_href ~ '^/'),
  link_label  text,
  volgorde    int  not null default 0,
  actief      boolean not null default true,
  bijgewerkt_op timestamptz not null default now()
);
alter table public.website_faq enable row level security;
create policy website_faq_lezen on public.website_faq for select using (actief or public.is_admin());
create policy website_faq_admin on public.website_faq for all
  using (public.is_admin()) with check (public.is_admin());

-- 4.4 Blog
create table public.blog_posts (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titel          text not null check (char_length(titel) between 10 and 90),
  beschrijving   text not null check (char_length(beschrijving) between 70 and 170),
  inhoud         text not null,                    -- markdown-subset, zie §7
  categorie      text not null,
  afbeelding     jsonb,                            -- {url, alt, breedte, hoogte} of null
  status         text not null default 'concept' check (status in ('concept','gepubliceerd')),
  gepubliceerd_op date,
  bijgewerkt_op  timestamptz not null default now(),
  oude_slugs     text[] not null default '{}'      -- voor automatische doorverwijzing na slug-wijziging
);
alter table public.blog_posts enable row level security;
create policy blog_posts_lezen on public.blog_posts for select
  using (status = 'gepubliceerd' or public.is_admin());
create policy blog_posts_admin on public.blog_posts for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Fase 5: dienst- en infopagina's ─────────────────────────────────────────
create table public.website_paginas (
  id               uuid primary key default gen_random_uuid(),
  sjabloon         text not null check (sjabloon in ('dienst','info')),
  slug             text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titel            text not null check (char_length(titel) between 10 and 70),
  intro            text not null check (char_length(intro) between 50 and 400),
  inhoud           text not null default '',
  afbeelding       jsonb,
  prijs_tekst      text check (prijs_tekst is null or char_length(prijs_tekst) <= 120),
  duur_tekst       text check (duur_tekst is null or char_length(duur_tekst) <= 80),
  afspraak_soort   text,
  faq              jsonb not null default '[]'::jsonb check (jsonb_typeof(faq) = 'array'),
  seo_titel        text check (seo_titel is null or char_length(seo_titel) <= 45),
  seo_omschrijving text check (seo_omschrijving is null or char_length(seo_omschrijving) <= 160),
  in_menu          boolean not null default true,
  volgorde         int  not null default 0,
  status           text not null default 'concept' check (status in ('concept','gepubliceerd')),
  gepubliceerd_op  date,
  bijgewerkt_op    timestamptz not null default now(),
  oude_slugs       text[] not null default '{}',
  unique (sjabloon, slug)
);
alter table public.website_paginas enable row level security;
create policy website_paginas_lezen on public.website_paginas for select
  using (status = 'gepubliceerd' or public.is_admin());
create policy website_paginas_admin on public.website_paginas for all
  using (public.is_admin()) with check (public.is_admin());

create table public.website_paginas_historie (
  id             bigint generated always as identity primary key,
  pagina_id      uuid not null references public.website_paginas(id) on delete cascade,
  versie         jsonb not null,               -- volledige rij vóór de wijziging
  gewijzigd_op   timestamptz not null default now(),
  gewijzigd_door uuid
);
alter table public.website_paginas_historie enable row level security;
create policy website_paginas_historie_admin on public.website_paginas_historie for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.website_paginas_bewaar_historie()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- alleen de volgorde verschoven: geen nieuwe versie
  if (to_jsonb(new) - 'volgorde' - 'bijgewerkt_op') is distinct from (to_jsonb(old) - 'volgorde' - 'bijgewerkt_op') then
    insert into public.website_paginas_historie (pagina_id, versie, gewijzigd_door)
    values (old.id, to_jsonb(old), auth.uid());
    new.bijgewerkt_op := now();
  end if;
  return new;
end $$;

create trigger website_paginas_historie_trg
  before update on public.website_paginas
  for each row execute function public.website_paginas_bewaar_historie();

-- ── Extra beveiliging (aanvulling op het werkplan) ───────────────────────────
-- De website toont deze inhoud aan iedereen. De database weigert daarom alles wat als
-- script of ongeldige link kan uitpakken, ook als iemand de app omzeilt:
--  * geen javascript:/data:/vbscript:-links in markdown ([tekst](javascript:...))
--  * afbeeldingen alleen via https
--  * FAQ-link alleen intern: "/pad", niet "//ander-domein.nl" (dat begint ook met "/")
alter table public.website_blokken
  add constraint website_blokken_sleutel_vorm check (sleutel ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  add constraint website_blokken_geen_script check (waarde::text !~* '\]\(\s*(javascript|data|vbscript):'),
  add constraint website_blokken_afbeelding_https check (
    type <> 'afbeelding' or coalesce(waarde ->> 'url', '') = '' or (waarde ->> 'url') ~ '^https://[^[:space:]"<>]+$');
alter table public.website_faq
  drop constraint if exists website_faq_link_href_check,
  add constraint website_faq_link_intern check (link_href is null or link_href ~ '^/([^/\\].*)?$'),
  add constraint website_faq_link_label check (link_label is null or char_length(link_label) <= 40),
  add constraint website_faq_geen_script check (antwoord !~* '\]\(\s*(javascript|data|vbscript):');
alter table public.blog_posts
  add constraint blog_posts_inhoud_lengte check (char_length(inhoud) <= 60000),
  add constraint blog_posts_categorie_lengte check (char_length(categorie) between 2 and 40),
  add constraint blog_posts_geen_script check (inhoud !~* '\]\(\s*(javascript|data|vbscript):'),
  add constraint blog_posts_afbeelding_https check (
    afbeelding is null or coalesce(afbeelding ->> 'url', '') = '' or (afbeelding ->> 'url') ~ '^https://[^[:space:]"<>]+$'),
  add constraint blog_posts_publicatiedatum check (status = 'concept' or gepubliceerd_op is not null);
alter table public.website_paginas
  add constraint website_paginas_inhoud_lengte check (char_length(inhoud) <= 60000),
  add constraint website_paginas_faq_max check (jsonb_array_length(faq) <= 8),
  add constraint website_paginas_geen_script check ((inhoud || faq::text) !~* '\]\(\s*(javascript|data|vbscript):'),
  add constraint website_paginas_afbeelding_https check (
    afbeelding is null or coalesce(afbeelding ->> 'url', '') = '' or (afbeelding ->> 'url') ~ '^https://[^[:space:]"<>]+$'),
  add constraint website_paginas_publicatiedatum check (status = 'concept' or gepubliceerd_op is not null);

-- bijgewerkt_op altijd door de database (niet afhankelijk van de app)
create or replace function public.zet_bijgewerkt_op()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.bijgewerkt_op := now();
  return new;
end $$;
create trigger website_faq_bijgewerkt_trg before update on public.website_faq
  for each row execute function public.zet_bijgewerkt_op();
create trigger blog_posts_bijgewerkt_trg before update on public.blog_posts
  for each row execute function public.zet_bijgewerkt_op();

-- Triggerfuncties zijn geen API: niemand hoeft ze rechtstreeks aan te roepen
revoke all on function public.website_blokken_bewaar_historie() from public, anon, authenticated;
revoke all on function public.website_paginas_bewaar_historie() from public, anon, authenticated;
revoke all on function public.zet_bijgewerkt_op() from public, anon, authenticated;

-- Opzoeken per pagina en historie per veld/pagina
create index if not exists website_blokken_pagina_idx on public.website_blokken (pagina, sectie, volgorde);
create index if not exists website_blokken_historie_sleutel_idx on public.website_blokken_historie (sleutel, gewijzigd_op desc);
create index if not exists website_paginas_historie_pagina_idx on public.website_paginas_historie (pagina_id, gewijzigd_op desc);
create index if not exists website_faq_groep_idx on public.website_faq (groep, volgorde);

-- ══ STARTINHOUD (bijlage A en B) ══════════════════════════════════════════
-- Bijlage A: alle velden met de huidige websiteteksten; de 8 bestaande teksten uit
-- instellingen.website_content worden meteen overgenomen (zo blijft de site gelijk).
insert into public.website_blokken (sleutel, pagina, sectie, label, type, standaard, waarde, opties, volgorde)
select v.sleutel, v.pagina, v.sectie, v.label, v.type, v.standaard,
       coalesce((select to_jsonb(i.website_content ->> m.oud)
                 from public.instellingen i
                 join (values ('hero_regel1','home.hero.titel1'),
                              ('hero_regel2','home.hero.titel2'),
                              ('hero_ondertitel','home.hero.ondertitel'),
                              ('service_intro','werkplaats.afspraak.tekst'),
                              ('footer_tagline','algemeen.footer.tagline'),
                              ('over_ons_intro','overons.intro'),
                              ('proefrit_intro','proefrit.intro'),
                              ('inkoop_ondertitel','verkopen.intro')) as m(oud, nieuw) on m.nieuw = v.sleutel
                 where i.id = 1 and coalesce(i.website_content ->> m.oud, '') <> ''),
                v.standaard),
       v.opties::jsonb, v.volgorde
from (values
-- HOME
('home.hero.eyebrow','home','Hero','Regel boven de titel','tekst', to_jsonb('Motorzaak in Tholen · occasions, inkoop en werkplaats'::text), '{"max":70}', 1),
('home.hero.titel1','home','Hero','Titel, regel 1 (wit)','tekst', to_jsonb('Jouw vrijheid.'::text), '{"max":24,"hulp":"Kort en krachtig, max 24 tekens."}', 2),
('home.hero.titel2','home','Hero','Titel, regel 2 (rood)','tekst', to_jsonb('Vind hem hier.'::text), '{"max":24}', 3),
('home.hero.ondertitel','home','Hero','Ondertitel','tekst_lang', to_jsonb('Occasion motoren kopen, je motor verkopen of laten onderhouden. Eerlijk geprijsd en met persoonlijk advies.'::text), '{"max":200}', 4),
('home.hero.afbeelding','home','Hero','Hoofdfoto','afbeelding', '{"url":"https://images.unsplash.com/photo-1568772585407-9361f9bf3a87","alt":"Rode sportmotor in een donkere garage","breedte":1600,"hoogte":1867}', '{"formaat":"Staand of vierkant, minimaal 1200 x 1400 px. Bij voorkeur een eigen foto van de zaak of een motor uit de voorraad."}', 5),
('home.usps','home','Kenmerken onder de hero','Vier kenmerken','lijst', '[{"titel":"{jaren} jaar in Tholen","tekst":"Vertrouwd adres aan de Stevinweg"},{"titel":"Gratis proefrit","tekst":"Met een geldig A- of A2-rijbewijs"},{"titel":"Inkoop alle merken","tekst":"Vrijblijvende taxatie van je motor"},{"titel":"Eigen werkplaats","tekst":"Onderhoud, reparatie en stalling"}]', '{"velden":[{"naam":"titel","label":"Titel","max":28},{"naam":"tekst","label":"Tekst","max":50}],"min_items":4,"max_items":4}', 6),
('home.routes.titel','home','Drie routes','Titel','tekst', to_jsonb('Kopen, verkopen of laten onderhouden'::text), '{"max":60}', 10),
('home.routes','home','Drie routes','Routes','lijst', '[{"titel":"Motor kopen","tekst":"Bekijk de occasions die nu bij De Jonge Motoren staan, met foto''s, kilometerstand en prijs. Plan daarna een proefrit in Tholen."},{"titel":"Motor verkopen","tekst":"Vul het merk, model en de kilometerstand in. We bellen je voor een vrijblijvende taxatie en regelen de overdracht."},{"titel":"Onderhoud en reparatie","tekst":"Van kleine beurt tot banden, remmen en diagnose. Nieuwe klanten vragen een afspraak aan via de website."}]', '{"velden":[{"naam":"titel","label":"Titel","max":30},{"naam":"tekst","label":"Tekst","max":170}],"min_items":3,"max_items":3,"hulp":"Volgorde: kopen, verkopen, werkplaats. De knoppen linken automatisch naar de juiste pagina."}', 11),
('home.inkoop.titel','home','Motor verkopen','Titel','tekst', to_jsonb('Verkoop je motor aan De Jonge Motoren'::text), '{"max":60}', 20),
('home.inkoop.tekst','home','Motor verkopen','Tekst','tekst_lang', to_jsonb('Vrijblijvende taxatie, eerlijke prijs en snelle afhandeling.'::text), '{"max":300}', 21),
('home.werkplaats.titel','home','Werkplaats','Titel','tekst', to_jsonb('Onderhoud, reparatie en stalling'::text), '{"max":60}', 30),
('home.werkplaats.tekst','home','Werkplaats','Tekst','tekst_lang', to_jsonb('Nieuwe klant en moet je motor onderhouden of gerepareerd worden? Vul het formulier in, dan plannen we een afspraak met je in.'::text), '{"max":300}', 31),
('home.over.titel','home','Over ons','Titel','tekst', to_jsonb('Nieuwe eigenaren, dezelfde werkplaats'::text), '{"max":60}', 40),
('home.over.tekst','home','Over ons','Tekst','tekst_lang', to_jsonb('We nemen De Jonge Motoren over: 25 jaar reputatie en dezelfde eerlijke aanpak.

Léon en Diana de Jonge bouwden De Jonge Motoren in 25 jaar op tot een vertrouwd adres voor motorrijders uit Tholen en omgeving. Jeffrey en Anouk zetten het bedrijf voort op hetzelfde adres.'::text), '{"max":600}', 41),
('home.app.titel','home','DJM-app','Titel','tekst', to_jsonb('De DJM-app voor klanten'::text), '{"max":50}', 50),
('home.app.tekst','home','DJM-app','Tekst','tekst_lang', to_jsonb('Klanten van De Jonge Motoren houden in de app het onderhoud en de kilometerstand van hun motor bij, krijgen een seintje als een beurt eraan komt en plannen zelf een afspraak.'::text), '{"max":300}', 51),

-- OCCASIONS
('occasions.intro','occasions','Bovenaan','Introductie','tekst_lang', to_jsonb('Elke occasion staat bij De Jonge Motoren aan de Stevinweg 14 in Tholen. Zie je iets dat je bevalt? Plan een gratis proefrit of stuur ons een WhatsApp.'::text), '{"max":300}', 1),
('occasions.kopen.titel','occasions','Onder de voorraad','Titel','tekst', to_jsonb('Een occasion kopen bij De Jonge Motoren'::text), '{"max":60}', 10),
('occasions.kopen.tekst','occasions','Onder de voorraad','Tekst','tekst_lang', to_jsonb('Bij De Jonge Motoren koop je een gebruikte motor van een zaak die al {jaren} jaar in Tholen zit. Je ziet de motor in het echt, je maakt een proefrit en je stelt je vragen aan de mensen die de motor hebben ingekocht.

Een proefrit is gratis. Neem een geldig rijbewijs mee dat past bij de motor (A of A2), je eigen helm en motorkleding. Bel of app vooraf, dan staat de motor klaar.

Wil je je huidige motor kwijt? Laat hem taxeren via [motor verkopen](/motor-verkopen). Twijfel je over een motor die je elders wilt kopen? Onze [werkplaats](/werkplaats) doet ook aankoopkeuringen.'::text), '{"max":1200}', 11),

-- WERKPLAATS
('werkplaats.intro','werkplaats','Bovenaan','Introductie','tekst_lang', to_jsonb('De werkplaats van De Jonge Motoren aan de Stevinweg onderhoudt en repareert motoren van klanten uit Tholen, Bergen op Zoom en omgeving. Vraag hieronder een afspraak aan; we bellen je om de datum te bevestigen.'::text), '{"max":400}', 1),
('werkplaats.diensten.titel','werkplaats','Diensten','Titel','tekst', to_jsonb('Wat de werkplaats voor je doet'::text), '{"max":60,"hulp":"De diensten zelf komen uit Instellingen > Afspraaksoorten."}', 10),
('werkplaats.tarieven.tekst','werkplaats','Tarieven','Tekst naast de tarieven','tekst_lang', to_jsonb('De kosten van onderhoud en reparaties hangen af van je motor. Vraag bij je aanvraag gerust naar een prijsindicatie.'::text), '{"max":300,"hulp":"De bedragen zelf komen uit Instellingen > Tarieven."}', 20),
('werkplaats.afspraak.tekst','werkplaats','Afspraak aanvragen','Tekst bij het formulier','tekst_lang', to_jsonb('Nieuwe klant en moet je motor onderhouden of gerepareerd worden? Vul het formulier in, dan plannen we een afspraak met je in.'::text), '{"max":300}', 30),
('werkplaats.app.tekst','werkplaats','Afspraak aanvragen','Tekst voor bestaande klanten','tekst', to_jsonb('Ben je al klant? Plan je afspraak dan in de DJM-app. Daar zie je ook de onderhoudshistorie van je motor.'::text), '{"max":160}', 31),

-- WINTERSTALLING
('winterstalling.intro','winterstalling','Bovenaan','Introductie','tekst_lang', to_jsonb('Stal je motor deze winter bij De Jonge Motoren aan de Stevinweg 14 in Tholen. Winterstalling kost {tarief:winterstalling_6mnd} voor 6 maanden en je kunt de stalling combineren met een poetsbeurt of onderhoud.'::text), '{"max":400}', 1),
('winterstalling.pakketten','winterstalling','Pakketten','Omschrijving per pakket','lijst', '[{"titel":"Winterstalling","tekst":"Je motor staat 6 maanden bij ons gestald."},{"titel":"Winterstalling met poetsbeurt","tekst":"Stalling, en je motor gaat schoon het nieuwe seizoen in."},{"titel":"Winterstalling met kleine beurt","tekst":"Stalling plus een kleine onderhoudsbeurt in de werkplaats."},{"titel":"Winterstalling met grote beurt","tekst":"Stalling plus een grote onderhoudsbeurt in de werkplaats."}]', '{"velden":[{"naam":"titel","label":"Naam pakket","max":40},{"naam":"tekst","label":"Omschrijving","max":120}],"min_items":4,"max_items":4,"hulp":"Volgorde: alleen stalling, met poetsbeurt, met kleine beurt, met grote beurt. De prijzen komen uit Instellingen > Tarieven."}', 10),
('winterstalling.aanmelden.tekst','winterstalling','Aanmelden','Tekst bij het formulier','tekst_lang', to_jsonb('Kies het pakket, laat je nummer achter en we bellen je om een brengdatum af te spreken.'::text), '{"max":250}', 20),

-- MOTOR VERKOPEN
('verkopen.titel','verkopen','Bovenaan','Titel (H1)','tekst', to_jsonb('Motor verkopen in Zeeland en West-Brabant'::text), '{"max":50}', 1),
('verkopen.intro','verkopen','Bovenaan','Introductie','tekst_lang', to_jsonb('De Jonge Motoren koopt motoren van alle merken en types. Vrijblijvende taxatie, eerlijke prijs en snelle afhandeling.'::text), '{"max":300}', 2),
('verkopen.voordelen','verkopen','Bovenaan','Voordelen','lijst', '[{"tekst":"Je hoeft geen advertentie te plaatsen of kijkers te ontvangen"},{"tekst":"Vrijblijvende taxatie door een motorzaak"},{"tekst":"Persoonlijk contact met De Jonge Motoren in Tholen"}]', '{"velden":[{"naam":"tekst","label":"Voordeel","max":80}],"min_items":2,"max_items":5}', 3),
('verkopen.stappen','verkopen','Werkwijze','Stappen','lijst', '[{"titel":"Vul je motor in","tekst":"Merk, model, bouwjaar en kilometerstand, plus je naam en telefoonnummer. Daarna stuur je foto''s via WhatsApp of mail."},{"titel":"We bellen je terug","tekst":"We vragen naar de staat, het onderhoud en eventuele schade, en spreken een taxatie af."},{"titel":"Taxatie en bod","tekst":"Je komt langs in Tholen of we spreken een andere plek af. We bekijken de motor samen en doen je een bod."},{"titel":"Overdracht en betaling","tekst":"Ga je akkoord, dan regelen we de overschrijving en de betaling direct."}]', '{"velden":[{"naam":"titel","label":"Titel","max":30},{"naam":"tekst","label":"Tekst","max":160}],"min_items":3,"max_items":5,"hulp":"Deze stappen staan ook op de homepage."}', 10),
('verkopen.prijs.tekst','verkopen','Wat bepaalt de prijs','Tekst','tekst_lang', to_jsonb('De taxatiewaarde van een gebruikte motor hangt af van het merk, model en bouwjaar, de kilometerstand, de staat van banden, ketting en remmen, het onderhoud en de vraag naar dat type motor.

Neem bij de taxatie het kentekenbewijs, het onderhoudsboekje en alle sleutels mee. Heb je accessoires of originele onderdelen, zoals koffers of een origineel uitlaatsysteem, vermeld dat dan ook.'::text), '{"max":900}', 20),

-- PROEFRIT
('proefrit.intro','proefrit','Bovenaan','Introductie','tekst_lang', to_jsonb('Een motor koop je niet op basis van foto''s. Kom langs, rij hem en voel of hij bij je past.'::text), '{"max":300}', 1),
('proefrit.meenemen','proefrit','Wat neem je mee','Lijst','lijst', '[{"label":"Rijbewijs","tekst":"Een geldig motorrijbewijs dat past bij de motor (A of A2)"},{"label":"Uitrusting","tekst":"Je eigen helm, handschoenen en motorkleding"},{"label":"Kosten","tekst":"Gratis en zonder verplichting"}]', '{"velden":[{"naam":"label","label":"Onderwerp","max":20},{"naam":"tekst","label":"Tekst","max":90}],"min_items":2,"max_items":6,"hulp":"De locatie wordt automatisch toegevoegd."}', 10),
('proefrit.werkwijze','proefrit','Hoe gaat het','Tekst','tekst_lang', to_jsonb('Je vraagt de proefrit aan en wij bellen je om een moment af te spreken. Op de afgesproken dag staat de motor klaar en rij je op je eigen tempo een rondje. Bevalt de motor, dan bespreken we de koop. Bevalt hij niet, dan zoeken we samen verder.'::text), '{"max":600}', 20),

-- OVER ONS
('overons.titel','overons','Bovenaan','Titel (H1)','tekst', to_jsonb('Nieuwe eigenaren, dezelfde werkplaats'::text), '{"max":50}', 1),
('overons.intro','overons','Bovenaan','Introductie','tekst_lang', to_jsonb('We nemen De Jonge Motoren over: 25 jaar reputatie en dezelfde eerlijke aanpak.'::text), '{"max":300}', 2),
('overons.foto','overons','Bovenaan','Foto van de eigenaren','afbeelding', '{"url":"","alt":"","breedte":0,"hoogte":0}', '{"formaat":"Liggend, minimaal 1600 x 1200 px. Leeg = geen foto tonen.","optioneel":true}', 3),
('overons.eigenaren.titel','overons','Verhaal','Kop: de nieuwe eigenaren','tekst', to_jsonb('Wie zijn Jeffrey en Anouk?'::text), '{"max":60}', 10),
('overons.eigenaren.tekst','overons','Verhaal','Tekst: de nieuwe eigenaren','tekst_lang', to_jsonb('Jeffrey en Anouk nemen De Jonge Motoren over. Jeffrey rijdt al jaren motor en kent de markt van binnenuit. Anouk zorgt dat alles achter de schermen op rolletjes loopt. Samen zetten ze voort wat De Jonge Motoren altijd was: een plek waar je eerlijk advies krijgt en zonder druk een motor koopt, verkoopt of laat onderhouden.'::text), '{"max":1000}', 11),
('overons.historie.titel','overons','Verhaal','Kop: de geschiedenis','tekst', to_jsonb('{jaren} jaar opgebouwd door Léon en Diana'::text), '{"max":60}', 12),
('overons.historie.tekst','overons','Verhaal','Tekst: de geschiedenis','tekst_lang', to_jsonb('Léon de Jonge begon met motoren vanuit passie en bouwde samen met Diana een bedrijf op dat bekendstaat om eerlijkheid en vakmanschap. Léon en Diana blijven de komende tijd betrokken, zodat de overgang voor klanten rustig verloopt.'::text), '{"max":1000}', 13),
('overons.motto.titel','overons','Verhaal','Kop: waar we voor staan','tekst', to_jsonb('Waar we voor staan'::text), '{"max":60}', 14),
('overons.motto.tekst','overons','Verhaal','Tekst: waar we voor staan','tekst_lang', to_jsonb('"Als wij een motor niet aan onze eigen familie zouden verkopen, verkopen wij hem niet." Met die regel kopen we motoren in, zetten we ze in de showroom en adviseren we klanten. Je ziet bij ons wat je koopt, je maakt een proefrit en je krijgt een eerlijk antwoord op je vragen.'::text), '{"max":1000}', 15),

-- CONTACT
('contact.intro','contact','Bovenaan','Introductie','tekst_lang', to_jsonb('De Jonge Motoren zit aan de Stevinweg 14, 4691 SM Tholen. Bel, app of mail ons, of kom langs tijdens openingstijden.'::text), '{"max":300}', 1),

-- ALGEMEEN
('algemeen.footer.tagline','algemeen','Footer','Tekst onder het logo','tekst_lang', to_jsonb('Motorzaak in Tholen, Zeeland. Al 25 jaar occasions, inkoop en werkplaats onder één dak.'::text), '{"max":200}', 1),

-- SEO (leeg = website gebruikt de huidige titel/omschrijving)
('seo.home.titel','seo','Home','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 1),
('seo.home.omschrijving','seo','Home','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 2),
('seo.occasions.titel','seo','Occasions','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 3),
('seo.occasions.omschrijving','seo','Occasions','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 4),
('seo.werkplaats.titel','seo','Werkplaats','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 5),
('seo.werkplaats.omschrijving','seo','Werkplaats','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 6),
('seo.winterstalling.titel','seo','Winterstalling','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 7),
('seo.winterstalling.omschrijving','seo','Winterstalling','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 8),
('seo.verkopen.titel','seo','Motor verkopen','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 9),
('seo.verkopen.omschrijving','seo','Motor verkopen','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 10),
('seo.proefrit.titel','seo','Proefrit','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 11),
('seo.proefrit.omschrijving','seo','Proefrit','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 12),
('seo.overons.titel','seo','Over ons','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 13),
('seo.overons.omschrijving','seo','Over ons','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 14),
('seo.contact.titel','seo','Contact','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 15),
('seo.contact.omschrijving','seo','Contact','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 16),
('seo.onderdelen.titel','seo','Onderdelen','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 17),
('seo.onderdelen.omschrijving','seo','Onderdelen','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 18),
('seo.faq.titel','seo','Veelgestelde vragen','Google-titel','tekst', to_jsonb(''::text), '{"max":45}', 19),
('seo.faq.omschrijving','seo','Veelgestelde vragen','Google-omschrijving','tekst', to_jsonb(''::text), '{"max":160}', 20)
) as v(sleutel, pagina, sectie, label, type, standaard, opties, volgorde)
on conflict (sleutel) do nothing;

-- Bijlage B: veelgestelde vragen (alleen als de tabel nog leeg is)
insert into public.website_faq (groep, vraag, antwoord, link_href, link_label, volgorde)
select * from (values
('kopen','Kan ik een proefrit maken met een occasion?','Ja. Bij De Jonge Motoren in Tholen plan je een proefrit gratis en zonder verplichting. Je hebt een geldig motorrijbewijs nodig dat past bij de motor (A of A2) en je neemt je eigen helm en motorkleding mee. Vraag de proefrit aan via de website, bel {telefoon} of stuur een WhatsApp naar {whatsapp}.','/proefrit','Proefrit aanvragen',1),
('kopen','Wat betekent "gereserveerd" bij een occasion?','Op een motor met het label "gereserveerd" rust een reservering van een andere klant. De motor staat nog online omdat een koop soms niet doorgaat. Bel of app ons als je interesse hebt, dan laten we weten of hij weer beschikbaar komt.',null,null,2),
('kopen','Zoeken jullie ook een specifieke motor voor mij?','Ja. Staat jouw motor niet in de voorraad, dan kun je De Jonge Motoren een zoekopdracht geven. We gaan dan gericht op zoek naar het merk, model en budget dat jij opgeeft. Het tarief voor een zoekopdracht is {tarief:zoekopdracht_bemiddeling}. Neem contact op om je wensen en de voorwaarden door te spreken.','/contact','Zoekopdracht bespreken',3),
('kopen','Kan ik een motor laten keuren die ik ergens anders wil kopen?','Ja. De werkplaats van De Jonge Motoren doet aankoopkeuringen, ook van motoren die je bij een particulier of een andere zaak koopt. Een basiskeuring kost {tarief:aankoopkeuring_basis}; elke extra 10 minuten kost {tarief:aankoopkeuring_extra_10min}. Plan de keuring in via het werkplaatsformulier of bel ons.','/werkplaats','Keuring plannen',4),
('verkopen','Hoe verkoop ik mijn motor aan De Jonge Motoren?','Vul het formulier op de pagina Motor verkopen in met het merk, model, bouwjaar en de kilometerstand. De Jonge Motoren belt je terug voor een vrijblijvende taxatie. Ben je het eens met het bod, dan regelen we de overdracht en de betaling direct.','/motor-verkopen','Taxatie aanvragen',1),
('verkopen','Welke motoren kopen jullie in?','De Jonge Motoren koopt motoren van alle merken en types in: naked, sport, tour, adventure, chopper en klassiekers. De prijs hangt af van de staat, de kilometerstand, het onderhoud en de vraag in de markt. Een onderhoudsboekje en een tweede sleutel helpen bij de taxatie.',null,null,2),
('verkopen','Kan ik mijn motor ook in consignatie verkopen?','Ja. Bij consignatieverkoop staat je motor in de showroom van De Jonge Motoren en verkopen wij hem namens jou. Jij blijft eigenaar tot de verkoop. Vraag naar de voorwaarden en kosten, dan leggen we uit hoe het werkt.','/contact','Vraag naar de voorwaarden',3),
('werkplaats','Hoe plan ik onderhoud of een reparatie?','Nieuwe klanten vragen onderhoud aan via het formulier op de werkplaatspagina of bellen {telefoon}. We bellen je terug om een datum af te spreken. Ben je al klant, dan plan je de afspraak in de DJM-app.','/werkplaats','Onderhoud aanvragen',1),
('werkplaats','Wat kost winterstalling voor mijn motor?','Winterstalling bij De Jonge Motoren in Tholen kost {tarief:winterstalling_6mnd} voor 6 maanden en {tarief:winterstalling_extra_mnd} per extra maand. Je kunt de stalling combineren met een poetsbeurt of een onderhoudsbeurt, zodat je motor in het voorjaar klaarstaat.','/winterstalling','Alles over winterstalling',2),
('werkplaats','Maken jullie mijn motor klaar voor het nieuwe seizoen?','Ja. Met de seizoensklaarbeurt van {tarief:seizoensklaarmaak} controleert de werkplaats je motor na de winter, zodat je veilig het seizoen start. Combineer je het met onderhoud, dan plannen we dat in één afspraak.',null,null,3),
('bezoek','Waar zit De Jonge Motoren?','De Jonge Motoren zit aan de Stevinweg 14, 4691 SM Tholen, in Zeeland en vlak bij Bergen op Zoom.','/contact','Route en contact',1)
) as v(groep, vraag, antwoord, link_href, link_label, volgorde)
where not exists (select 1 from public.website_faq);
