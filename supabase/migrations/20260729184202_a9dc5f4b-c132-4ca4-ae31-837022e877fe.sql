
GRANT SELECT ON public.customer_reviews TO anon;

CREATE POLICY "Public can read non-hidden reviews of active establishments"
ON public.customer_reviews
FOR SELECT
TO anon, authenticated
USING (
  public_hidden = false
  AND EXISTS (
    SELECT 1 FROM public.establishments e
    WHERE e.id = customer_reviews.establishment_id AND e.active = true
  )
);
