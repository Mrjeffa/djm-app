-- Voorraad: eenheid van de tellerstand + interne opmerking.
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "voorraad_km_eenheid_en_intern".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.

-- Tellerstand in mijl (zeldzaam). voorraad.km blijft ALTIJD in kilometers, zodat
-- prijscheck, sortering en website gewoon blijven werken; km_eenheid zegt alleen
-- in welke eenheid de teller staat (de app toont dan "12.000 mijl (19.312 km)").
ALTER TABLE public.voorraad ADD COLUMN IF NOT EXISTS km_eenheid text NOT NULL DEFAULT 'km';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voorraad_km_eenheid_check') THEN
    ALTER TABLE public.voorraad ADD CONSTRAINT voorraad_km_eenheid_check CHECK (km_eenheid IN ('km', 'mijl'));
  END IF;
END $$;

-- Interne opmerking (bv. "ABS werkt niet"). Aparte tabel: public.voorraad is
-- leesbaar voor website en klanten, deze tabel alleen voor admins
-- (zelfde patroon als voorraad_chassis en voorraad_inkoop).
CREATE TABLE IF NOT EXISTS public.voorraad_intern (
  voorraad_id uuid PRIMARY KEY REFERENCES public.voorraad(id) ON DELETE CASCADE,
  opmerking   text NOT NULL CHECK (length(opmerking) <= 2000)
);
ALTER TABLE public.voorraad_intern ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'voorraad_intern'
                 AND policyname = 'voorraad_intern_admin') THEN
    CREATE POLICY voorraad_intern_admin ON public.voorraad_intern
      FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
  END IF;
END $$;
