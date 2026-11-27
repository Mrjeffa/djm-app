-- Test van supabase/facturen.sql. Wijzigt niets: alles in één transactie die aan het eind met
-- een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
DO $$
DECLARE uit text := ''; n int; nr bigint; klant uuid;
BEGIN
  SELECT id INTO klant FROM public.klanten WHERE user_id IS NOT NULL LIMIT 1;
  SELECT laatste_factuurnummer INTO nr FROM public.beheer_instellingen WHERE id = 1;
  uit := uit || format(E'%s laatste factuurnummer: %s\n', CASE WHEN nr IS NOT NULL THEN 'OK ' ELSE 'LET OP' END, nr);
  BEGIN
    INSERT INTO public.beheer_instellingen (id) VALUES (2);
    uit := uit || E'FOUT tweede rij in beheer_instellingen\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  beheer_instellingen heeft één rij\n'; END;

  -- Beheerder vervangt de prijslijst (als postgres: is_admin() is dan onwaar → geweigerd)
  BEGIN
    PERFORM public.vervang_prijslijst('[{"omschrijving":"x","verkoop":1}]');
    uit := uit || E'FOUT vervang_prijslijst zonder beheerder\n';
  EXCEPTION WHEN raise_exception THEN uit := uit || E'OK  vervang_prijslijst alleen voor de beheerder\n'; END;
  INSERT INTO public.prijslijst (omschrijving, artikelnummer, inkoop, verkoop) VALUES ('Oliefilter Hiflo HF303', 'HF303', 5.14, 8.56);

  -- Bezoeker website
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.prijslijst;
    uit := uit || format(E'LEK website kan de prijslijst lezen (%s)\n', n);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan de prijslijst niet lezen\n'; END;
  BEGIN
    SELECT laatste_factuurnummer INTO nr FROM public.beheer_instellingen;
    uit := uit || format(E'LEK website kan het factuurnummer lezen (%s)\n', nr);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan beheer_instellingen niet lezen\n'; END;
  BEGIN
    PERFORM public.vervang_prijslijst('[]');
    uit := uit || E'LEK website kan de prijslijst vervangen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan vervang_prijslijst niet aanroepen\n'; END;
  RESET ROLE;

  -- Ingelogde klant
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',(SELECT user_id FROM public.klanten WHERE id = klant))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.prijslijst;
  uit := uit || format(E'%s klant ziet de prijslijst niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  SELECT count(*) INTO n FROM public.beheer_instellingen;
  uit := uit || format(E'%s klant ziet beheer_instellingen niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  UPDATE public.beheer_instellingen SET laatste_factuurnummer = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s klant kan het factuurnummer niet wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  BEGIN
    PERFORM public.vervang_prijslijst('[]');
    uit := uit || E'LEK klant kan de prijslijst vervangen\n';
  EXCEPTION WHEN raise_exception THEN uit := uit || E'OK  klant kan de prijslijst niet vervangen\n'; END;
  RESET ROLE;

  RAISE EXCEPTION E'Testuitslag (wordt teruggedraaid):\n%', uit;
END $$;
