-- Test van de website-koppeling (supabase/website_koppeling.sql): doet wat het websiteformulier
-- doet, als anonieme bezoeker. Wijzigt niets: alles in één transactie die aan het eind met een
-- (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
-- Laatste uitkomst (05-11-2026): 9 controles, alle OK.
DO $$
DECLARE uit text := ''; r jsonb; dag date; dicht date; n int; g boolean;
BEGIN
  SELECT d INTO dag FROM generate_series(current_date + 7, current_date + 40, interval '1 day') g(d0), LATERAL (SELECT g.d0::date AS d) x
   WHERE NOT COALESCE(((SELECT openingstijden FROM public.instellingen WHERE id=1) -> (ARRAY['zo','ma','di','wo','do','vr','za'])[extract(dow from d)::int + 1] ->> 'gesloten')::boolean, true)
     AND NOT (d::text = ANY(COALESCE((SELECT gesloten_dagen FROM public.instellingen WHERE id=1), '{}')))
     AND NOT EXISTS (SELECT 1 FROM public.afspraken a WHERE a.datum = d) LIMIT 1;
  SELECT d INTO dicht FROM generate_series(current_date + 1, current_date + 14, interval '1 day') g(d0), LATERAL (SELECT g.d0::date AS d) x
   WHERE COALESCE(((SELECT openingstijden FROM public.instellingen WHERE id=1) -> (ARRAY['zo','ma','di','wo','do','vr','za'])[extract(dow from d)::int + 1] ->> 'gesloten')::boolean, true) LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;

  r := public.maak_afspraak('Web Een', '0611111111', null, current_date, 'service', null, 'zonder datum', null);
  RESET ROLE;
  SELECT dag_gekozen INTO g FROM public.afspraken WHERE telefoon = '0611111111' ORDER BY created_at DESC LIMIT 1;
  uit := uit || format(E'%s aanvraag zonder datum (vandaag): %s, dag_gekozen=%s\n', CASE WHEN (r->>'success')::boolean AND g = false THEN 'OK ' ELSE 'FOUT' END, r, g);
  SET LOCAL ROLE anon;
  r := public.maak_afspraak('Web Twee', '0622222222', null, current_date, 'proefrit', null, 'nog een zonder datum', null);
  uit := uit || format(E'%s tweede aanvraag zonder datum (wordt niet geweigerd): %s\n', CASE WHEN (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r);
  r := public.maak_afspraak('Web Drie', '0633333333', null, dag, 'service', null, 'met datum', null);
  uit := uit || format(E'%s aanvraag op vrije dag %s: %s\n', CASE WHEN (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, dag, r);
  BEGIN
    r := public.maak_afspraak('Web Vier', '0644444444', null, dag, 'service', null, 'zelfde dag', null);
    uit := uit || format(E'FOUT volle dag gaf: %s (website zou "Bedankt" tonen)\n', r);
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'OK  volle dag geeft een fout: "%s"\n', SQLERRM); END;
  IF dicht IS NOT NULL THEN
    BEGIN
      r := public.maak_afspraak('Web Vijf', '0655555555', null, dicht, 'service', null, 'dicht', null);
      uit := uit || format(E'FOUT gesloten dag gaf: %s\n', r);
    EXCEPTION WHEN OTHERS THEN uit := uit || format(E'OK  gesloten dag (%s) geeft een fout: "%s"\n', dicht, SQLERRM); END;
  END IF;
  BEGIN
    r := public.maak_afspraak('Web Zes', '123', null, dag, 'service', null, 'x', null);
    uit := uit || E'FOUT ongeldig telefoonnummer geaccepteerd\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'OK  ongeldig telefoonnummer geeft een fout: "%s"\n', SQLERRM); END;
  SELECT count(*) INTO n FROM public.get_drukke_datums(current_date, current_date + 60) WHERE datum = current_date;
  uit := uit || format(E'%s aanvragen zonder datum tellen niet mee in get_drukke_datums (vandaag: %s rijen)\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT aantal INTO n FROM public.get_drukke_datums(current_date, current_date + 60) WHERE datum = dag;
  uit := uit || format(E'%s get_drukke_datums ziet de geboekte dag: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.voorraad WHERE verkocht_op IS NOT NULL;
  uit := uit || format(E'%s anoniem ziet verkochte motoren (kenteken/koper): %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  RESET ROLE;
  RAISE EXCEPTION E'WEBSITE-TEST (alles teruggedraaid)\n%', uit;
END $$;
