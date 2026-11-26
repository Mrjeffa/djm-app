-- Extra's bij de verkoop van een motor (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "verkoop_extras".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Hoe het werkt:
--  * instellingen.verkoop_extras: de lijst met extra's (Afleverpakket, Slot, …), aan te
--    passen in Instellingen → Extra's bij verkoop.
--  * voorraad.extras_niet_aanbieden: per voorraadmotor de extra's die je NIET aanbiedt
--    (de motor heeft al een telefoonhouder, …). Zo wordt een extra die je later aan de lijst
--    toevoegt bij bestaande motoren meteen aangeboden.
--  * motor_verkoop_extras: wat de koper erbij heeft genomen, per klantmotor. Aparte tabel
--    (net als voorraad_intern), want de verkochte voorraadregel verdwijnt na 30 dagen en
--    klanten mogen hun eigen motor wijzigen; dit mag alleen de beheerder zien en wijzigen.

-- 1. De lijst met extra's
ALTER TABLE public.instellingen
  ADD COLUMN IF NOT EXISTS verkoop_extras jsonb NOT NULL
  DEFAULT '["Afleverpakket","Garantiepakket","Slot","Navigatiesysteem","Telefoonhouder","Verwarmde handvatten","GPS-tracker"]'::jsonb;
ALTER TABLE public.instellingen DROP CONSTRAINT IF EXISTS verkoop_extras_is_lijst;
ALTER TABLE public.instellingen
  ADD CONSTRAINT verkoop_extras_is_lijst CHECK (jsonb_typeof(verkoop_extras) = 'array');

-- 2. Per voorraadmotor: niet aanbieden. De website (anon) heeft kolomrechten op voorraad,
--    dus deze nieuwe kolom is voor een bezoeker niet op te vragen.
ALTER TABLE public.voorraad
  ADD COLUMN IF NOT EXISTS extras_niet_aanbieden text[] NOT NULL DEFAULT '{}';

-- 3. Gekozen extra's per verkochte klantmotor (alleen beheerder)
CREATE TABLE IF NOT EXISTS public.motor_verkoop_extras (
  motor_id uuid PRIMARY KEY REFERENCES public.motoren(id) ON DELETE CASCADE,
  extras text[] NOT NULL DEFAULT '{}',
  overig text,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.motor_verkoop_extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS motor_verkoop_extras_admin ON public.motor_verkoop_extras;
CREATE POLICY motor_verkoop_extras_admin ON public.motor_verkoop_extras
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
REVOKE ALL ON public.motor_verkoop_extras FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motor_verkoop_extras TO authenticated;
