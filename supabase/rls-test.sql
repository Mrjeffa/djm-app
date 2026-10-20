-- RLS-test: probeert als klant, buitenstaander en beheerder te lezen en te wijzigen
-- en meldt per controle OK / LEK. Wijzigt niets: alles gebeurt in één transactie die
-- aan het eind met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat
-- in die foutmelding. Draaien: Supabase → SQL Editor → plak dit bestand → Run.
-- Laatste uitkomst (20-10-2026): 50 controles, alle OK.
DO $$
DECLARE
  uit text := ''; n int;
  klant uuid; klant_user uuid; klant_email text; ander_klant uuid; eigen_motor uuid; ander_motor uuid;
  ander_afspraak uuid; eigen_afspraak uuid; admin_id uuid; admin_svc uuid;
  e_mot int; e_afs int; e_km int; e_svc int;
  t_kl int; t_mot int; t_afs int; t_km int; t_svc int; t_leads int; t_vrd int;
BEGIN
  -- Testpersonen: een klant met account, een andere klant, en de beheerder
  SELECT k.id, k.user_id, k.email INTO klant, klant_user, klant_email FROM public.klanten k
   WHERE k.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.id = k.user_id) LIMIT 1;
  SELECT id INTO ander_klant FROM public.klanten WHERE id <> klant LIMIT 1;
  SELECT id INTO eigen_motor FROM public.motoren WHERE klant_id = klant LIMIT 1;
  SELECT id INTO ander_motor FROM public.motoren WHERE klant_id <> klant LIMIT 1;
  SELECT id INTO ander_afspraak FROM public.afspraken WHERE klant_id IS DISTINCT FROM klant LIMIT 1;
  SELECT id INTO eigen_afspraak FROM public.afspraken WHERE klant_id = klant LIMIT 1;
  SELECT id INTO admin_id FROM public.admins LIMIT 1;
  SELECT s.id INTO admin_svc FROM public.service_beurten s WHERE s.motor_id = eigen_motor AND NOT coalesce(s.klant_invoer,false) LIMIT 1;
  SELECT count(*) INTO e_mot FROM public.motoren WHERE klant_id = klant;
  SELECT count(*) INTO e_afs FROM public.afspraken WHERE klant_id = klant;
  SELECT count(*) INTO e_km FROM public.km_historie h JOIN public.motoren m ON m.id = h.motor_id WHERE m.klant_id = klant;
  SELECT count(*) INTO e_svc FROM public.service_beurten s JOIN public.motoren m ON m.id = s.motor_id WHERE m.klant_id = klant;
  SELECT count(*) INTO t_kl FROM public.klanten; SELECT count(*) INTO t_mot FROM public.motoren;
  SELECT count(*) INTO t_afs FROM public.afspraken; SELECT count(*) INTO t_km FROM public.km_historie;
  SELECT count(*) INTO t_svc FROM public.service_beurten; SELECT count(*) INTO t_leads FROM public.inkoop_leads;
  SELECT count(*) INTO t_vrd FROM public.voorraad;
  uit := uit || format(E'Testdata: %s klanten, %s motoren (%s eigen), %s afspraken (%s eigen), andere klant/motor/afspraak aanwezig: %s/%s/%s\n\n',
    t_kl, t_mot, e_mot, t_afs, e_afs, ander_klant IS NOT NULL, ander_motor IS NOT NULL, ander_afspraak IS NOT NULL);

  -- ═══ KLANT ═══
  PERFORM set_config('request.jwt.claims', json_build_object('sub', klant_user, 'role', 'authenticated', 'email', klant_email)::text, true);
  SET LOCAL ROLE authenticated;
  uit := uit || E'KLANT — lezen\n';
  SELECT count(*) INTO n FROM public.klanten;         uit := uit || format(E'%s klanten: ziet %s (verwacht 1)\n', CASE WHEN n=1 THEN 'OK ' ELSE 'LEK' END, n);
  SELECT count(*) INTO n FROM public.motoren;         uit := uit || format(E'%s motoren: ziet %s (verwacht %s)\n', CASE WHEN n=e_mot THEN 'OK ' ELSE 'LEK' END, n, e_mot);
  SELECT count(*) INTO n FROM public.afspraken;       uit := uit || format(E'%s afspraken: ziet %s (verwacht %s)\n', CASE WHEN n=e_afs THEN 'OK ' ELSE 'LEK' END, n, e_afs);
  SELECT count(*) INTO n FROM public.km_historie;     uit := uit || format(E'%s km_historie: ziet %s (verwacht %s)\n', CASE WHEN n=e_km THEN 'OK ' ELSE 'LEK' END, n, e_km);
  SELECT count(*) INTO n FROM public.service_beurten; uit := uit || format(E'%s service_beurten: ziet %s (verwacht %s)\n', CASE WHEN n=e_svc THEN 'OK ' ELSE 'LEK' END, n, e_svc);
  SELECT (SELECT count(*) FROM public.admins) + (SELECT count(*) FROM public.taken) + (SELECT count(*) FROM public.klussen)
       + (SELECT count(*) FROM public.inkoop_leads) + (SELECT count(*) FROM public.inkoop_aanvragen) + (SELECT count(*) FROM public.inkoop_populair)
       + (SELECT count(*) FROM public.inkoop_radar_status) + (SELECT count(*) FROM public.voorraad_inkoop) + (SELECT count(*) FROM public.voorraad_chassis)
       + (SELECT count(*) FROM public.voorraad_intern) + (SELECT count(*) FROM public.voorraad_prijscheck) + (SELECT count(*) FROM public.voorraad_service)
       + (SELECT count(*) FROM public.push_abonnementen) + (SELECT count(*) FROM public.push_log) + (SELECT count(*) FROM public.push_sleutels) INTO n;
  uit := uit || format(E'%s 15 beheertabellen samen: ziet %s rijen (verwacht 0)\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  SELECT count(*) INTO n FROM public.voorraad WHERE status IN ('niet_beschikbaar','verwijderd') AND verkocht_op IS NULL;
  uit := uit || format(E'%s voorraad niet-beschikbaar/verwijderd: ziet %s (verwacht 0)\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);

  uit := uit || E'KLANT — wijzigen\n';
  BEGIN UPDATE public.klanten SET naam = naam WHERE id = ander_klant; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s andere klant wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  andere klant wijzigen: geweigerd\n'; END;
  BEGIN UPDATE public.klanten SET naam = naam WHERE id = klant; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s eigen gegevens wijzigen: %s rij (mag)\n', CASE WHEN n=1 THEN 'OK ' ELSE 'FOUT' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT eigen gegevens wijzigen geweigerd: %s\n', SQLERRM); END;
  BEGIN UPDATE public.klanten SET status = 'goedgekeurd_test' WHERE id = klant;
    uit := uit || E'LEK eigen status wijzigen: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen status wijzigen: geweigerd\n'; END;
  BEGIN UPDATE public.klanten SET email = 'ander@example.com' WHERE id = klant;
    uit := uit || E'LEK eigen e-mailadres wijzigen: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen e-mailadres wijzigen: geweigerd\n'; END;
  BEGIN DELETE FROM public.klanten WHERE id = klant; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s eigen klantrecord verwijderen (wist alles): %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen klantrecord verwijderen: geweigerd\n'; END;
  BEGIN INSERT INTO public.motoren (klant_id, kenteken, merk, model) VALUES (ander_klant, 'X1', 'X', 'X');
    uit := uit || E'LEK motor bij andere klant aanmaken: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  motor bij andere klant aanmaken: geweigerd\n'; END;
  BEGIN UPDATE public.motoren SET merk = merk WHERE id = ander_motor; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s motor van ander wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  motor van ander wijzigen: geweigerd\n'; END;
  BEGIN DELETE FROM public.motoren WHERE id = ander_motor; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s motor van ander verwijderen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  motor van ander verwijderen: geweigerd\n'; END;
  BEGIN UPDATE public.motoren SET klant_id = ander_klant WHERE id = eigen_motor;
    uit := uit || E'LEK eigen motor naar andere klant verplaatsen: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen motor naar andere klant verplaatsen: geweigerd\n'; END;
  BEGIN INSERT INTO public.afspraken (klant_id, datum, type) VALUES (ander_klant, current_date + 3, 'service');
    uit := uit || E'LEK afspraak voor andere klant: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  afspraak voor andere klant: geweigerd\n'; END;
  BEGIN INSERT INTO public.afspraken (klant_id, motor_id, datum, type) VALUES (klant, ander_motor, current_date + 3, 'service');
    uit := uit || E'LEK afspraak op motor van ander: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  afspraak op motor van ander: geweigerd\n'; END;
  BEGIN UPDATE public.afspraken SET opmerking = 'x' WHERE id = ander_afspraak; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s afspraak van ander wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  afspraak van ander wijzigen: geweigerd\n'; END;
  IF eigen_afspraak IS NOT NULL THEN
    BEGIN UPDATE public.afspraken SET status = 'bevestigd', datum = datum + 1 WHERE id = eigen_afspraak;
      uit := uit || E'LEK eigen afspraak zelf bevestigen/verzetten: toegestaan\n';
    EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen afspraak zelf bevestigen/verzetten: geweigerd\n'; END;
    BEGIN DELETE FROM public.afspraken WHERE id = eigen_afspraak; GET DIAGNOSTICS n = ROW_COUNT;
      uit := uit || format(E'%s eigen afspraak verwijderen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
    EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  eigen afspraak verwijderen: geweigerd\n'; END;
  END IF;
  BEGIN INSERT INTO public.service_beurten (motor_id, datum, omschrijving, klant_invoer) VALUES (ander_motor, current_date, 'x', true);
    uit := uit || E'LEK onderhoud op motor van ander: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  onderhoud op motor van ander: geweigerd\n'; END;
  BEGIN INSERT INTO public.service_beurten (motor_id, datum, omschrijving, klant_invoer) VALUES (eigen_motor, current_date, 'x', false);
    uit := uit || E'LEK onderhoud invoeren als garage-beurt: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  onderhoud invoeren als garage-beurt: geweigerd\n'; END;
  IF admin_svc IS NOT NULL THEN
    BEGIN UPDATE public.service_beurten SET omschrijving = 'x' WHERE id = admin_svc; GET DIAGNOSTICS n = ROW_COUNT;
      uit := uit || format(E'%s garage-beurt wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
    EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  garage-beurt wijzigen: geweigerd\n'; END;
  END IF;
  BEGIN INSERT INTO public.km_historie (motor_id, km, datum) VALUES (ander_motor, 1, current_date);
    uit := uit || E'LEK km-stand op motor van ander: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  km-stand op motor van ander: geweigerd\n'; END;
  BEGIN INSERT INTO public.admins (id) VALUES (klant_user);
    uit := uit || E'LEK zichzelf admin maken: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  zichzelf admin maken: geweigerd\n'; END;
  BEGIN INSERT INTO public.taken (user_id, tekst) VALUES (klant_user, 'x');
    uit := uit || E'LEK taak aanmaken: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  taak aanmaken: geweigerd\n'; END;
  BEGIN INSERT INTO public.push_abonnementen (endpoint, p256dh, auth) VALUES ('https://x', 'x', 'x');
    uit := uit || E'LEK push-abonnement aanmaken: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  push-abonnement aanmaken: geweigerd\n'; END;
  BEGIN UPDATE public.voorraad SET prijs = prijs; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s voorraad wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  voorraad wijzigen: geweigerd\n'; END;
  BEGIN UPDATE public.instellingen SET opmerking = opmerking; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s instellingen wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  instellingen wijzigen: geweigerd\n'; END;
  BEGIN PERFORM public.delete_auth_user_by_id(admin_id);
    uit := uit || E'LEK ander account verwijderen: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  ander account verwijderen: geweigerd\n'; END;

  -- ═══ BUITENSTAANDER (anon) ═══
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  uit := uit || E'BUITENSTAANDER\n';
  SELECT (SELECT count(*) FROM public.klanten) + (SELECT count(*) FROM public.motoren) + (SELECT count(*) FROM public.afspraken)
       + (SELECT count(*) FROM public.km_historie) + (SELECT count(*) FROM public.service_beurten) INTO n;
  uit := uit || format(E'%s klantgegevens lezen: %s rijen (verwacht 0)\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  BEGIN INSERT INTO public.afspraken (naam, datum, type) VALUES ('x', current_date + 3, 'service');
    uit := uit || E'LEK direct afspraak invoegen (buiten formulier om): toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  direct afspraak invoegen: geweigerd (alleen via formulier-functie)\n'; END;
  BEGIN INSERT INTO public.klanten (naam, email) VALUES ('x', 'x@example.com');
    uit := uit || E'LEK klant aanmaken: toegestaan\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  klant aanmaken: geweigerd\n'; END;
  BEGIN UPDATE public.voorraad SET prijs = 1; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s voorraad wijzigen: %s rijen\n', CASE WHEN n=0 THEN 'OK ' ELSE 'LEK' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || E'OK  voorraad wijzigen: geweigerd\n'; END;

  -- ═══ BEHEERDER ═══
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  uit := uit || E'BEHEERDER\n';
  SELECT count(*) INTO n FROM public.klanten;         uit := uit || format(E'%s klanten: %s van %s\n', CASE WHEN n=t_kl THEN 'OK ' ELSE 'FOUT' END, n, t_kl);
  SELECT count(*) INTO n FROM public.motoren;         uit := uit || format(E'%s motoren: %s van %s\n', CASE WHEN n=t_mot THEN 'OK ' ELSE 'FOUT' END, n, t_mot);
  SELECT count(*) INTO n FROM public.afspraken;       uit := uit || format(E'%s afspraken: %s van %s\n', CASE WHEN n=t_afs THEN 'OK ' ELSE 'FOUT' END, n, t_afs);
  SELECT count(*) INTO n FROM public.km_historie;     uit := uit || format(E'%s km_historie: %s van %s\n', CASE WHEN n=t_km THEN 'OK ' ELSE 'FOUT' END, n, t_km);
  SELECT count(*) INTO n FROM public.service_beurten; uit := uit || format(E'%s service_beurten: %s van %s\n', CASE WHEN n=t_svc THEN 'OK ' ELSE 'FOUT' END, n, t_svc);
  SELECT count(*) INTO n FROM public.inkoop_leads;    uit := uit || format(E'%s inkoop_leads: %s van %s\n', CASE WHEN n=t_leads THEN 'OK ' ELSE 'FOUT' END, n, t_leads);
  SELECT count(*) INTO n FROM public.voorraad;        uit := uit || format(E'%s voorraad (incl. niet beschikbaar): %s van %s\n', CASE WHEN n=t_vrd THEN 'OK ' ELSE 'FOUT' END, n, t_vrd);
  BEGIN UPDATE public.klanten SET naam = naam WHERE id = ander_klant; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s klant wijzigen: %s rij\n', CASE WHEN n=1 THEN 'OK ' ELSE 'FOUT' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT klant wijzigen: %s\n', SQLERRM); END;
  BEGIN UPDATE public.afspraken SET status = status WHERE id = ander_afspraak; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s afspraak wijzigen: %s rij\n', CASE WHEN n=1 THEN 'OK ' ELSE 'FOUT' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT afspraak wijzigen: %s\n', SQLERRM); END;
  BEGIN INSERT INTO public.taken (user_id, tekst) VALUES (admin_id, 'test');
    uit := uit || E'OK  taak aanmaken\n';
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT taak aanmaken: %s\n', SQLERRM); END;
  BEGIN DELETE FROM public.motoren WHERE id = ander_motor; GET DIAGNOSTICS n = ROW_COUNT;
    uit := uit || format(E'%s motor verwijderen: %s rij\n', CASE WHEN n=1 THEN 'OK ' ELSE 'FOUT' END, n);
  EXCEPTION WHEN OTHERS THEN uit := uit || format(E'FOUT motor verwijderen: %s\n', SQLERRM); END;

  RESET ROLE;
  RAISE EXCEPTION E'RLS-TEST (alles teruggedraaid)\n%', uit;
END $$;
