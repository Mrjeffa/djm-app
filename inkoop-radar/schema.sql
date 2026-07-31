-- Referentie — reeds toegepast op Supabase (project xftnovnldcdfohqlqgor).
-- Alleen ter documentatie; niet nodig om opnieuw te draaien.

CREATE TABLE IF NOT EXISTS public.inkoop_leads (
  ad_id             text PRIMARY KEY,
  titel             text,
  beschrijving      text,
  prijs             int,
  plaats            text,
  land              text,
  verkoper_id       text,
  verkoper_naam     text,
  is_particulier    boolean DEFAULT true,
  url               text,
  foto_url          text,
  bron              text,
  advertentie_datum timestamptz,
  status            text DEFAULT 'nieuw',   -- nieuw | bekeken | genegeerd | naar_inkoop
  gevonden_op       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inkoop_leads_status_idx   ON public.inkoop_leads (status);
CREATE INDEX IF NOT EXISTS inkoop_leads_gevonden_idx ON public.inkoop_leads (gevonden_op DESC);

ALTER TABLE public.inkoop_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY inkoop_leads_admin ON public.inkoop_leads
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.inkoop_radar_status (
  id           int PRIMARY KEY DEFAULT 1,
  laatste_run  timestamptz,
  http_ok      boolean,
  gevonden     int,
  gemapt       int,
  nieuw        int,
  waarschuwing text,
  CONSTRAINT inkoop_radar_status_single_row CHECK (id = 1)
);
INSERT INTO public.inkoop_radar_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.inkoop_radar_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY inkoop_radar_status_admin ON public.inkoop_radar_status
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
