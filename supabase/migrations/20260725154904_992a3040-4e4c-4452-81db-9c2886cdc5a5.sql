GRANT SELECT ON public.help_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;

GRANT SELECT ON public.help_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_categories TO authenticated;
GRANT ALL ON public.help_categories TO service_role;

GRANT SELECT, INSERT ON public.help_article_views TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_article_views TO authenticated;
GRANT ALL ON public.help_article_views TO service_role;

GRANT SELECT, INSERT ON public.help_feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_feedback TO authenticated;
GRANT ALL ON public.help_feedback TO service_role;