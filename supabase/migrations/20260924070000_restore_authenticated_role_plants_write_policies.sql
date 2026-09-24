-- Restore `TO authenticated` on the plants write policies.
--
-- Why: 20260908114134 created these policies `TO authenticated`;
-- 20260923125258 recreated them without `TO`, so they now apply to PUBLIC
-- (pg_policies.roles = {public}). Access is the same in practice (anon has
-- auth.uid() = NULL), but scoping to authenticated restores defense in depth.
--
-- ALTER POLICY ... TO only changes the role list; USING / WITH CHECK
-- (including the (SELECT auth.uid()) initplan fix) stay exactly as they are.
-- The server writes through a direct pg connection (src/db/supabase-catalog.js),
-- not PostgREST, so application write paths are unaffected.
--
-- Rollback:
--   ALTER POLICY "Admins can delete plants" ON public.plants TO public;
--   ALTER POLICY "Editors and admins can insert plants" ON public.plants TO public;
--   ALTER POLICY "Editors and admins can update plants" ON public.plants TO public;

ALTER POLICY "Admins can delete plants" ON public.plants TO authenticated;
ALTER POLICY "Editors and admins can insert plants" ON public.plants TO authenticated;
ALTER POLICY "Editors and admins can update plants" ON public.plants TO authenticated;
