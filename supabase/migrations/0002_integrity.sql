BEGIN;

-- NOT VALID preserves legacy rows; constraints apply to all new/changed rows.
ALTER TABLE public.meal_items ADD CONSTRAINT meal_items_nutrition_valid
  CHECK (calories BETWEEN 0 AND 50000 AND protein_g BETWEEN 0 AND 5000 AND fat_g BETWEEN 0 AND 5000 AND carbs_g BETWEEN 0 AND 5000
    AND weight_grams <= 5000 AND (confidence IS NULL OR confidence BETWEEN 0 AND 1)) NOT VALID;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_nutrition_valid
  CHECK (length(trim(name)) BETWEEN 1 AND 200 AND calories_per_100g BETWEEN 0 AND 1000
    AND protein_per_100g BETWEEN 0 AND 100 AND fat_per_100g BETWEEN 0 AND 100
    AND carbs_per_100g BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.water_entries ADD CONSTRAINT water_amount_valid CHECK (amount_ml <= 10000) NOT VALID;
ALTER TABLE public.weight_entries ADD CONSTRAINT weight_range_valid CHECK (weight_kg BETWEEN 20 AND 500) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profile_targets_valid CHECK (
  (current_weight_kg IS NULL OR current_weight_kg BETWEEN 20 AND 500)
  AND (daily_calorie_target IS NULL OR daily_calorie_target BETWEEN 1200 AND 20000)
  AND (daily_protein_g IS NULL OR daily_protein_g BETWEEN 0 AND 5000)
  AND (daily_fat_g IS NULL OR daily_fat_g BETWEEN 0 AND 5000)
  AND (daily_carbs_g IS NULL OR daily_carbs_g BETWEEN 0 AND 5000)
  AND (daily_water_ml IS NULL OR daily_water_ml BETWEEN 0 AND 20000)) NOT VALID;

DROP POLICY "own" ON public.meal_items;
CREATE POLICY "own" ON public.meal_items FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.meal_entries m WHERE m.id = meal_entry_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.meal_entries m WHERE m.id = meal_entry_id AND m.user_id = (SELECT auth.uid())));
DROP POLICY "own" ON public.ai_feedback;
CREATE POLICY "own" ON public.ai_feedback FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (meal_entry_id IS NULL OR EXISTS (
    SELECT 1 FROM public.meal_entries m WHERE m.id = meal_entry_id AND m.user_id = (SELECT auth.uid()))));
DROP POLICY "insert own" ON public.food_items;
DROP POLICY "update own" ON public.food_items;
CREATE POLICY "insert own" ON public.food_items FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND NOT is_verified AND source = 'user_custom');
CREATE POLICY "update own" ON public.food_items FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND NOT is_verified)
  WITH CHECK (created_by = (SELECT auth.uid()) AND NOT is_verified AND source = 'user_custom');
ALTER FUNCTION public.uid() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- A stable client-generated UUID makes retries safe after an uncertain response.
CREATE FUNCTION public.save_meal(p_id uuid, p_date date, p_type text, p_items jsonb,
  p_photo text DEFAULT NULL, p_analysis jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE owner_id uuid := auth.uid(); item jsonb; idx integer := 0;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30
    THEN RAISE EXCEPTION 'Invalid items'; END IF;
  IF p_photo IS NOT NULL AND split_part(p_photo, '/', 1) <> owner_id::text
    THEN RAISE EXCEPTION 'Invalid photo owner'; END IF;
  INSERT INTO public.meal_entries(id,user_id,entry_date,meal_type,photo_storage_path,ai_raw_response,confidence)
    VALUES(p_id,owner_id,p_date,p_type,p_photo,p_analysis,(p_analysis->>'overall_confidence')::numeric)
    ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.meal_entries WHERE id=p_id AND user_id=owner_id)
      THEN RAISE EXCEPTION 'Invalid meal owner'; END IF;
    RETURN p_id;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF length(trim(coalesce(item->>'custom_food_name',''))) NOT BETWEEN 1 AND 200
      THEN RAISE EXCEPTION 'Invalid food name'; END IF;
    INSERT INTO public.meal_items(meal_entry_id,user_id,food_item_id,custom_food_name,weight_grams,
      calories,protein_g,fat_g,carbs_g,weight_source,confidence,position)
    VALUES(p_id,owner_id,(item->>'food_item_id')::uuid,item->>'custom_food_name',
      (item->>'weight_grams')::numeric,(item->>'calories')::numeric,
      (item->>'protein_g')::numeric,(item->>'fat_g')::numeric,(item->>'carbs_g')::numeric,
      item->>'weight_source',(item->>'confidence')::numeric,idx);
    idx := idx + 1;
  END LOOP;
  IF p_analysis IS NOT NULL THEN
    INSERT INTO public.ai_feedback(user_id,meal_entry_id,photo_storage_path,ai_prediction,user_correction,was_accepted)
      VALUES(owner_id,p_id,p_photo,p_analysis,p_items,true);
  END IF;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.save_meal(uuid,date,text,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_meal(uuid,date,text,jsonb,text,jsonb) TO authenticated;

-- Shared, atomic quota: survives serverless cold starts and concurrent requests.
CREATE TABLE public.ai_usage (user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  usage_day date, count integer NOT NULL DEFAULT 0, last_request timestamptz NOT NULL,
  PRIMARY KEY(user_id,usage_day));
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_usage_usage_day_idx ON public.ai_usage(usage_day);
CREATE FUNCTION public.consume_ai_quota() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := auth.uid(); accepted uuid;
BEGIN
  IF owner_id IS NULL THEN RETURN false; END IF;
  DELETE FROM public.ai_usage WHERE usage_day < CURRENT_DATE - 30;
  INSERT INTO public.ai_usage VALUES(owner_id,CURRENT_DATE,1,now())
  ON CONFLICT(user_id,usage_day) DO UPDATE SET count=public.ai_usage.count+1,last_request=now()
    WHERE public.ai_usage.count < 20 AND public.ai_usage.last_request < now()-interval '10 seconds'
  RETURNING user_id INTO accepted;
  RETURN accepted IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;

CREATE FUNCTION public.save_weight(p_weight numeric,p_date date,p_targets jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.weight_entries(user_id,weight_kg,recorded_at) VALUES(auth.uid(),p_weight,p_date)
    ON CONFLICT(user_id,recorded_at) DO UPDATE SET weight_kg=excluded.weight_kg;
  UPDATE public.profiles SET current_weight_kg=p_weight,
    daily_calorie_target=coalesce((p_targets->>'daily_calorie_target')::integer,daily_calorie_target),
    daily_protein_g=coalesce((p_targets->>'daily_protein_g')::integer,daily_protein_g),
    daily_fat_g=coalesce((p_targets->>'daily_fat_g')::integer,daily_fat_g),
    daily_carbs_g=coalesce((p_targets->>'daily_carbs_g')::integer,daily_carbs_g),
    daily_water_ml=coalesce((p_targets->>'daily_water_ml')::integer,daily_water_ml)
    WHERE id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_weight(numeric,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_weight(numeric,date,jsonb) TO authenticated;

COMMIT;
