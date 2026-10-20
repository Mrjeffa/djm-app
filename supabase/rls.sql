-- RLS-aanscherping na de controle van oktober 2026.
-- Toegepast op Supabase (project xftnovnldcdfohqlqgor) als migratie "rls_aanscherping".
-- Herhaalbaar: opnieuw draaien geeft geen fouten.

-- 1. klanten: een klant leest en wijzigt alleen zijn eigen record, maar kan het niet
--    verwijderen. Verwijderen wiste via ON DELETE CASCADE ook al zijn motoren,
--    onderhoudshistorie en afspraken; account opheffen loopt via verwijder_eigen_account
--    (archiveert). Status, e-mail en koppeling bewaakt trigger bewaak_klanten_mutaties.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'klanten' AND policyname = 'klant_eigen') THEN
    ALTER POLICY klant_eigen ON public.klanten
      USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
    ALTER POLICY klant_eigen ON public.klanten RENAME TO klanten_admin;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'klanten' AND policyname = 'klant_eigen_lezen') THEN
    CREATE POLICY klant_eigen_lezen ON public.klanten FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'klanten' AND policyname = 'klant_eigen_wijzigen') THEN
    CREATE POLICY klant_eigen_wijzigen ON public.klanten FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2. taken: takenlijst van de beheerder; klanten konden er ook rijen in aanmaken.
ALTER POLICY eigen_taken ON public.taken
  USING (((SELECT auth.uid()) = user_id) AND (SELECT public.is_admin()))
  WITH CHECK (((SELECT auth.uid()) = user_id) AND (SELECT public.is_admin()));

-- 3. voorraad: door de beheerder verwijderde motoren niet meer tonen aan klanten/website.
ALTER POLICY voorraad_klant_select ON public.voorraad
  USING ((status IS DISTINCT FROM 'verwijderd') AND (
    ((verkocht_op IS NULL) AND (status <> 'niet_beschikbaar'))
    OR ((verkocht_op IS NOT NULL) AND (verkocht_op >= (CURRENT_DATE - '30 days'::interval)))));
