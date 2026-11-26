-- Test van supabase/verkoop_extras.sql. Wijzigt niets: alles in één transactie die aan het
-- eind met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
DO $$
DECLARE uit text := ''; n int; t text; klant uuid; motor uuid := gen_random_uuid(); vrd uuid := gen_random_uuid();
BEGIN
  SELECT id INTO klant FROM public.klanten WHERE user_id IS NOT NULL LIMIT 1;
  INSERT INTO public.motoren (id, klant_id, merk, model, kenteken) VALUES (motor, klant, 'Testmerk', 'Extra''s', 'TEST-EX');
  INSERT INTO public.motor_verkoop_extras (motor_id, extras, overig) VALUES (motor, ARRAY['Slot','Telefoonhouder'], 'Topkoffer');
  INSERT INTO public.voorraad (id, kenteken, merk, model, bouwjaar, km, prijs, status, fotos, extras_niet_aanbieden)
  VALUES (vrd, 'TEST-EV', 'Testmerk', 'Te koop', 2021, 1000, 5000, 'beschikbaar', '[]', ARRAY['Telefoonhouder']);

  SELECT jsonb_typeof(verkoop_extras) || ' met ' || jsonb_array_length(verkoop_extras) || ' extra''s' INTO t FROM public.instellingen WHERE id = 1;
  uit := uit || format(E'%s lijst in instellingen: %s\n', CASE WHEN t LIKE 'array%' THEN 'OK ' ELSE 'FOUT' END, t);

  -- Bezoeker website
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.motor_verkoop_extras;
    uit := uit || format(E'LEK website kan motor_verkoop_extras lezen (%s rijen)\n', n);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan motor_verkoop_extras niet lezen\n'; END;
  BEGIN
    SELECT array_to_string(extras_niet_aanbieden, ',') INTO t FROM public.voorraad WHERE id = vrd;
    uit := uit || format(E'LEK website kan extras_niet_aanbieden lezen: %s\n', t);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan extras_niet_aanbieden niet lezen\n'; END;
  RESET ROLE;

  -- Ingelogde klant (eigenaar van de motor)
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',(SELECT user_id FROM public.klanten WHERE id = klant))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.motoren WHERE id = motor;
  uit := uit || format(E'%s klant ziet eigen motor: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.motor_verkoop_extras WHERE motor_id = motor;
  uit := uit || format(E'%s klant ziet gekozen extra''s niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  UPDATE public.motor_verkoop_extras SET overig = 'gewijzigd' WHERE motor_id = motor;
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s klant kan extra''s niet wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  BEGIN
    INSERT INTO public.motor_verkoop_extras (motor_id, extras) VALUES (motor, ARRAY['Garantiepakket'])
      ON CONFLICT (motor_id) DO UPDATE SET extras = EXCLUDED.extras;
    uit := uit || E'LEK klant kan extra''s toevoegen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan extra''s niet toevoegen\n'; END;
  RESET ROLE;

  -- Motor weg → extra's mee weg
  DELETE FROM public.motoren WHERE id = motor;
  SELECT count(*) INTO n FROM public.motor_verkoop_extras WHERE motor_id = motor;
  uit := uit || format(E'%s extra''s verdwijnen met de motor: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);

  RAISE EXCEPTION E'Testuitslag (wordt teruggedraaid):\n%', uit;
END $$;
