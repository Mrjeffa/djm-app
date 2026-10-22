-- Test van de dagcapaciteit (supabase/dagcapaciteit.sql). Wijzigt niets: alles gebeurt in
-- één transactie die aan het eind met een (bedoelde) foutmelding wordt teruggedraaid; de
-- uitkomst staat in die melding. Draaien: Supabase → SQL Editor → plak dit bestand → Run.
-- Laatste uitkomst (22-10-2026, max 1 per dag): 11 controles, alle OK.
DO $$
DECLARE
  uit text := ''; n int; r jsonb; dag date; dag2 date; klant uuid; klant_user uuid; admin_id uuid; bezet text;
BEGIN
  SELECT k.id, k.user_id INTO klant, klant_user FROM public.klanten k
   WHERE k.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.id = k.user_id) LIMIT 1;
  SELECT id INTO admin_id FROM public.admins LIMIT 1;
  -- twee open werkdagen in de toekomst (niet gesloten volgens openingstijden)
  SELECT d INTO dag FROM generate_series(current_date + 7, current_date + 40, interval '1 day') g(d0), LATERAL (SELECT g.d0::date AS d) x
   WHERE NOT COALESCE(((SELECT openingstijden FROM public.instellingen WHERE id=1) -> (ARRAY['zo','ma','di','wo','do','vr','za'])[extract(dow from d)::int + 1] ->> 'gesloten')::boolean, true)
     AND NOT (d::text = ANY(COALESCE((SELECT gesloten_dagen FROM public.instellingen WHERE id=1), '{}')))
     AND NOT EXISTS (SELECT 1 FROM public.afspraken a WHERE a.datum = d) LIMIT 1;
  SELECT d INTO dag2 FROM generate_series(dag + 1, dag + 40, interval '1 day') g(d0), LATERAL (SELECT g.d0::date AS d) x
   WHERE NOT COALESCE(((SELECT openingstijden FROM public.instellingen WHERE id=1) -> (ARRAY['zo','ma','di','wo','do','vr','za'])[extract(dow from d)::int + 1] ->> 'gesloten')::boolean, true)
     AND NOT (d::text = ANY(COALESCE((SELECT gesloten_dagen FROM public.instellingen WHERE id=1), '{}')))
     AND NOT EXISTS (SELECT 1 FROM public.afspraken a WHERE a.datum = d) LIMIT 1;
  uit := uit || format(E'Testdagen: %s en %s, max per dag: %s\n', dag, dag2, private.max_afspraken_per_dag());

  -- 1. Website boekt dag 1 (anoniem, via het formulier)
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  r := public.maak_afspraak('Test Persoon', '0611111111', null, dag, 'service', null, 'test', null);
  uit := uit || format(E'%s website boekt lege dag: %s\n', CASE WHEN (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r);
  IF private.max_afspraken_per_dag() = 1 THEN
    r := public.maak_afspraak('Tweede Persoon', '0622222222', null, dag, 'service', null, 'test', null);
    uit := uit || format(E'%s website boekt dezelfde (volle) dag: %s\n', CASE WHEN NOT (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r->>'fout');
  END IF;

  -- 2. Klant: ziet de dag als vol en kan hem niet boeken
  PERFORM set_config('request.jwt.claims', json_build_object('sub', klant_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT string_agg(datum::text, ',') INTO bezet FROM public.get_bezette_dagen();
  uit := uit || format(E'%s klant ziet volle dagen: %s\n', CASE WHEN bezet LIKE '%' || dag || '%' THEN 'OK ' ELSE 'FOUT' END, coalesce(bezet,'(geen)'));
  SELECT count(*) INTO n FROM public.afspraken WHERE datum = dag;
  uit := uit || format(E'    (klant ziet zelf %s afspraken op die dag: andermans afspraak blijft privé)\n', n);
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, opmerking) VALUES (klant, dag, 'service', 'test');
    uit := uit || E'FOUT klant boekt volle dag buiten de app om: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'OK  klant boekt volle dag buiten de app om: geweigerd ("%s")\n', SQLERRM); END;
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, opmerking) VALUES (klant, dag2, 'service', 'test');
    uit := uit || E'OK  klant boekt lege dag 2: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT klant boekt lege dag 2: %s\n', SQLERRM); END;
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, opmerking) VALUES (klant, dag2, 'proefrit', 'test');
    uit := uit || E'FOUT tweede afspraak op dag 2: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  tweede afspraak op dag 2 (proefrit): geweigerd\n'; END;
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, opmerking, dag_gekozen) VALUES (klant, dag, 'zoekopdracht', 'test', false);
    uit := uit || E'OK  aanvraag zonder gekozen dag op volle dag: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT aanvraag zonder gekozen dag: %s\n', SQLERRM); END;
  BEGIN
    UPDATE public.afspraken SET dag_gekozen = false WHERE klant_id = klant AND datum = dag2;
    uit := uit || E'FOUT klant zet eigen afspraak op "geen dag" (dag vrijmaken): toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  klant kan eigen afspraak niet op "geen dag" zetten\n'; END;

  -- 3. Beheerder: mag een volle dag toch inplannen; geannuleerd telt niet mee
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, status, opmerking) VALUES (klant, dag, 'intern', 'gepland', 'test');
    uit := uit || E'OK  beheerder plant extra afspraak op volle dag\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT beheerder op volle dag: %s\n', SQLERRM); END;
  UPDATE public.afspraken SET status = 'geannuleerd' WHERE datum = dag2;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', klant_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT string_agg(datum::text, ',') INTO bezet FROM public.get_bezette_dagen();
  uit := uit || format(E'%s na annuleren is dag 2 weer vrij: volle dagen nu %s\n', CASE WHEN coalesce(bezet,'') NOT LIKE '%' || dag2 || '%' THEN 'OK ' ELSE 'FOUT' END, coalesce(bezet,'(geen)'));
  BEGIN
    INSERT INTO public.afspraken (klant_id, datum, type, opmerking) VALUES (klant, dag2, 'service', 'test');
    uit := uit || E'OK  klant boekt dag 2 opnieuw na annulering\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT dag 2 na annulering: %s\n', SQLERRM); END;

  RESET ROLE;
  RAISE EXCEPTION E'DAGCAPACITEIT-TEST (alles teruggedraaid)\n%', uit;
END $$;
