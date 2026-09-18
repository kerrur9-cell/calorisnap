-- Search visible products by exact substring first, then pg_trgm similarity.
CREATE OR REPLACE FUNCTION public.search_foods(p_query text, p_limit integer DEFAULT 20)
RETURNS SETOF public.food_items
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT f.* FROM public.food_items f
  WHERE length(trim(p_query)) BETWEEN 2 AND 100
    AND (
      f.name ILIKE '%' || p_query || '%'
      OR f.name_local ILIKE '%' || p_query || '%'
      OR greatest(
        word_similarity(p_query, f.name),
        word_similarity(p_query, coalesce(f.name_local, ''))
      ) >= 0.28
    )
  ORDER BY
    CASE
      WHEN f.name_local ILIKE p_query || '%' OR f.name ILIKE p_query || '%' THEN 0
      WHEN f.name_local ILIKE '%' || p_query || '%' OR f.name ILIKE '%' || p_query || '%' THEN 1
      ELSE 2
    END,
    greatest(
      word_similarity(p_query, f.name),
      word_similarity(p_query, coalesce(f.name_local, ''))
    ) DESC,
    f.is_verified DESC,
    f.name
  LIMIT least(greatest(p_limit, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.search_foods(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_foods(text, integer) TO authenticated;
