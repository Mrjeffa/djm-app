-- Onderhoudslijst per afspraak (november 2026), naar het papieren formulier
-- "Onderhoudslijst" van de werkplaats.
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "onderhoudslijst".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
--
-- Hoe het werkt:
--  * instellingen.onderhoudslijst: het sjabloon, aan te passen in Instellingen → Onderhoudslijst.
--    { controle: [punten met status oké/advies/vervangen/niet aanwezig],
--      groot:    [punten groot onderhoud met uitgevoerd + type] }
--  * onderhoudslijsten: de ingevulde lijst per afspraak (lijst jsonb). De namen van de punten
--    staan in de lijst zelf, zodat een later aangepast sjabloon een ingevulde lijst niet
--    verandert. Basis voor de werkbon/factuur (zonder prijzen) die later volgt.
--    Alleen de beheerder; verdwijnt met de afspraak.

-- 1. Sjabloon
ALTER TABLE public.instellingen
  ADD COLUMN IF NOT EXISTS onderhoudslijst jsonb NOT NULL DEFAULT '{
    "controle": ["Verlichting voor / achter", "Dashboardverlichting", "Fuel conditioner",
      "Smeerpunten (standaard, stepjes, etc.)", "Olie", "Oliefilter", "Koelvloeistof check, niveau, kleur",
      "Accu laadspanning meten", "Accu boutjes, vloeistofniveau", "Cardan olie", "Ketting/tandwielen",
      "Remschijven voor/achter", "Remblokken voor", "Remvloeistof voor", "Remblokken achter",
      "Remvloeistof achter", "Hydraulische koppelingsbediening", "Bandenprofiel + spanning",
      "Gaskabel/koppelingskabel", "Voorvork-keerring lekkage", "Wiellagers (geluid + speling)",
      "Balhoofdlagers", "Algemene visuele inspectie"],
    "groot": ["Oliefilter", "Luchtfilter", "Bougies", "Kleppen stellen"]
  }'::jsonb;
ALTER TABLE public.instellingen DROP CONSTRAINT IF EXISTS onderhoudslijst_vorm;
ALTER TABLE public.instellingen
  ADD CONSTRAINT onderhoudslijst_vorm CHECK (
    jsonb_typeof(onderhoudslijst) = 'object'
    AND jsonb_typeof(onderhoudslijst -> 'controle') = 'array'
    AND jsonb_typeof(onderhoudslijst -> 'groot') = 'array');

-- 2. Ingevulde lijst per afspraak (alleen beheerder)
CREATE TABLE IF NOT EXISTS public.onderhoudslijsten (
  afspraak_id uuid PRIMARY KEY REFERENCES public.afspraken(id) ON DELETE CASCADE,
  lijst jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(lijst) = 'object'),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onderhoudslijsten ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onderhoudslijsten_admin ON public.onderhoudslijsten;
CREATE POLICY onderhoudslijsten_admin ON public.onderhoudslijsten
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
REVOKE ALL ON public.onderhoudslijsten FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onderhoudslijsten TO authenticated;
