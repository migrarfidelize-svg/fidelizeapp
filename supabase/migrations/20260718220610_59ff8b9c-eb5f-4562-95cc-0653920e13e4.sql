-- Fix help center public reads: RLS policy called is_super_admin() which
-- had EXECUTE revoked from anon/authenticated, breaking public SELECT.
-- Split into two policies: a simple public one for published rows and an
-- admin one for full access.

DROP POLICY IF EXISTS help_articles_read_published ON public.help_articles;

CREATE POLICY help_articles_read_public
  ON public.help_articles FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY help_articles_read_admin
  ON public.help_articles FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Same pattern for help_categories in case it has the same issue
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy
    WHERE polrelid = 'public.help_categories'::regclass
      AND pg_get_expr(polqual, polrelid) LIKE '%is_super_admin%'
      AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.help_categories', pol.polname);
  END LOOP;
END $$;

CREATE POLICY help_categories_read_public
  ON public.help_categories FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY help_categories_read_admin
  ON public.help_categories FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));