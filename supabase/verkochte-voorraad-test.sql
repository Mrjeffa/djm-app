-- Test van supabase/verkochte_voorraad.sql. Wijzigt niets: alles in één transactie die aan
-- het eind met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
DO $$
DECLARE uit text := ''; n int; k text; t text; verkocht uuid := gen_random_uuid(); oud uuid := gen_random_uuid(); tekoop uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.voorraad (id, kenteken, merk, model, bouwjaar, km, prijs, status, verkocht_op, verkocht_aan, fotos)
  VALUES (verkocht, 'TEST-01', 'Testmerk', 'Verkocht', 2020, 1000, 5000, 'verkocht', current_date - 3, (SELECT id FROM public.klanten LIMIT 1), '[]'),
         (oud,      'TEST-02', 'Testmerk', 'Lang geleden', 2019, 1000, 5000, 'verkocht', current_date - 45, NULL, '[]'),
         (tekoop,   'TEST-03', 'Testmerk', 'Te koop', 2021, 1000, 5000, 'beschikbaar', NULL, NULL, '[]');

  -- Bezoeker website
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.voorraad WHERE id = verkocht;
  uit := uit || format(E'%s website ziet motor verkocht 3 dagen geleden: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.voorraad WHERE id = oud;
  uit := uit || format(E'%s website ziet motor verkocht 45 dagen geleden niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.voorraad WHERE id = tekoop;
  uit := uit || format(E'%s website ziet motor die te koop staat: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  BEGIN
    SELECT kenteken INTO k FROM public.voorraad WHERE id = verkocht;
    uit := uit || format(E'LEK website kan kenteken lezen: %s\n', k);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan kenteken niet lezen\n'; END;
  BEGIN
    SELECT verkocht_aan::text INTO k FROM public.voorraad WHERE id = verkocht;
    uit := uit || format(E'LEK website kan klantnummer koper lezen: %s\n', k);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan klantnummer koper niet lezen\n'; END;
  BEGIN
    PERFORM * FROM public.voorraad WHERE id = verkocht;
    uit := uit || E'LEK website kan alle kolommen (select *) lezen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan niet alle kolommen (select *) lezen\n'; END;
  SELECT merk || ' ' || model INTO t FROM public.voorraad WHERE id = verkocht;
  uit := uit || format(E'%s website-kolommen leesbaar: %s\n', CASE WHEN t IS NOT NULL THEN 'OK ' ELSE 'FOUT' END, t);
  BEGIN
    PERFORM * FROM public.voorraad_overzicht();
    uit := uit || E'FOUT bezoeker kan voorraad_overzicht() aanroepen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  bezoeker kan voorraad_overzicht() niet aanroepen\n'; END;
  RESET ROLE;

  -- Ingelogde klant (geen beheerder)
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',gen_random_uuid())::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.voorraad_overzicht() o WHERE o.id = verkocht AND o.kenteken IS NULL;
  uit := uit || format(E'%s klantportaal ziet verkochte motor zonder kenteken: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT o.kenteken INTO k FROM public.voorraad_overzicht() o WHERE o.id = tekoop;
  uit := uit || format(E'%s klantportaal ziet kenteken van motor die te koop staat: %s\n', CASE WHEN k = 'TEST-03' THEN 'OK ' ELSE 'FOUT' END, k);
  SELECT count(*) INTO n FROM public.voorraad_overzicht() o WHERE o.id = oud;
  uit := uit || format(E'%s klantportaal ziet motor van 45 dagen geleden niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.voorraad WHERE id = verkocht;
  uit := uit || format(E'%s klant leest de tabel rechtstreeks (na deel 2: 0): %s rij(en)\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'INFO' END, n);
  RESET ROLE;
  RAISE EXCEPTION E'VERKOCHTE-VOORRAAD-TEST (alles teruggedraaid)\n%', uit;
END $$;
