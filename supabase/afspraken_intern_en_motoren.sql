-- Interne opmerkingen bij afspraken afschermen + garage-onderhoud bewaren als een
-- klant zijn motor verwijdert.
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migraties
-- "afspraken_intern_tabel_en_motor_policies" en "klant_motor_verwijderen_zonder_garagehistorie".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.

-- ── 1. Interne opmerking bij een afspraak: aparte tabel, alleen de beheerder ─────
-- Een klant mag zijn eigen afspraken lezen, en kon zo ook de interne opmerking
-- (bevindingen bij het afwerken) opvragen. RLS werkt per rij, niet per kolom,
-- dus de opmerking staat nu in een eigen tabel (zelfde aanpak als voorraad_intern).
-- De FK is uitgesteld (DEFERRABLE), zodat de vangnet-trigger hieronder ook bij een
-- nieuwe afspraak (rij bestaat dan nog niet) de opmerking kan wegzetten.
CREATE TABLE IF NOT EXISTS public.afspraken_intern (
  afspraak_id uuid PRIMARY KEY REFERENCES public.afspraken(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  opmerking   text NOT NULL CHECK (length(opmerking) <= 4000)
);
ALTER TABLE public.afspraken_intern ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'afspraken_intern'
                 AND policyname = 'afspraken_intern_admin') THEN
    CREATE POLICY afspraken_intern_admin ON public.afspraken_intern FOR ALL
      USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
  END IF;
END $$;

-- Bestaande opmerkingen overzetten naar de nieuwe tabel.
INSERT INTO public.afspraken_intern (afspraak_id, opmerking)
  SELECT id, interne_opmerking FROM public.afspraken WHERE nullif(btrim(interne_opmerking), '') IS NOT NULL
  ON CONFLICT (afspraak_id) DO NOTHING;
-- Daarna de oude kolom leegmaken (handmatig in de SQL Editor; vraagt goedkeuring).
-- De trigger hieronder zet een opmerking daarbij nogmaals veilig weg.
-- UPDATE public.afspraken SET interne_opmerking = NULL WHERE interne_opmerking IS NOT NULL;

-- Vangnet: schrijft iets (bv. een oude, nog openstaande versie van de app) toch in de
-- oude kolom, dan gaat het naar afspraken_intern (alleen beheerder) en blijft de kolom leeg.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.verplaats_interne_opmerking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.interne_opmerking IS NOT NULL THEN
    IF public.is_admin() AND btrim(NEW.interne_opmerking) <> '' THEN
      INSERT INTO public.afspraken_intern (afspraak_id, opmerking) VALUES (NEW.id, NEW.interne_opmerking)
        ON CONFLICT (afspraak_id) DO UPDATE SET opmerking = EXCLUDED.opmerking;
    END IF;
    NEW.interne_opmerking := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE TRIGGER afspraken_interne_opmerking_apart BEFORE INSERT OR UPDATE ON public.afspraken
  FOR EACH ROW EXECUTE FUNCTION private.verplaats_interne_opmerking();

-- ── 2. Motor verwijderen door een klant: garage-onderhoud blijft bewaard ─────────
-- Voorheen wiste "motor verwijderen" via ON DELETE CASCADE ook de onderhoudsbeurten
-- en klussen van de garage. Nu:
--  - heeft de motor historie bij De Jonge Motoren (onderhoud door de garage, een klus,
--    een afspraak, of hier gekocht) → de database weigert het verwijderen; de app
--    verbergt de motor dan alleen voor de klant (klant_verwijderd_op);
--  - anders (alleen eigen invoer van de klant) → echt verwijderen mag.
ALTER TABLE public.motoren ADD COLUMN IF NOT EXISTS klant_verwijderd_op timestamptz;

CREATE OR REPLACE FUNCTION private.motor_heeft_garagehistorie(p_motor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.motoren m WHERE m.id = p_motor_id AND m.source_voorraad_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.service_beurten s WHERE s.motor_id = p_motor_id AND NOT coalesce(s.klant_invoer, false))
      OR EXISTS (SELECT 1 FROM public.klussen kl WHERE kl.motor_id = p_motor_id)
      OR EXISTS (SELECT 1 FROM public.afspraken a WHERE a.motor_id = p_motor_id AND a.status IS DISTINCT FROM 'geannuleerd');
$function$;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.motor_heeft_garagehistorie(uuid) TO authenticated;

-- Klant: eigen motoren lezen, toevoegen, wijzigen (ook verbergen) en alleen zonder
-- garage-historie verwijderen. Beheerder: alles.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoren' AND policyname = 'motor_eigen') THEN
    ALTER POLICY motor_eigen ON public.motoren
      USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
    ALTER POLICY motor_eigen ON public.motoren RENAME TO motoren_admin;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoren' AND policyname = 'klant_motoren_lezen') THEN
    CREATE POLICY klant_motoren_lezen ON public.motoren FOR SELECT TO authenticated
      USING (klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoren' AND policyname = 'klant_motoren_toevoegen') THEN
    CREATE POLICY klant_motoren_toevoegen ON public.motoren FOR INSERT TO authenticated
      WITH CHECK (klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoren' AND policyname = 'klant_motoren_wijzigen') THEN
    CREATE POLICY klant_motoren_wijzigen ON public.motoren FOR UPDATE TO authenticated
      USING (klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid())))
      WITH CHECK (klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoren' AND policyname = 'klant_motoren_verwijderen') THEN
    CREATE POLICY klant_motoren_verwijderen ON public.motoren FOR DELETE TO authenticated
      USING (klant_id IN (SELECT k.id FROM public.klanten k WHERE k.user_id = (SELECT auth.uid()))
             AND NOT private.motor_heeft_garagehistorie(id));
  END IF;
END $$;
