-- Winterstalling (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "winterstalling".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Hoe het werkt:
--  * winterstalling: één regel per motor per seizoen. Seizoen = het jaar waarin de winter
--    begint (2026 = winter 2026/2027). Status: aangevraagd (website/klantportaal) →
--    gereserveerd → binnen → opgehaald. Klant en motor zijn gekoppeld als ze bekend zijn; naam,
--    contact en motorgegevens staan er ook los in (aanvraag van iemand die nog geen klant is,
--    of als een klant later wordt verwijderd).
--  * Website: vraag_winterstalling_aan() (anoniem), met controles en een rem op misbruik.
--  * Klantportaal: een goedgekeurde klant mag een aanvraag voor zichzelf toevoegen (alleen
--    status aangevraagd, geen interne velden). Lezen en wijzigen: alleen de beheerder.
--  * Pushmelding aan de beheerder bij een nieuwe aanvraag (trigger → push-melding).
--  * klanten.email is optioneel geworden: veel stallingsklanten hebben geen e-mailadres. Leeg =
--    NULL (uniek blijft gelden voor ingevulde adressen).

-- 1. E-mailadres van een klant optioneel
ALTER TABLE public.klanten ALTER COLUMN email DROP NOT NULL;
UPDATE public.klanten SET email = NULL WHERE email IS NOT NULL AND trim(email) = '';

-- 2. De tabel
CREATE TABLE IF NOT EXISTS public.winterstalling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seizoen int NOT NULL CHECK (seizoen BETWEEN 2000 AND 2100),
  nummer int CHECK (nummer IS NULL OR nummer BETWEEN 1 AND 9999),
  status text NOT NULL DEFAULT 'gereserveerd' CHECK (status IN ('aangevraagd', 'gereserveerd', 'binnen', 'opgehaald')),
  klant_id uuid REFERENCES public.klanten(id) ON DELETE SET NULL,
  motor_id uuid REFERENCES public.motoren(id) ON DELETE SET NULL,
  naam text CHECK (naam IS NULL OR length(naam) <= 100),
  telefoon text CHECK (telefoon IS NULL OR length(telefoon) <= 30),
  email text CHECK (email IS NULL OR length(email) <= 254),
  merk text CHECK (merk IS NULL OR length(merk) <= 60),
  model text CHECK (model IS NULL OR length(model) <= 80),
  kenteken text CHECK (kenteken IS NULL OR length(kenteken) <= 20),
  pakket text CHECK (pakket IS NULL OR length(pakket) <= 100),
  werkzaamheden text CHECK (werkzaamheden IS NULL OR length(werkzaamheden) <= 2000),
  opmerking text CHECK (opmerking IS NULL OR length(opmerking) <= 2000),
  betaald boolean NOT NULL DEFAULT false,
  betaalwijze text CHECK (betaalwijze IS NULL OR betaalwijze IN ('contant', 'pin', 'bank')),
  binnen_op date,
  opgehaald_op date,
  bron text NOT NULL DEFAULT 'beheer' CHECK (bron IN ('beheer', 'website', 'klantportaal', 'import', 'doorgezet')),
  doorgezet_van uuid REFERENCES public.winterstalling(id) ON DELETE SET NULL,
  aangemaakt timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS winterstalling_seizoen ON public.winterstalling (seizoen, nummer);
CREATE INDEX IF NOT EXISTS winterstalling_klant ON public.winterstalling (klant_id);
CREATE INDEX IF NOT EXISTS winterstalling_motor ON public.winterstalling (motor_id);
-- Een motor staat maar één keer per seizoen op de lijst (ook niet dubbel doorgezet)
CREATE UNIQUE INDEX IF NOT EXISTS winterstalling_motor_per_seizoen
  ON public.winterstalling (seizoen, motor_id) WHERE motor_id IS NOT NULL;

ALTER TABLE public.winterstalling ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS winterstalling_admin ON public.winterstalling;
CREATE POLICY winterstalling_admin ON public.winterstalling
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
-- Klantportaal: aanvraag voor zichzelf (en eventueel een eigen motor), zonder interne velden
DROP POLICY IF EXISTS winterstalling_klant_aanvraag ON public.winterstalling;
CREATE POLICY winterstalling_klant_aanvraag ON public.winterstalling
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'aangevraagd' AND bron = 'klantportaal' AND NOT betaald AND betaalwijze IS NULL
    AND binnen_op IS NULL AND opgehaald_op IS NULL AND nummer IS NULL AND doorgezet_van IS NULL
    AND opmerking IS NULL
    AND klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid()) AND k.status = 'goedgekeurd')
    AND (motor_id IS NULL OR motor_id IN (SELECT m.id FROM public.motoren m WHERE m.klant_id = winterstalling.klant_id))
  );
REVOKE ALL ON public.winterstalling FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.winterstalling TO authenticated;

-- 3. Aanvraag via de website (anoniem)
CREATE OR REPLACE FUNCTION public.vraag_winterstalling_aan(
  p_naam text, p_telefoon text, p_email text DEFAULT NULL, p_merk text DEFAULT NULL,
  p_model text DEFAULT NULL, p_kenteken text DEFAULT NULL, p_pakket text DEFAULT NULL,
  p_opmerking text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_aantal int;
  v_seizoen int;
  v_tel text := regexp_replace(coalesce(p_telefoon, ''), '[^0-9]', '', 'g');
BEGIN
  IF length(coalesce(p_naam, '')) > 100 OR length(coalesce(p_telefoon, '')) > 30
     OR length(coalesce(p_email, '')) > 254 OR length(coalesce(p_merk, '')) > 60
     OR length(coalesce(p_model, '')) > 80 OR length(coalesce(p_kenteken, '')) > 20
     OR length(coalesce(p_pakket, '')) > 100 OR length(coalesce(p_opmerking, '')) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Een van de velden is te lang.');
  END IF;
  IF length(trim(coalesce(p_naam, ''))) < 2 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul je naam in.');
  END IF;
  IF length(v_tel) < 9 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul een geldig telefoonnummer in.');
  END IF;
  IF length(trim(coalesce(p_merk, ''))) < 2 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul het merk van je motor in.');
  END IF;
  IF nullif(trim(coalesce(p_email, '')), '') IS NOT NULL AND trim(p_email) !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Vul een geldig e-mailadres in.');
  END IF;
  -- Rem op misbruik: max 3 per telefoonnummer per 24 uur, max 30 per uur in totaal
  SELECT count(*) INTO v_aantal FROM public.winterstalling
   WHERE bron = 'website' AND regexp_replace(coalesce(telefoon, ''), '[^0-9]', '', 'g') = v_tel
     AND aangemaakt > now() - interval '24 hours';
  IF v_aantal >= 3 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Er zijn vandaag al aanvragen met dit telefoonnummer verstuurd. Bel ons op 0166-606090.');
  END IF;
  SELECT count(*) INTO v_aantal FROM public.winterstalling
   WHERE bron = 'website' AND aangemaakt > now() - interval '1 hour';
  IF v_aantal >= 30 THEN
    RETURN jsonb_build_object('success', false, 'fout', 'Het is even erg druk. Probeer het later opnieuw of bel ons op 0166-606090.');
  END IF;
  -- Januari t/m maart: de lopende winter; vanaf april: de komende winter
  v_seizoen := extract(year FROM current_date)::int - CASE WHEN extract(month FROM current_date) < 4 THEN 1 ELSE 0 END;
  INSERT INTO public.winterstalling (seizoen, status, naam, telefoon, email, merk, model, kenteken, pakket, werkzaamheden, bron)
  VALUES (v_seizoen, 'aangevraagd', trim(p_naam), trim(p_telefoon), nullif(lower(trim(coalesce(p_email, ''))), ''),
          trim(p_merk), nullif(trim(coalesce(p_model, '')), ''),
          nullif(upper(regexp_replace(coalesce(p_kenteken, ''), '[^A-Za-z0-9]', '', 'g')), ''),
          nullif(trim(coalesce(p_pakket, '')), ''), nullif(trim(coalesce(p_opmerking, '')), ''), 'website');
  RETURN jsonb_build_object('success', true, 'seizoen', v_seizoen);
END;
$function$;
REVOKE ALL ON FUNCTION public.vraag_winterstalling_aan(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vraag_winterstalling_aan(text, text, text, text, text, text, text, text) TO anon, authenticated;

-- 4. Pushmelding bij een nieuwe aanvraag (de functie push-melding leest de regel zelf)
CREATE OR REPLACE TRIGGER push_winterstalling AFTER INSERT ON public.winterstalling
  FOR EACH ROW WHEN (NEW.status = 'aangevraagd') EXECUTE FUNCTION private.meld_push('nieuw');

-- 5. Live bijwerken in de beheer-app (nieuwe aanvragen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'winterstalling') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.winterstalling;
  END IF;
END $$;

-- 6. Aantal stallingsplaatsen (alleen beheerder)
ALTER TABLE public.beheer_instellingen
  ADD COLUMN IF NOT EXISTS winterstalling_plaatsen int CHECK (winterstalling_plaatsen IS NULL OR winterstalling_plaatsen BETWEEN 0 AND 9999);
