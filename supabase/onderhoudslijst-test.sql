-- Test van supabase/onderhoudslijst.sql. Wijzigt niets: alles in één transactie die aan het
-- eind met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
DO $$
DECLARE uit text := ''; n int; t text; klant uuid; afspraak uuid := gen_random_uuid();
BEGIN
  SELECT id INTO klant FROM public.klanten WHERE user_id IS NOT NULL LIMIT 1;
  INSERT INTO public.afspraken (id, klant_id, datum, tijd, duur, type, status, soort)
  VALUES (afspraak, klant, current_date + 1, '09:00', 1, 'service', 'gepland', 'Kleine beurt');
  INSERT INTO public.onderhoudslijsten (afspraak_id, lijst) VALUES (afspraak, '{"km":"12345","controle":[{"naam":"Olie","status":"vervangen"}]}');

  SELECT jsonb_array_length(onderhoudslijst -> 'controle') || ' controlepunten, ' || jsonb_array_length(onderhoudslijst -> 'groot') || ' groot'
    INTO t FROM public.instellingen WHERE id = 1;
  uit := uit || format(E'%s sjabloon in instellingen: %s\n', CASE WHEN t LIKE '23 controlepunten, 4 groot' THEN 'OK ' ELSE 'LET OP' END, t);
  BEGIN
    UPDATE public.instellingen SET onderhoudslijst = '[]' WHERE id = 1;
    uit := uit || E'FOUT sjabloon zonder vorm geaccepteerd\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  sjabloon moet {controle, groot} zijn\n'; END;

  -- Bezoeker website
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.onderhoudslijsten;
    uit := uit || format(E'LEK website kan onderhoudslijsten lezen (%s)\n', n);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan onderhoudslijsten niet lezen\n'; END;
  RESET ROLE;

  -- Ingelogde klant (eigenaar van de afspraak)
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',(SELECT user_id FROM public.klanten WHERE id = klant))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.onderhoudslijsten WHERE afspraak_id = afspraak;
  uit := uit || format(E'%s klant ziet de onderhoudslijst niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  UPDATE public.onderhoudslijsten SET lijst = '{}' WHERE afspraak_id = afspraak;
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s klant kan de lijst niet wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  BEGIN
    INSERT INTO public.onderhoudslijsten (afspraak_id, lijst) VALUES (afspraak, '{}')
      ON CONFLICT (afspraak_id) DO UPDATE SET lijst = EXCLUDED.lijst;
    uit := uit || E'LEK klant kan een lijst toevoegen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan geen lijst toevoegen\n'; END;
  RESET ROLE;

  -- Afspraak weg → lijst mee weg
  DELETE FROM public.afspraken WHERE id = afspraak;
  SELECT count(*) INTO n FROM public.onderhoudslijsten WHERE afspraak_id = afspraak;
  uit := uit || format(E'%s lijst verdwijnt met de afspraak: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);

  RAISE EXCEPTION E'Testuitslag (wordt teruggedraaid):\n%', uit;
END $$;
