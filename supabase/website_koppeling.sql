-- Koppeling website ↔ database rechtgezet (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "website_koppeling_en_realtime".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Aanleiding (analyse van de website-code, repo djm-website):
--  * maak_afspraak gaf bij een weigering {success:false} terug met HTTP 200; de website
--    kijkt alleen naar `error` en toonde dan "Bedankt" terwijl er niets was opgeslagen.
--    → weigeringen geven nu een echte fout (RAISE); de website toont dan "Versturen lukte niet".
--  * Zonder gekozen datum stuurt de website de datum van vandaag mee. Zo'n aanvraag werd
--    geweigerd als vandaag vol/gesloten was, of bezette de enige plek van vandaag.
--    → geen datum (NULL) of vandaag = aanvraag zonder gekozen dag (dag_gekozen = false).
--  * get_drukke_datums (gebruikt door de website om volle dagen te tonen) telde anders dan
--    de regel in de database. → telt nu precies zoals private.telt_voor_dagcapaciteit.
--  * Recent verkochte motoren (met kenteken en koper-id) waren leesbaar voor iedereen.
--    → alleen nog voor ingelogde gebruikers; de website toont alleen beschikbaar/gereserveerd.

-- 1. Websiteformulier: afspraak/proefrit aanvragen
CREATE OR REPLACE FUNCTION public.maak_afspraak(p_naam text, p_telefoon text, p_email text DEFAULT NULL::text, p_datum date DEFAULT CURRENT_DATE, p_type text DEFAULT 'proefrit'::text, p_voorraad_motor_id uuid DEFAULT NULL::uuid, p_opmerking text DEFAULT NULL::text, p_soort text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count          int;
  v_dag_code       text;
  v_openingstijden jsonb;
  v_gesloten_dagen text[];
  -- Geen datum, of vandaag (de website vult vandaag in als er niets gekozen is):
  -- een aanvraag zonder vaste dag; de beheerder plant hem in.
  v_zonder_dag     boolean := p_datum IS NULL OR p_datum = CURRENT_DATE;
BEGIN
  IF p_type NOT IN ('proefrit', 'service') THEN
    RAISE EXCEPTION 'Ongeldig type afspraak.';
  END IF;

  IF length(COALESCE(p_naam, '')) > 100 OR length(COALESCE(p_telefoon, '')) > 30
     OR length(COALESCE(p_email, '')) > 254 OR length(COALESCE(p_opmerking, '')) > 4000
     OR length(COALESCE(p_soort, '')) > 200 THEN
    RAISE EXCEPTION 'Een van de velden is te lang.';
  END IF;

  IF length(trim(COALESCE(p_naam, ''))) < 2 THEN
    RAISE EXCEPTION 'Vul een geldige naam in.';
  END IF;

  IF length(regexp_replace(COALESCE(p_telefoon, ''), '[^0-9]', '', 'g')) < 9 THEN
    RAISE EXCEPTION 'Vul een geldig telefoonnummer in.';
  END IF;

  -- Max 3 aanvragen per telefoonnummer per 24 uur
  SELECT COUNT(*) INTO v_count
  FROM afspraken
  WHERE telefoon = trim(p_telefoon)
    AND created_at > NOW() - INTERVAL '24 hours';
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Er zijn al meerdere aanvragen met dit telefoonnummer verstuurd. Bel ons direct op 0166-606090.';
  END IF;

  IF NOT v_zonder_dag THEN
    IF p_datum < CURRENT_DATE THEN
      RAISE EXCEPTION 'Kies een datum in de toekomst.';
    END IF;
    IF p_datum > CURRENT_DATE + 365 THEN
      RAISE EXCEPTION 'Kies een datum binnen een jaar.';
    END IF;

    SELECT openingstijden, gesloten_dagen INTO v_openingstijden, v_gesloten_dagen
    FROM instellingen WHERE id = 1;

    IF p_datum::text = ANY(COALESCE(v_gesloten_dagen, '{}'::text[])) THEN
      RAISE EXCEPTION 'Wij zijn op die datum gesloten. Kies een andere datum of bel ons.';
    END IF;

    v_dag_code := (ARRAY['zo','ma','di','wo','do','vr','za'])[EXTRACT(DOW FROM p_datum)::int + 1];
    IF COALESCE((v_openingstijden->v_dag_code->>'gesloten')::boolean, true) THEN
      RAISE EXCEPTION 'Wij zijn op die dag gesloten. Kies een andere datum.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM afspraken a
    WHERE a.datum = p_datum AND private.telt_voor_dagcapaciteit(a.status, a.dag_gekozen);
    IF v_count >= private.max_afspraken_per_dag() THEN
      RAISE EXCEPTION 'Deze dag zit vol. Kies een andere datum of bel ons op 0166-606090.';
    END IF;
  END IF;

  -- (de trigger afspraken_dagcapaciteit controleert de dag nogmaals, ook bij gelijktijdig boeken)
  INSERT INTO afspraken (naam, telefoon, email, datum, dag_gekozen, type, voorraad_motor_id, status, opmerking, soort)
  VALUES (
    trim(p_naam),
    trim(p_telefoon),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    COALESCE(p_datum, CURRENT_DATE),
    NOT v_zonder_dag,
    p_type,
    p_voorraad_motor_id,
    'aangevraagd',
    p_opmerking,
    p_soort
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2. Volle dagen voor de website: zelfde telling als de database-regel
CREATE OR REPLACE FUNCTION public.get_drukke_datums(start_datum date, eind_datum date)
 RETURNS TABLE(datum date, aantal bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT a.datum, COUNT(*)::bigint AS aantal
  FROM public.afspraken a
  WHERE a.datum BETWEEN start_datum AND LEAST(eind_datum, start_datum + 400)
    AND private.telt_voor_dagcapaciteit(a.status, a.dag_gekozen)
  GROUP BY a.datum;
$function$;

-- 3. Recent verkochte motoren alleen voor ingelogde gebruikers (klantportaal); de website
--    (anoniem) gebruikt "Public read beschikbaar voorraad" (beschikbaar/gereserveerd).
ALTER POLICY voorraad_klant_select ON public.voorraad TO authenticated;

-- 4. Live bijwerken van nieuwe klantaanmeldingen in de beheer-app (kanaal admin-klanten).
--    Realtime past RLS toe: een klant krijgt alleen zijn eigen rij door, de beheerder alles.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'klanten') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.klanten;
  END IF;
END $$;

-- 5. Index op de koppeling push-abonnement → gebruiker
CREATE INDEX IF NOT EXISTS push_abonnementen_user_id_idx ON public.push_abonnementen (user_id);
