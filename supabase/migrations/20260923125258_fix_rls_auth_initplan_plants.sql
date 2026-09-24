-- Exported 2026-09-24 from the live project (sxuxtsbyqjaodyuqebux) via
-- `select statements from supabase_migrations.schema_migrations
--  where version = '20260923125258'`. The migration was applied remotely on
-- 2026-09-23 without a repo file; the statements below are verbatim.
-- Do not re-apply: the live database already has this version.
--
-- Known drift (needs owner approval to change, CLAUDE.md §4.7): the original
-- policies in 20260908114134 were `TO authenticated`; these recreate them
-- without `TO`, so pg_policies.roles is now {public}. Access is unchanged in
-- practice (anon has auth.uid() = NULL, so EXISTS is false), but the role
-- scoping was lost.

-- Fix auth RLS initialization plan: wrap auth.uid() in (select ...) so it is
-- evaluated once per query instead of once per row.

-- Admins can delete plants
DROP POLICY IF EXISTS "Admins can delete plants" ON public.plants;
CREATE POLICY "Admins can delete plants" ON public.plants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

-- Editors and admins can insert plants
DROP POLICY IF EXISTS "Editors and admins can insert plants" ON public.plants;
CREATE POLICY "Editors and admins can insert plants" ON public.plants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['editor', 'admin'])
    )
  );

-- Editors and admins can update plants
DROP POLICY IF EXISTS "Editors and admins can update plants" ON public.plants;
CREATE POLICY "Editors and admins can update plants" ON public.plants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['editor', 'admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['editor', 'admin'])
    )
  );
