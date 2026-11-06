-- Onderdelen-links veilig + registratiegegevens in het klantrecord (november 2026).
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "links_en_registratie".
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
--    Koppelen aan een gearchiveerd klantrecord (klant die eerder zijn account verwijderde)
--    zet het weer op "in afwachting": de beheerder keurt opnieuw goed.
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
      status     = CASE WHEN status = 'gearchiveerd' THEN 'in_afwachting' ELSE status END,
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
