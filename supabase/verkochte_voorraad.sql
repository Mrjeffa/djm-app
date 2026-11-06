-- Verkochte motoren 30 dagen zichtbaar op de website en in het klantportaal, zonder
-- kenteken en koper (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migraties
-- "verkochte_voorraad_publiek" (deel 1) en "verkochte_voorraad_klant_policy" (deel 2).
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Wat waar staat:
--  * kenteken, verkocht_aan (klantnummer van de koper): kolommen in voorraad → hieronder afgeschermd
--  * chassisnummer: tabel voorraad_chassis (alleen beheerder)
--  * interne opmerking: tabel voorraad_intern (alleen beheerder)
--  * inkoopprijs: tabel voorraad_inkoop (alleen beheerder)

-- ── Deel 1 ──────────────────────────────────────────────────────────────────

-- 1a. Website (anoniem): alleen de kolommen die de website gebruikt + verkocht_op.
--     Kenteken, verkocht_aan, onderdelen-link, banden en fotos_bewaren_tot zijn voor een
--     bezoeker niet meer op te vragen, ook niet rechtstreeks via de API.
REVOKE SELECT ON public.voorraad FROM anon;
GRANT SELECT (id, merk, model, bouwjaar, km, km_eenheid, prijs, type, carrosserietype, vermogen,
              kleur, uitvoering, uitrusting, beschrijving, fotos, status, datum_in, created_at,
              verkocht_op)
  ON public.voorraad TO anon;

-- 1b. Welke rijen een bezoeker ziet: te koop (beschikbaar/gereserveerd), of verkocht in de
--     afgelopen 30 dagen. Verkocht = verkocht_op gevuld (niet de status: oudere verkopen
--     hebben soms nog status "beschikbaar").
ALTER POLICY "Public read beschikbaar voorraad" ON public.voorraad
  USING (
    (verkocht_op IS NULL AND status IN ('beschikbaar', 'gereserveerd'))
    OR (verkocht_op IS NOT NULL AND verkocht_op >= CURRENT_DATE - 30 AND status IS DISTINCT FROM 'verwijderd')
  );

-- 1c. Klantportaal (ingelogd): leest de voorraad via deze functie i.p.v. de tabel. Het
--     beheerdersaccount is ook "ingelogd", dus kolommen afschermen per rol kan hier niet;
--     de functie geeft alleen veilige kolommen. Kenteken alleen van motoren die nog te koop
--     zijn (bij verkochte motoren is het kenteken van de nieuwe eigenaar).
CREATE OR REPLACE FUNCTION public.voorraad_overzicht()
 RETURNS TABLE(id uuid, merk text, model text, bouwjaar integer, km integer, km_eenheid text,
               prijs integer, fotos jsonb, kenteken text, status text, datum_in date,
               verkocht_op date, fotos_bewaren_tot date, voorband_datum text,
               achterband_datum text, created_at timestamptz)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT v.id, v.merk, v.model, v.bouwjaar, v.km, v.km_eenheid, v.prijs, v.fotos,
         CASE WHEN v.verkocht_op IS NULL THEN v.kenteken END,
         v.status, v.datum_in, v.verkocht_op, v.fotos_bewaren_tot,
         v.voorband_datum, v.achterband_datum, v.created_at
  FROM public.voorraad v
  WHERE (v.verkocht_op IS NULL AND v.status IN ('beschikbaar', 'gereserveerd'))
     OR (v.verkocht_op IS NOT NULL AND v.verkocht_op >= CURRENT_DATE - 30 AND v.status IS DISTINCT FROM 'verwijderd')
  ORDER BY v.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.voorraad_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voorraad_overzicht() TO authenticated;

-- ── Deel 2 (pas toepassen als de app met voorraad_overzicht live staat) ───────

-- Klanten lezen de tabel niet meer rechtstreeks (anders zouden ze via de API alsnog
-- kenteken en verkocht_aan van verkochte motoren kunnen opvragen). De beheerder houdt
-- alles via de policy voorraad_admin.
DROP POLICY IF EXISTS voorraad_klant_select ON public.voorraad;
