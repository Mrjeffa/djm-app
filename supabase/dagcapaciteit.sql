-- Dagcapaciteit: één regel voor website, klantportaal en database.
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "dagcapaciteit".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Regel: een dag is vol bij instellingen.max_afspraken_per_dag afspraken (ingesteld op 1,
-- aan te passen in Admin → Instellingen). Telt mee: elke afspraak die niet geannuleerd is,
-- behalve een aanvraag zonder gekozen dag (bv. zoekopdracht, aankoopkeuring of een
-- schademelding zonder datum) zolang de beheerder hem nog niet heeft ingepland.
-- De beheerder zelf mag altijd inplannen, ook op een volle dag.

-- Heeft de klant/website zelf een dag gekozen? (aanvragen zonder dag krijgen de datum
-- van vandaag, maar bezetten die dag niet)
ALTER TABLE public.afspraken ADD COLUMN IF NOT EXISTS dag_gekozen boolean NOT NULL DEFAULT true;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.telt_voor_dagcapaciteit(p_status text, p_dag_gekozen boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT p_status IS DISTINCT FROM 'geannuleerd'
     AND (COALESCE(p_dag_gekozen, true) OR p_status IS DISTINCT FROM 'aangevraagd');
$function$;

CREATE OR REPLACE FUNCTION private.max_afspraken_per_dag()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT GREATEST(1, COALESCE((SELECT i.max_afspraken_per_dag FROM public.instellingen i WHERE i.id = 1), 1));
$function$;

-- Volle dagen voor de datumkiezer in het klantportaal (alleen datums, geen gegevens)
CREATE OR REPLACE FUNCTION public.get_bezette_dagen()
 RETURNS TABLE(datum date)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT a.datum
  FROM public.afspraken a
  WHERE a.datum >= CURRENT_DATE AND private.telt_voor_dagcapaciteit(a.status, a.dag_gekozen)
  GROUP BY a.datum
  HAVING count(*) >= private.max_afspraken_per_dag()
  ORDER BY a.datum;
$function$;

-- De database bewaakt de regel zelf: een klant (of de website) kan geen afspraak meer
-- invoegen op een volle dag, ook niet buiten de app om.
CREATE OR REPLACE FUNCTION private.bewaak_dagcapaciteit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_aantal int;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF; -- de beheerder plant zelf in, ook op een volle dag
  IF TG_OP = 'UPDATE' THEN
    IF NEW.dag_gekozen IS DISTINCT FROM OLD.dag_gekozen THEN
      RAISE EXCEPTION 'Afspraken kunnen alleen door De Jonge Motoren gewijzigd worden';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.datum IS NULL OR NOT private.telt_voor_dagcapaciteit(NEW.status, NEW.dag_gekozen) THEN
    RETURN NEW;
  END IF;
  -- Twee aanvragen tegelijk voor dezelfde dag: na elkaar afhandelen
  PERFORM pg_advisory_xact_lock(hashtext('djm_dagcapaciteit'), NEW.datum - DATE '2000-01-01');
  SELECT count(*) INTO v_aantal FROM public.afspraken a
   WHERE a.datum = NEW.datum AND private.telt_voor_dagcapaciteit(a.status, a.dag_gekozen);
  IF v_aantal >= private.max_afspraken_per_dag() THEN
    RAISE EXCEPTION 'Deze dag zit vol. Kies een andere dag.';
  END IF;
  RETURN NEW;
END;
$function$;
-- Na afspraken_bewaak (alfabetisch), zodat de status dan al 'aangevraagd' is
CREATE OR REPLACE TRIGGER afspraken_dagcapaciteit BEFORE INSERT OR UPDATE ON public.afspraken
  FOR EACH ROW EXECUTE FUNCTION private.bewaak_dagcapaciteit();

-- Website-formulier: dezelfde regel
CREATE OR REPLACE FUNCTION public.maak_afspraak(p_naam text, p_telefoon text, p_email text DEFAULT NULL::text, p_datum date DEFAULT CURRENT_DATE, p_type text DEFAULT 'proefrit'::text, p_voorraad_motor_id uuid DEFAULT NULL::uuid, p_opmerking text DEFAULT NULL::text, p_soort text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count       int;
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
  SELECT openingstijden, gesloten_dagen
  INTO v_openingstijden, v_gesloten_dagen
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

  -- Check dagcapaciteit (zelfde regel als het klantportaal, zie private.telt_voor_dagcapaciteit)
  SELECT COUNT(*) INTO v_count
  FROM afspraken a
  WHERE a.datum = p_datum AND private.telt_voor_dagcapaciteit(a.status, a.dag_gekozen);

  IF v_count >= private.max_afspraken_per_dag() THEN
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
  IF SQLERRM LIKE 'Deze dag zit vol%' THEN -- tegelijk door iemand anders volgeboekt
    RETURN jsonb_build_object('success', false, 'fout', 'Deze dag zit vol. Kies een andere datum of bel ons op 0166-606090.');
  END IF;
  RETURN jsonb_build_object('success', false, 'fout', 'Er is een technische fout opgetreden. Bel ons op 0166-606090.');
END;
$function$;

-- Maximaal 1 afspraak per dag (handmatig, vraagt goedkeuring; of via Admin → Instellingen):
-- UPDATE public.instellingen SET max_afspraken_per_dag = 1 WHERE id = 1;
