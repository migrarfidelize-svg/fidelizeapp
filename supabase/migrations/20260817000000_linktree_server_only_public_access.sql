-- Public link trees are resolved by a trusted TanStack server function.  Keep
-- RLS enabled and remove the legacy browser/anon SELECT path.
REVOKE SELECT ON public.link_tree_pages FROM anon;
REVOKE SELECT ON public.link_tree_links FROM anon;

DROP POLICY IF EXISTS "Public can read published pages" ON public.link_tree_pages;
DROP POLICY IF EXISTS "Public can read links of published pages" ON public.link_tree_links;
