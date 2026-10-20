-- Pushmeldingen voor de beheerder (web push / VAPID).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "push_meldingen".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Werking: een trigger zet bij een nieuwe gebeurtenis een HTTP-verzoek klaar (pg_net,
-- wordt pas verstuurd als de transactie slaagt) naar de edge function push-melding.
-- Die leest de gegevens zelf uit de database en stuurt de melding naar alle
-- aangemelde apparaten van admins. Acties van de beheerder zelf geven geen melding.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Aangemelde apparaten (één rij per apparaat/browser van een admin)
CREATE TABLE IF NOT EXISTS public.push_abonnementen (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  apparaat    text,
  aangemaakt  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_abonnementen ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_abonnementen'
                 AND policyname = 'push_abonnementen_eigen_admin') THEN
    CREATE POLICY push_abonnementen_eigen_admin ON public.push_abonnementen FOR ALL
      USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_admin()))
      WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_admin()));
  END IF;
END $$;

-- Logboek: elke gebeurtenis maar één keer melden + rem op het aantal per uur.
-- RLS zonder policies: alleen de edge function (service role) kan erbij.
CREATE TABLE IF NOT EXISTS public.push_log (
  tabel         text NOT NULL,
  record_id     text NOT NULL,
  soort         text NOT NULL DEFAULT 'nieuw',
  verstuurd_op  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tabel, record_id, soort)
);
CREATE INDEX IF NOT EXISTS push_log_tijd_idx ON public.push_log (verstuurd_op);
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

-- VAPID-sleutelpaar; de edge function maakt het zelf aan bij het eerste gebruik.
-- RLS zonder policies: alleen de edge function (service role) kan erbij.
CREATE TABLE IF NOT EXISTS public.push_sleutels (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  publiek    text NOT NULL,
  prive_jwk  jsonb NOT NULL,
  aangemaakt timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_sleutels ENABLE ROW LEVEL SECURITY;

-- Triggerfunctie in een schema dat niet via de API bereikbaar is
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.meld_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- TG_ARGV[0] = soort gebeurtenis, TG_ARGV[1] = kolom met het kenmerk (standaard id)
BEGIN
  IF public.is_admin() THEN RETURN NULL; END IF; -- eigen acties van de beheerder: geen melding
  PERFORM net.http_post(
    url := 'https://xftnovnldcdfohqlqgor.supabase.co/functions/v1/push-melding',
    body := jsonb_build_object(
      'tabel', TG_TABLE_NAME,
      'id', to_jsonb(NEW) ->> COALESCE(TG_ARGV[1], 'id'),
      'soort', COALESCE(TG_ARGV[0], 'nieuw')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- publieke anon key (staat ook in de app); de functie vertrouwt de inhoud niet
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdG5vdm5sZGNkZm9ocWxxZ29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODU2NzQsImV4cCI6MjA5NTk2MTY3NH0.5Qgfipldcz_YrODg5HT25h0nkIfJMzMiW2ChQO57wfM'),
    timeout_milliseconds := 10000);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pushmelding niet klaargezet: %', SQLERRM; -- een melding laat een actie nooit mislukken
  RETURN NULL;
END;
$function$;

-- Nieuwe afspraak of aanvraag (website, klantportaal); de functie meldt alleen status 'aangevraagd'
CREATE OR REPLACE TRIGGER push_nieuwe_afspraak AFTER INSERT ON public.afspraken
  FOR EACH ROW EXECUTE FUNCTION private.meld_push('nieuw');
-- Nieuwe inkoop-aanvraag (website: "wij kopen je motor")
CREATE OR REPLACE TRIGGER push_inkoop_aanvraag AFTER INSERT ON public.inkoop_aanvragen
  FOR EACH ROW EXECUTE FUNCTION private.meld_push('nieuw');
-- Inkoop-radar: één melding per run met nieuwe advertenties
CREATE OR REPLACE TRIGGER push_inkoop_radar AFTER UPDATE ON public.inkoop_radar_status
  FOR EACH ROW WHEN (NEW.laatste_run IS DISTINCT FROM OLD.laatste_run AND COALESCE(NEW.nieuw, 0) > 0)
  EXECUTE FUNCTION private.meld_push('run', 'laatste_run');
-- Klantacties in het portaal
CREATE OR REPLACE TRIGGER push_motor_toegevoegd AFTER INSERT ON public.motoren
  FOR EACH ROW EXECUTE FUNCTION private.meld_push('nieuw');
CREATE OR REPLACE TRIGGER push_onderhoud_klant AFTER INSERT ON public.service_beurten
  FOR EACH ROW WHEN (NEW.klant_invoer IS TRUE) EXECUTE FUNCTION private.meld_push('nieuw');
CREATE OR REPLACE TRIGGER push_account_verwijderd AFTER UPDATE OF status ON public.klanten
  FOR EACH ROW WHEN (NEW.status = 'gearchiveerd' AND OLD.status IS DISTINCT FROM 'gearchiveerd')
  EXECUTE FUNCTION private.meld_push('gearchiveerd');
-- Nieuwe klant: pas melden als het e-mailadres bevestigd is (geen meldingen voor nep-aanmeldingen)
CREATE OR REPLACE TRIGGER push_registratie_bevestigd AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION private.meld_push('registratie');
CREATE OR REPLACE TRIGGER push_registratie_direct AFTER INSERT ON auth.users
  FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION private.meld_push('registratie');
