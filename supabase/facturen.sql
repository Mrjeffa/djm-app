-- Facturen (Excel) en prijslijst (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "facturen_prijslijst".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Hoe het werkt:
--  * beheer_instellingen: instellingen die alleen de beheerder mag zien (de tabel instellingen
--    is voor iedereen leesbaar). Nu: laatste_factuurnummer, het nummer van de laatst gemaakte
--    factuur. De volgende factuur krijgt +1; handmatig aan te passen in Instellingen en per factuur.
--  * prijslijst: artikelen met prijzen ex btw (en inkoop), voor de factuurregels. Wordt in
--    Instellingen als Excel gedownload, aangevuld en weer geüpload; uploaden vervangt de hele
--    lijst in één keer (vervang_prijslijst), zodat er nooit een halve lijst staat.
--  * Een gemaakte factuur zelf wordt niet bewaard (de zaak slaat het Excel-bestand op); het
--    gebruikte nummer en de datum staan in de onderhoudslijst van de afspraak (lijst.factuur).

-- 1. Instellingen alleen voor de beheerder
CREATE TABLE IF NOT EXISTS public.beheer_instellingen (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  laatste_factuurnummer bigint CHECK (laatste_factuurnummer IS NULL OR laatste_factuurnummer >= 0),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
-- Beginwaarde uit het Excel-sjabloon van de zaak ("Laatst gebruikt factuurnr")
INSERT INTO public.beheer_instellingen (id, laatste_factuurnummer) VALUES (1, 2026268)
  ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.beheer_instellingen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS beheer_instellingen_admin ON public.beheer_instellingen;
CREATE POLICY beheer_instellingen_admin ON public.beheer_instellingen
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
REVOKE ALL ON public.beheer_instellingen FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.beheer_instellingen TO authenticated;

-- 2. Prijslijst (alleen beheerder: bevat inkoopprijzen)
CREATE TABLE IF NOT EXISTS public.prijslijst (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  omschrijving text NOT NULL CHECK (length(trim(omschrijving)) BETWEEN 1 AND 300),
  artikelnummer text CHECK (artikelnummer IS NULL OR length(artikelnummer) <= 100),
  jm_nummer text CHECK (jm_nummer IS NULL OR length(jm_nummer) <= 50),
  inkoop numeric(10,2),
  verkoop numeric(10,2),
  volgorde int NOT NULL DEFAULT 0
);
ALTER TABLE public.prijslijst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prijslijst_admin ON public.prijslijst;
CREATE POLICY prijslijst_admin ON public.prijslijst
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
REVOKE ALL ON public.prijslijst FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prijslijst TO authenticated;

-- 3. Hele prijslijst in één keer vervangen (upload). Met de rechten van de aanroeper: RLS geldt.
CREATE OR REPLACE FUNCTION public.vervang_prijslijst(regels jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;
  IF jsonb_typeof(regels) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ongeldige prijslijst'; END IF;
  IF jsonb_array_length(regels) > 20000 THEN RAISE EXCEPTION 'Prijslijst te groot (max 20.000 regels)'; END IF;
  DELETE FROM public.prijslijst WHERE true;
  INSERT INTO public.prijslijst (omschrijving, artikelnummer, jm_nummer, inkoop, verkoop, volgorde)
  SELECT left(trim(x.omschrijving), 300), nullif(left(trim(x.artikelnummer), 100), ''), nullif(left(trim(x.jm_nummer), 50), ''),
         x.inkoop, x.verkoop, coalesce(x.volgorde, 0)
  FROM jsonb_to_recordset(regels) AS x(omschrijving text, artikelnummer text, jm_nummer text, inkoop numeric, verkoop numeric, volgorde int)
  WHERE coalesce(trim(x.omschrijving), '') <> '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;
REVOKE ALL ON FUNCTION public.vervang_prijslijst(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vervang_prijslijst(jsonb) TO authenticated;
