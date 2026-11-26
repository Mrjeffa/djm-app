-- Onderdelen-links veilig + registratiegegevens in het klantrecord (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migraties "links_en_registratie" en
-- "registratie_koppelen_na_goedkeuring" (26-11-2026: koppelen altijd via goedkeuring).
-- Herhaalbaar: opnieuw draaien geeft geen fouten.

-- 1. Onderdelen-link: alleen een gewoon webadres. Klanten kunnen dit veld bij hun eigen motor
--    invullen; een "javascript:"-link zou anders draaien als de beheerder op
--    "Onderdelen bestellen" klikt (de app controleert het nu ook zelf, lib/larsson.js).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motoren_onderdelen_link_http') THEN
    ALTER TABLE public.motoren ADD CONSTRAINT motoren_onderdelen_link_http
      CHECK (onderdelen_link IS NULL OR onderdelen_link = '' OR onderdelen_link ~* '^https?://[^[:space:]]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voorraad_onderdelen_link_http') THEN
    ALTER TABLE public.voorraad ADD CONSTRAINT voorraad_onderdelen_link_http
      CHECK (onderdelen_link IS NULL OR onderdelen_link = '' OR onderdelen_link ~* '^https?://[^[:space:]]+$');
  END IF;
END $$;

-- 2. Bij registratie: naam, telefoon, adres en woonplaats uit het aanmeldformulier meteen in
--    het klantrecord (voorheen bleef de naam leeg en zag de beheerder een naamloze aanvraag).
--    Koppelen aan een bestaand klantrecord zet het altijd op "in afwachting" (behalve
--    "afgewezen"): de beheerder keurt goed. Reden (26-11-2026): e-mailbevestiging staat uit,
--    dus wie zich aanmeldt met het e-mailadres van een bestaande klant zou anders meteen diens
--    motoren en gegevens zien.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bestaande_klant_id uuid;
  meta  jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_naam text := nullif(btrim(concat_ws(' ', meta->>'voornaam', meta->>'achternaam')), '');
BEGIN
  -- Geen klantrecord voor beheerders (gemarkeerd in raw_user_meta_data)
  IF (meta->>'is_admin')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT id INTO bestaande_klant_id
  FROM public.klanten
  WHERE email = NEW.email AND user_id IS NULL
  LIMIT 1;

  IF bestaande_klant_id IS NOT NULL THEN
    UPDATE public.klanten SET
      user_id    = NEW.id,
      status     = CASE WHEN status = 'afgewezen' THEN status ELSE 'in_afwachting' END,
      naam       = COALESCE(nullif(naam, ''), v_naam, naam),
      telefoon   = COALESCE(nullif(telefoon, ''), nullif(meta->>'telefoon', ''), telefoon),
      adres      = COALESCE(nullif(adres, ''), nullif(meta->>'adres', ''), adres),
      woonplaats = COALESCE(nullif(woonplaats, ''), nullif(meta->>'woonplaats', ''), woonplaats)
    WHERE id = bestaande_klant_id;
  ELSE
    INSERT INTO public.klanten (user_id, email, naam, telefoon, adres, woonplaats, status)
    VALUES (NEW.id, NEW.email, COALESCE(v_naam, ''), nullif(meta->>'telefoon', ''),
            nullif(meta->>'adres', ''), nullif(meta->>'woonplaats', ''), 'in_afwachting');
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Zelf koppelen via de API (policy klant_koppel_zichzelf) gaat ook via goedkeuring: wie een
--    klantrecord zonder account aan zichzelf koppelt, komt op "in afwachting" (behalve
--    "afgewezen"). Voorheen bleef de status staan, bv. "goedgekeurd".
CREATE OR REPLACE FUNCTION public.bewaak_klanten_mutaties()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  koppelt boolean;
  ontkoppelt boolean;
BEGIN
  -- Systeemcontext (signup-trigger, geen JWT) en admin: alles toegestaan
  IF uid IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'in_afwachting'; -- zelfregistratie nooit direct goedgekeurd
    RETURN NEW;
  END IF;
  koppelt    := OLD.user_id IS NULL AND NEW.user_id = uid;      -- account koppelen
  ontkoppelt := OLD.user_id = uid AND NEW.user_id IS NULL;      -- eigen account verwijderen
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT koppelt AND NOT ontkoppelt THEN
    RAISE EXCEPTION 'Accountkoppeling kan niet gewijzigd worden';
  END IF;
  IF koppelt THEN
    NEW.status := CASE WHEN OLD.status = 'afgewezen' THEN OLD.status ELSE 'in_afwachting' END;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (koppelt AND NEW.status = 'in_afwachting')
     AND NOT (ontkoppelt AND NEW.status = 'gearchiveerd') THEN
    RAISE EXCEPTION 'Status kan alleen door De Jonge Motoren gewijzigd worden';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'E-mailadres kan alleen door De Jonge Motoren gewijzigd worden';
  END IF;
  RETURN NEW;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.bewaak_klanten_mutaties() FROM PUBLIC, anon, authenticated;
