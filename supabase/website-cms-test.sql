-- Test van het website-beheer (supabase/website_cms.sql). Wijzigt niets: alles in één transactie
-- die aan het eind met een (bedoelde) foutmelding wordt teruggedraaid; de uitkomst staat in die melding.
-- Draaien: Supabase → SQL Editor → plak dit bestand → Run.
-- Laatste uitkomst (26-11-2026): 19 controles OK (66 velden, 11 vragen, 6 teksten overgenomen).
DO $$
DECLARE uit text := ''; n int; k text; admin_id uuid; klant_uid uuid := gen_random_uuid(); p_id uuid;
BEGIN
  SELECT count(*) INTO n FROM public.website_blokken;
  uit := uit || format(E'%s velden in website_blokken: %s\n', CASE WHEN n >= 66 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.website_faq;
  uit := uit || format(E'INFO vragen in website_faq: %s\n', n);

  -- Bezoeker
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.website_blokken;
  uit := uit || format(E'%s bezoeker leest alle velden: %s\n', CASE WHEN n >= 66 THEN 'OK ' ELSE 'FOUT' END, n);
  UPDATE public.website_blokken SET waarde = '"gehackt"' WHERE sleutel = 'home.hero.titel1';
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s bezoeker kan veld niet wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  BEGIN
    INSERT INTO public.website_faq (groep, vraag, antwoord) VALUES ('kopen', 'Spamvraag hier?', 'Een antwoord van ruim twintig tekens.');
    uit := uit || E'LEK bezoeker kan FAQ toevoegen\n';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN uit := uit || E'OK  bezoeker kan geen FAQ toevoegen\n'; END;
  SELECT count(*) INTO n FROM public.website_blokken_historie;
  uit := uit || format(E'%s bezoeker ziet geen historie: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  RESET ROLE;

  -- Ingelogde klant (geen beheerder)
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',klant_uid)::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.website_blokken SET waarde = '"gehackt"' WHERE sleutel = 'home.hero.titel1';
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s klant kan veld niet wijzigen: %s rijen\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  BEGIN
    INSERT INTO public.blog_posts (slug, titel, beschrijving, inhoud, categorie, status, gepubliceerd_op)
    VALUES ('test-artikel', 'Een testartikel van een klant', repeat('x', 80), 'inhoud', 'Nieuws', 'gepubliceerd', current_date);
    uit := uit || E'LEK klant kan blog plaatsen\n';
  EXCEPTION WHEN insufficient_privilege THEN uit := uit || E'OK  klant kan geen blog plaatsen (RLS-fout)\n'; END;
  RESET ROLE;

  -- Beheerder
  SELECT id INTO admin_id FROM public.admins LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',admin_id)::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.website_blokken SET waarde = '"Nieuwe titel."' WHERE sleutel = 'home.hero.titel1';
  GET DIAGNOSTICS n = ROW_COUNT;
  uit := uit || format(E'%s beheerder wijzigt veld: %s rij\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT count(*) INTO n FROM public.website_blokken_historie WHERE sleutel = 'home.hero.titel1' AND gewijzigd_op = now();
  uit := uit || format(E'%s historie bewaard: %s versie(s)\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  SELECT (bijgewerkt_door = admin_id)::text INTO k FROM public.website_blokken WHERE sleutel = 'home.hero.titel1';
  uit := uit || format(E'%s bijgewerkt_door = beheerder: %s\n', CASE WHEN k = 'true' THEN 'OK ' ELSE 'FOUT' END, k);
  BEGIN
    UPDATE public.website_blokken SET waarde = '"klik [hier](javascript:alert(1))"' WHERE sleutel = 'home.hero.ondertitel';
    uit := uit || E'LEK javascript-link geaccepteerd\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  javascript-link geweigerd\n'; END;
  BEGIN
    UPDATE public.website_blokken SET waarde = '{"url":"http://onveilig.nl/a.jpg","alt":"Een foto van iets","breedte":1,"hoogte":1}' WHERE sleutel = 'home.hero.afbeelding';
    uit := uit || E'FOUT afbeelding via http geaccepteerd\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  afbeelding zonder https geweigerd\n'; END;
  BEGIN
    INSERT INTO public.website_faq (groep, vraag, antwoord, link_href) VALUES ('kopen', 'Een testvraag?', 'Een antwoord van ruim twintig tekens.', '//kwaadaardig.nl');
    uit := uit || E'LEK FAQ-link naar ander domein geaccepteerd\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  FAQ-link //ander-domein geweigerd\n'; END;
  INSERT INTO public.website_faq (groep, vraag, antwoord, link_href, actief) VALUES ('kopen', 'Verborgen testvraag?', 'Een antwoord van ruim twintig tekens.', '/proefrit', false);
  INSERT INTO public.website_paginas (sjabloon, slug, titel, intro, status) VALUES ('dienst', 'test-banden-wisselen', 'Motorbanden wisselen in Tholen', repeat('Intro over banden wisselen. ', 3), 'concept') RETURNING id INTO p_id;
  UPDATE public.website_paginas SET volgorde = 5 WHERE id = p_id;
  SELECT count(*) INTO n FROM public.website_paginas_historie WHERE pagina_id = p_id;
  uit := uit || format(E'%s alleen volgorde wijzigen maakt geen versie: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'FOUT' END, n);
  UPDATE public.website_paginas SET titel = 'Motorbanden vervangen in Tholen' WHERE id = p_id;
  SELECT count(*) INTO n FROM public.website_paginas_historie WHERE pagina_id = p_id;
  uit := uit || format(E'%s titel wijzigen maakt een versie: %s\n', CASE WHEN n = 1 THEN 'OK ' ELSE 'FOUT' END, n);
  BEGIN
    UPDATE public.website_paginas SET status = 'gepubliceerd' WHERE id = p_id;
    uit := uit || E'FOUT publiceren zonder datum geaccepteerd\n';
  EXCEPTION WHEN check_violation THEN uit := uit || E'OK  publiceren vraagt een publicatiedatum\n'; END;
  RESET ROLE;

  -- Bezoeker ziet concept en verborgen vraag niet
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.website_paginas WHERE id = p_id;
  uit := uit || format(E'%s bezoeker ziet conceptpagina niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  SELECT count(*) INTO n FROM public.website_faq WHERE vraag = 'Verborgen testvraag?';
  uit := uit || format(E'%s bezoeker ziet inactieve vraag niet: %s\n', CASE WHEN n = 0 THEN 'OK ' ELSE 'LEK' END, n);
  RESET ROLE;
  RAISE EXCEPTION E'CMS-TEST (alles teruggedraaid)\n%', uit;
END $$;
