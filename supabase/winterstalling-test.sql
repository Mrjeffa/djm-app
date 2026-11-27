-- Test van supabase/winterstalling.sql. Wijzigt niets: alles in één transactie die aan het eind
-- met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
DO $$
DECLARE uit text := ''; n int; r jsonb; klant uuid; ander uuid; motor uuid; vreemd uuid; w uuid := gen_random_uuid();
BEGIN
  SELECT id INTO klant FROM public.klanten WHERE user_id IS NOT NULL AND status = 'goedgekeurd' LIMIT 1;
  INSERT INTO public.klanten (naam, email, status) VALUES ('Test Zonder Mail', NULL, 'goedgekeurd') RETURNING id INTO ander;
  INSERT INTO public.klanten (naam, email, status) VALUES ('Nog Een Zonder Mail', NULL, 'goedgekeurd');
  uit := uit || E'OK  twee klanten zonder e-mailadres\n';
  INSERT INTO public.motoren (klant_id, merk, model, kenteken) VALUES (klant, 'Testmerk', 'Eigen', '') RETURNING id INTO motor;
  INSERT INTO public.motoren (klant_id, merk, model, kenteken) VALUES (ander, 'Testmerk', 'Vreemd', '') RETURNING id INTO vreemd;
  INSERT INTO public.winterstalling (id, seizoen, status, klant_id, motor_id, naam, opmerking) VALUES (w, 2099, 'binnen', klant, motor, 'Test', 'intern');
  BEGIN
    INSERT INTO public.winterstalling (seizoen, motor_id) VALUES (2099, motor);
    uit := uit || E'FOUT motor twee keer in hetzelfde seizoen\n';
  EXCEPTION WHEN unique_violation THEN uit := uit || E'OK  motor maar één keer per seizoen\n'; END;

  -- Bezoeker website
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.winterstalling;
    uit := uit || format(E'LEK website kan de stallingslijst lezen (%s)\n', n);
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan de stallingslijst niet lezen\n'; END;
  BEGIN
    INSERT INTO public.winterstalling (seizoen, naam) VALUES (2099, 'x');
    uit := uit || E'LEK website kan rechtstreeks toevoegen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  website kan niet rechtstreeks toevoegen\n'; END;
  r := public.vraag_winterstalling_aan('Piet Test', '0612345678', 'Piet@Example.com', 'Honda', 'CB500F', 'ab-123-c', 'Winterstalling met poetsbeurt', 'Graag ook banden');
  uit := uit || format(E'%s aanvraag via website: %s\n', CASE WHEN (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r);
  r := public.vraag_winterstalling_aan('P', '0612345678', NULL, 'Honda');
  uit := uit || format(E'%s naam te kort geweigerd: %s\n', CASE WHEN NOT (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r->>'fout');
  r := public.vraag_winterstalling_aan('Piet Test', '0612', NULL, 'Honda');
  uit := uit || format(E'%s telefoon te kort geweigerd: %s\n', CASE WHEN NOT (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r->>'fout');
  r := public.vraag_winterstalling_aan('Piet Test', '0612345678', 'geen-mail', 'Honda');
  uit := uit || format(E'%s ongeldig e-mailadres geweigerd: %s\n', CASE WHEN NOT (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r->>'fout');
  PERFORM public.vraag_winterstalling_aan('Piet Test', '06-12345678', NULL, 'Honda');
  PERFORM public.vraag_winterstalling_aan('Piet Test', '06 1234 5678', NULL, 'Honda');
  r := public.vraag_winterstalling_aan('Piet Test', '0612345678', NULL, 'Honda');
  uit := uit || format(E'%s vierde aanvraag met hetzelfde nummer geweigerd: %s\n', CASE WHEN NOT (r->>'success')::boolean THEN 'OK ' ELSE 'FOUT' END, r->>'fout');
  RESET ROLE;
  SELECT count(*) INTO n FROM public.winterstalling WHERE bron = 'website' AND naam = 'Piet Test' AND status = 'aangevraagd'
    AND email = 'piet@example.com' AND kenteken = 'AB123C' AND werkzaamheden = 'Graag ook banden';
  uit := uit || format(E'%s aanvraag opgeslagen als aangevraagd (e-mail klein, kenteken zonder streepjes): %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);

  -- Ingelogde klant
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',(SELECT user_id FROM public.klanten WHERE id = klant))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.winterstalling WHERE id = w;
  uit := uit || format(E'%s klant ziet de lijst niet (ook eigen regel niet, i.v.m. interne opmerking): %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  BEGIN
    INSERT INTO public.winterstalling (seizoen, status, klant_id, motor_id, naam, bron) VALUES (2098, 'aangevraagd', klant, motor, 'Mijn aanvraag', 'klantportaal');
    uit := uit || E'OK  klant kan een aanvraag voor zichzelf doen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'FOUT klant kan geen aanvraag doen\n'; END;
  BEGIN
    INSERT INTO public.winterstalling (seizoen, status, klant_id, naam, bron) VALUES (2098, 'binnen', klant, 'x', 'klantportaal');
    uit := uit || E'LEK klant kan zichzelf op binnen zetten\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan alleen aanvragen (niet zelf op binnen)\n'; END;
  BEGIN
    INSERT INTO public.winterstalling (seizoen, status, klant_id, motor_id, naam, bron) VALUES (2098, 'aangevraagd', klant, vreemd, 'x', 'klantportaal');
    uit := uit || E'LEK klant kan andermans motor aanmelden\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan geen motor van een ander aanmelden\n'; END;
  BEGIN
    INSERT INTO public.winterstalling (seizoen, status, klant_id, naam, bron) VALUES (2098, 'aangevraagd', ander, 'x', 'klantportaal');
    uit := uit || E'LEK klant kan namens een ander aanvragen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan niet namens een ander aanvragen\n'; END;
  BEGIN
    INSERT INTO public.winterstalling (seizoen, status, klant_id, naam, bron, betaald) VALUES (2098, 'aangevraagd', klant, 'x', 'klantportaal', true);
    uit := uit || E'LEK klant kan zichzelf op betaald zetten\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan niet zelf op betaald zetten\n'; END;
  UPDATE public.winterstalling SET betaald = true WHERE id = w;
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s klant kan niets wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK ' END, n);
  RESET ROLE;

  RAISE EXCEPTION E'Testuitslag (wordt teruggedraaid):\n%', uit;
END $$;
