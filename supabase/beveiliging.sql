-- Beveiliging & schaalbaarheid voor Supabase (project xftnovnldcdfohqlqgor),
-- migratie "beveiliging_hardening". Herhaalbaar: opnieuw draaien geeft geen fouten.
-- Controle achteraf: Supabase → Advisors (security/performance) en
-- .github/workflows/beveiligingstest.yml.

-- 1. Triggerfuncties hoeven niet via de API aanroepbaar te zijn.
--    (Triggers blijven werken: EXECUTE wordt alleen bij CREATE TRIGGER gecontroleerd.)
REVOKE EXECUTE ON FUNCTION public.bewaak_afspraken_mutaties() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bewaak_klanten_mutaties()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()      FROM PUBLIC, anon, authenticated;

-- 2. pg_trgm hoort niet in het publieke API-schema (wordt nergens gebruikt).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
             WHERE e.extname = 'pg_trgm' AND n.nspname = 'public') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- 3. Dubbele leesregel op instellingen (instellingen_lezen dekt anon al).
DROP POLICY IF EXISTS "Publiek kan instellingen lezen" ON public.instellingen;

-- 4. RLS: auth.uid()/auth.jwt()/is_admin() één keer per query i.p.v. per rij
--    (zelfde betekenis, sneller bij veel klanten).
ALTER POLICY admin_eigen_lezen ON public.admins
  USING (id = (SELECT auth.uid()));

ALTER POLICY klant_eigen ON public.klanten
  USING ((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));
ALTER POLICY klant_koppel_zichzelf ON public.klanten
  USING ((email = ((SELECT auth.jwt()) ->> 'email')) AND (user_id IS NULL))
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY klant_zoek_op_email ON public.klanten
  USING (email = ((SELECT auth.jwt()) ->> 'email'));
ALTER POLICY klanten_self_insert ON public.klanten
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY motor_eigen ON public.motoren
  USING ((klant_id IN (SELECT klanten.id FROM public.klanten WHERE klanten.user_id = (SELECT auth.uid())))
         OR (SELECT public.is_admin()));

ALTER POLICY km_eigen ON public.km_historie
  USING ((motor_id IN (SELECT m.id FROM public.motoren m JOIN public.klanten k ON m.klant_id = k.id
                       WHERE k.user_id = (SELECT auth.uid())))
         OR (SELECT public.is_admin()));

ALTER POLICY service_lezen ON public.service_beurten
  USING ((motor_id IN (SELECT m.id FROM public.motoren m JOIN public.klanten k ON m.klant_id = k.id
                       WHERE k.user_id = (SELECT auth.uid())))
         OR (SELECT public.is_admin()));
ALTER POLICY service_beurten_klant_insert ON public.service_beurten
  WITH CHECK ((klant_invoer = true) AND EXISTS (
    SELECT 1 FROM public.motoren m JOIN public.klanten k ON k.id = m.klant_id
    WHERE m.id = service_beurten.motor_id AND k.user_id = (SELECT auth.uid())));
ALTER POLICY service_beurten_klant_update ON public.service_beurten
  USING ((klant_invoer = true) AND EXISTS (
    SELECT 1 FROM public.motoren m JOIN public.klanten k ON k.id = m.klant_id
    WHERE m.id = service_beurten.motor_id AND k.user_id = (SELECT auth.uid())))
  WITH CHECK ((klant_invoer = true) AND EXISTS (
    SELECT 1 FROM public.motoren m JOIN public.klanten k ON k.id = m.klant_id
    WHERE m.id = service_beurten.motor_id AND k.user_id = (SELECT auth.uid())));

ALTER POLICY eigen_taken ON public.taken
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY admin_only ON public.klussen          USING ((SELECT public.is_admin()));
ALTER POLICY admin_only ON public.voorraad_service USING ((SELECT public.is_admin()));

ALTER POLICY afspraak_eigen_select ON public.afspraken
  USING ((klant_id IN (SELECT klanten.id FROM public.klanten WHERE klanten.user_id = (SELECT auth.uid())))
         OR (SELECT public.is_admin()));
ALTER POLICY afspraak_eigen_update ON public.afspraken
  USING ((klant_id IN (SELECT klanten.id FROM public.klanten WHERE klanten.user_id = (SELECT auth.uid())))
         OR (SELECT public.is_admin()));
-- Klant mag alleen een afspraak aanvragen voor zijn eigen motor (of zonder motor).
ALTER POLICY afspraak_eigen_insert ON public.afspraken
  WITH CHECK (
    ((klant_id IN (SELECT klanten.id FROM public.klanten WHERE klanten.user_id = (SELECT auth.uid())))
      AND (motor_id IS NULL OR motor_id IN (
        SELECT m.id FROM public.motoren m JOIN public.klanten k ON m.klant_id = k.id
        WHERE k.user_id = (SELECT auth.uid()))))
    OR (SELECT public.is_admin()));

-- 5. Publieke formulieren (website): invoerlimieten tegen misbruik.
CREATE OR REPLACE FUNCTION public.maak_afspraak(p_naam text, p_telefoon text, p_email text DEFAULT NULL::text, p_datum date DEFAULT CURRENT_DATE, p_type text DEFAULT 'proefrit'::text, p_voorraad_motor_id uuid DEFAULT NULL::uuid, p_opmerking text DEFAULT NULL::text, p_soort text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count       int;
  v_max_per_dag int;
  v_dag_code    text;
  v_openingstijden jsonb;
  v_gesloten_dagen text[];
  v_is_gesloten bool;
BEGIN
  -- Valideer type
  IF p_type NOT IN ('proefrit', 'service') THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Ongeldig type afspraak.');
  END IF;

  -- Invoerlimieten (publiek formulier)
  IF length(COALESCE(p_naam, '')) > 100 OR length(COALESCE(p_telefoon, '')) > 30
     OR length(COALESCE(p_email, '')) > 254 OR length(COALESCE(p_opmerking, '')) > 4000
     OR length(COALESCE(p_soort, '')) > 200 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Een van de velden is te lang.');
  END IF;

  -- Valideer naam
  IF length(trim(COALESCE(p_naam, ''))) < 2 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul een geldige naam in.');
  END IF;

  -- Valideer telefoonnummer (minstens 9 tekens)
  IF length(regexp_replace(COALESCE(p_telefoon, ''), '[^0-9]', '', 'g')) < 9 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul een geldig telefoonnummer in.');
  END IF;

  -- Rate limiting: max 3 aanvragen per telefoonnummer per 24 uur
  SELECT COUNT(*) INTO v_count
  FROM afspraken
  WHERE telefoon = trim(p_telefoon)
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'fout', 'Er zijn al meerdere aanvragen met dit telefoonnummer vandaag verstuurd. Bel ons direct op 0166-606090.'
    );
  END IF;

  -- Datum niet in het verleden en niet verder dan een jaar vooruit
  IF p_datum IS NULL OR p_datum < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Kies een datum in de toekomst.');
  END IF;
  IF p_datum > CURRENT_DATE + 365 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Kies een datum binnen een jaar.');
  END IF;

  -- Haal instellingen op
  SELECT openingstijden, gesloten_dagen, COALESCE(max_afspraken_per_dag, 5)
  INTO v_openingstijden, v_gesloten_dagen, v_max_per_dag
  FROM instellingen WHERE id = 1;

  -- Check gesloten_dag
  IF p_datum::text = ANY(COALESCE(v_gesloten_dagen, '{}'::text[])) THEN
    RETURN jsonb_build_object(
      'success', false,
      'fout', 'Wij zijn op die datum gesloten. Kies een andere datum of bel ons.'
    );
  END IF;

  -- Check weekdag gesloten
  v_dag_code := CASE EXTRACT(DOW FROM p_datum)::int
    WHEN 0 THEN 'zo' WHEN 1 THEN 'ma' WHEN 2 THEN 'di'
    WHEN 3 THEN 'wo' WHEN 4 THEN 'do' WHEN 5 THEN 'vr' WHEN 6 THEN 'za'
  END;

  v_is_gesloten := COALESCE((v_openingstijden->v_dag_code->>'gesloten')::boolean, true);
  IF v_is_gesloten THEN
    RETURN jsonb_build_object(
      'success', false,
      'fout', 'Wij zijn op die dag gesloten. Kies een andere datum.'
    );
  END IF;

  -- Check dagcapaciteit
  SELECT COUNT(*) INTO v_count
  FROM afspraken
  WHERE datum = p_datum AND status != 'geannuleerd';

  IF v_count >= v_max_per_dag THEN
    RETURN jsonb_build_object(
      'success', false,
      'fout', 'Deze dag zit vol. Kies een andere datum of bel ons op 0166-606090.'
    );
  END IF;

  -- Afspraak aanmaken
  INSERT INTO afspraken (naam, telefoon, email, datum, type, voorraad_motor_id, status, opmerking, soort)
  VALUES (
    trim(p_naam),
    trim(p_telefoon),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    p_datum,
    p_type,
    p_voorraad_motor_id,
    'aangevraagd',
    p_opmerking,
    p_soort
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'fout', 'Er is een technische fout opgetreden. Bel ons op 0166-606090.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.maak_inkoop_lead(p_naam text, p_telefoon text, p_merk text DEFAULT NULL::text, p_model text DEFAULT NULL::text, p_bouwjaar integer DEFAULT NULL::integer, p_km integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  p_naam     := trim(COALESCE(p_naam, ''));
  p_telefoon := trim(COALESCE(p_telefoon, ''));
  IF p_naam = '' OR p_telefoon = '' THEN
    RAISE EXCEPTION 'Naam en telefoonnummer zijn verplicht';
  END IF;
  -- Invoerlimieten (publiek formulier)
  IF length(p_naam) > 100 OR length(p_telefoon) > 30
     OR length(COALESCE(p_merk, '')) > 50 OR length(COALESCE(p_model, '')) > 100 THEN
    RAISE EXCEPTION 'Een van de velden is te lang';
  END IF;
  IF p_bouwjaar IS NOT NULL AND (p_bouwjaar < 1900 OR p_bouwjaar > EXTRACT(YEAR FROM now())::int + 1) THEN
    RAISE EXCEPTION 'Ongeldig bouwjaar';
  END IF;
  IF p_km IS NOT NULL AND (p_km < 0 OR p_km > 2000000) THEN
    RAISE EXCEPTION 'Ongeldige km-stand';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM inkoop_aanvragen
  WHERE telefoon = p_telefoon
    AND created_at > now() - interval '24 hours';
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Te veel aanvragen. Bel ons direct op 0166-606090.';
  END IF;
  INSERT INTO inkoop_aanvragen (naam, telefoon, merk, model, bouwjaar, km)
  VALUES (p_naam, p_telefoon, p_merk, p_model, p_bouwjaar, p_km);
END;
$function$;
