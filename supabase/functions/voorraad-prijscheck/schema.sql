-- Referentie — reeds toegepast op Supabase (project xftnovnldcdfohqlqgor).
-- Herhaalbaar: opnieuw draaien geeft geen fouten.
-- Tabellen voor de voorraad-prijscheck. Beide alleen voor admins.

-- Inkoopprijs per voorraadmotor. Bewust een APARTE tabel: public.voorraad is
-- leesbaar voor website/klanten, de inkoopprijs mag alleen de admin zien
-- (zelfde patroon als voorraad_chassis).
CREATE TABLE IF NOT EXISTS public.voorraad_inkoop (
  voorraad_id  uuid PRIMARY KEY REFERENCES public.voorraad(id) ON DELETE CASCADE,
  inkoopprijs  int NOT NULL CHECK (inkoopprijs >= 0)
);
ALTER TABLE public.voorraad_inkoop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voorraad_inkoop_admin ON public.voorraad_inkoop;
CREATE POLICY voorraad_inkoop_admin ON public.voorraad_inkoop
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Laatste Motoroccasion-prijscheck per voorraadmotor (de edge function schrijft
-- met de service-role key). Bevat de marktdata; de app rekent status/advies live
-- uit met de actuele vraagprijs en inkoopprijs (logica.ts → beoordeel).
CREATE TABLE IF NOT EXISTS public.voorraad_prijscheck (
  voorraad_id       uuid PRIMARY KEY REFERENCES public.voorraad(id) ON DELETE CASCADE,
  gecontroleerd_op  timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL,           -- ok | geen_data | fout
  mo_model          text,                    -- welk Motoroccasion-type vergeleken is
  mo_url            text,                    -- de zoekopdracht (zelfde bouwjaar, prijs oplopend)
  concurrenten      jsonb,                   -- alle bruikbare advertenties van dit bouwjaar, goedkoopste eerst:
                                             -- [{prijs,km,bouwjaar,dealer,url}]; de app leidt er lokgroep en markt uit af
  zelfde_bouwjaar   int,                     -- aantal advertenties met hetzelfde bouwjaar (context)
  toelichting       text
);
ALTER TABLE public.voorraad_prijscheck ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voorraad_prijscheck_admin ON public.voorraad_prijscheck;
CREATE POLICY voorraad_prijscheck_admin ON public.voorraad_prijscheck
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
