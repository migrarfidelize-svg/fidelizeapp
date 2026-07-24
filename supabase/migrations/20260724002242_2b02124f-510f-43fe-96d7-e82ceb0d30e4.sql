-- help_categories: remove redundant read_all (true) que expõe categorias inativas.
-- read_public (active=true) e read_admin já cobrem os casos legítimos.
DROP POLICY IF EXISTS help_categories_read_all ON public.help_categories;

-- kb_categories: restringir leitura pública a categorias que possuam ao menos
-- um artigo publicado — evita expor categorias vazias/rascunho de estabelecimentos.
DROP POLICY IF EXISTS kbc_public_select ON public.kb_categories;
CREATE POLICY kbc_public_select ON public.kb_categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.kb_articles a
    WHERE a.category_id = kb_categories.id AND a.published = true
  )
);