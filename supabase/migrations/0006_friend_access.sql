-- ============================================================
-- 0006_friend_access.sql — CaloriSnap: Доступ друзей и гостевой профиль по коду
-- ============================================================

-- 1. Расширение таблицы профилей (при необходимости)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Таблицы для кодов доступа и связей друзей
CREATE TABLE IF NOT EXISTS public.friend_access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.friend_connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viewer_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friend_connections_unique_pair UNIQUE (owner_id, viewer_id),
  CONSTRAINT friend_connections_no_self CHECK (owner_id <> viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_access_codes_code ON public.friend_access_codes(code);
CREATE INDEX IF NOT EXISTS idx_friend_connections_owner_viewer ON public.friend_connections(owner_id, viewer_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_connections_viewer ON public.friend_connections(viewer_id, status);

-- RLS для таблиц кодов и подключений
ALTER TABLE public.friend_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_access_codes_own" ON public.friend_access_codes
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "friend_connections_select" ON public.friend_connections
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR viewer_id = (SELECT auth.uid()));

CREATE POLICY "friend_connections_owner_update" ON public.friend_connections
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR viewer_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR viewer_id = (SELECT auth.uid()));

CREATE POLICY "friend_connections_delete" ON public.friend_connections
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR viewer_id = (SELECT auth.uid()));

-- 2. Вспомогательная функция генерации читаемого кода формата CAL-XXXX-XXXX
CREATE OR REPLACE FUNCTION public.generate_friend_code_string()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text := '';
  i int;
  idx int;
BEGIN
  FOR i IN 1..8 LOOP
    idx := floor(random() * length(chars))::int + 1;
    res := res || substr(chars, idx, 1);
  END LOOP;
  RETURN 'CAL-' || substr(res, 1, 4) || '-' || substr(res, 5, 4);
END $$;

-- 3. Получение существующего активного кода или генерация нового
CREATE OR REPLACE FUNCTION public.generate_or_get_friend_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_code text;
  new_code text;
  attempts int := 0;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT code INTO existing_code
  FROM public.friend_access_codes
  WHERE user_id = current_user_id AND is_active = true;

  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  LOOP
    new_code := public.generate_friend_code_string();
    attempts := attempts + 1;
    BEGIN
      INSERT INTO public.friend_access_codes (user_id, code, is_active, updated_at)
      VALUES (current_user_id, new_code, true, NOW())
      ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, is_active = true, updated_at = NOW();
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique friend code';
      END IF;
    END;
  END LOOP;
END $$;

-- 4. Принудительное обновление/перегенерация кода (старый перестаёт действовать)
CREATE OR REPLACE FUNCTION public.refresh_friend_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
  new_code text;
  attempts int := 0;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  LOOP
    new_code := public.generate_friend_code_string();
    attempts := attempts + 1;
    BEGIN
      INSERT INTO public.friend_access_codes (user_id, code, is_active, updated_at)
      VALUES (current_user_id, new_code, true, NOW())
      ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, is_active = true, updated_at = NOW();
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique friend code';
      END IF;
    END;
  END LOOP;
END $$;

-- 5. Подключение к другу по его коду
CREATE OR REPLACE FUNCTION public.connect_friend_by_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_code text;
  target_user_id uuid;
  target_name text;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  normalized_code := upper(trim(coalesce(p_code, '')));

  IF normalized_code !~ '^CAL-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$' THEN
    RAISE EXCEPTION 'Неверный формат кода. Ожидается CAL-XXXX-XXXX';
  END IF;

  SELECT user_id INTO target_user_id
  FROM public.friend_access_codes
  WHERE code = normalized_code AND is_active = true;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Код друга не найден или недействителен';
  END IF;

  IF target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Нельзя добавить свой собственный код';
  END IF;

  INSERT INTO public.friend_connections (owner_id, viewer_id, status, updated_at)
  VALUES (target_user_id, current_user_id, 'active', NOW())
  ON CONFLICT (owner_id, viewer_id) DO UPDATE SET status = 'active', updated_at = NOW();

  SELECT coalesce(display_name, 'Друг') INTO target_name
  FROM public.profiles
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'owner_id', target_user_id,
    'display_name', target_name,
    'code', normalized_code
  );
END $$;

-- 6. Отзыв доступа у зрителя владельцем дневника
CREATE OR REPLACE FUNCTION public.revoke_viewer_access(p_viewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.friend_connections
  SET status = 'revoked', updated_at = NOW()
  WHERE owner_id = current_user_id AND viewer_id = p_viewer_id;
END $$;

-- 7. Отключение от друга со стороны зрителя
CREATE OR REPLACE FUNCTION public.disconnect_from_friend(p_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.friend_connections
  SET status = 'revoked', updated_at = NOW()
  WHERE owner_id = p_owner_id AND viewer_id = current_user_id;
END $$;

-- 8. Получение списка друзей (чьи профили я могу просматривать)
CREATE OR REPLACE FUNCTION public.get_my_friends()
RETURNS TABLE (
  owner_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  connected_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    p.id AS owner_id,
    coalesce(p.display_name, 'Друг') AS display_name,
    p.avatar_url,
    fc.created_at AS connected_at
  FROM public.friend_connections fc
  JOIN public.profiles p ON p.id = fc.owner_id
  WHERE fc.viewer_id = auth.uid() AND fc.status = 'active'
  ORDER BY fc.created_at DESC;
$$;

-- 9. Получение списка зрителей (кто имеет доступ ко мне)
CREATE OR REPLACE FUNCTION public.get_my_viewers()
RETURNS TABLE (
  viewer_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  connected_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    p.id AS viewer_id,
    coalesce(p.display_name, 'Пользователь') AS display_name,
    p.avatar_url,
    fc.created_at AS connected_at
  FROM public.friend_connections fc
  JOIN public.profiles p ON p.id = fc.viewer_id
  WHERE fc.owner_id = auth.uid() AND fc.status = 'active'
  ORDER BY fc.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.generate_or_get_friend_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_or_get_friend_code() TO authenticated;

REVOKE ALL ON FUNCTION public.refresh_friend_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_friend_code() TO authenticated;

REVOKE ALL ON FUNCTION public.connect_friend_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_friend_by_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_viewer_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_viewer_access(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.disconnect_from_friend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disconnect_from_friend(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_friends() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_friends() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_viewers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_viewers() TO authenticated;

-- ============================================================
-- 10. Обновление политик RLS для предоставления прав чтения друзьям
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_friend" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

CREATE POLICY "profiles_select_own_or_friend" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.profiles.id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = (SELECT auth.uid()));

-- meal_entries
DROP POLICY IF EXISTS "own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_select_own_or_friend" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_insert_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_update_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_delete_own" ON public.meal_entries;

CREATE POLICY "meal_entries_select_own_or_friend" ON public.meal_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.meal_entries.user_id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "meal_entries_insert_own" ON public.meal_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "meal_entries_update_own" ON public.meal_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "meal_entries_delete_own" ON public.meal_entries
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- meal_items
DROP POLICY IF EXISTS "own" ON public.meal_items;
DROP POLICY IF EXISTS "meal_items_select_own_or_friend" ON public.meal_items;
DROP POLICY IF EXISTS "meal_items_insert_own" ON public.meal_items;
DROP POLICY IF EXISTS "meal_items_update_own" ON public.meal_items;
DROP POLICY IF EXISTS "meal_items_delete_own" ON public.meal_items;

CREATE POLICY "meal_items_select_own_or_friend" ON public.meal_items
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.meal_items.user_id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "meal_items_insert_own" ON public.meal_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.meal_entries m
      WHERE m.id = meal_entry_id AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "meal_items_update_own" ON public.meal_items
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "meal_items_delete_own" ON public.meal_items
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- weight_entries
DROP POLICY IF EXISTS "own" ON public.weight_entries;
DROP POLICY IF EXISTS "weight_entries_select_own_or_friend" ON public.weight_entries;
DROP POLICY IF EXISTS "weight_entries_insert_own" ON public.weight_entries;
DROP POLICY IF EXISTS "weight_entries_update_own" ON public.weight_entries;
DROP POLICY IF EXISTS "weight_entries_delete_own" ON public.weight_entries;

CREATE POLICY "weight_entries_select_own_or_friend" ON public.weight_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.weight_entries.user_id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "weight_entries_insert_own" ON public.weight_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "weight_entries_update_own" ON public.weight_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "weight_entries_delete_own" ON public.weight_entries
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- workout_entries
DROP POLICY IF EXISTS "own workouts" ON public.workout_entries;
DROP POLICY IF EXISTS "workout_entries_select_own_or_friend" ON public.workout_entries;
DROP POLICY IF EXISTS "workout_entries_insert_own" ON public.workout_entries;
DROP POLICY IF EXISTS "workout_entries_update_own" ON public.workout_entries;
DROP POLICY IF EXISTS "workout_entries_delete_own" ON public.workout_entries;

CREATE POLICY "workout_entries_select_own_or_friend" ON public.workout_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.workout_entries.user_id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "workout_entries_insert_own" ON public.workout_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "workout_entries_update_own" ON public.workout_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "workout_entries_delete_own" ON public.workout_entries
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- water_entries
DROP POLICY IF EXISTS "own" ON public.water_entries;
DROP POLICY IF EXISTS "water_entries_select_own_or_friend" ON public.water_entries;
DROP POLICY IF EXISTS "water_entries_insert_own" ON public.water_entries;
DROP POLICY IF EXISTS "water_entries_update_own" ON public.water_entries;
DROP POLICY IF EXISTS "water_entries_delete_own" ON public.water_entries;

CREATE POLICY "water_entries_select_own_or_friend" ON public.water_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.owner_id = public.water_entries.user_id
        AND fc.viewer_id = (SELECT auth.uid())
        AND fc.status = 'active'
    )
  );

CREATE POLICY "water_entries_insert_own" ON public.water_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "water_entries_update_own" ON public.water_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "water_entries_delete_own" ON public.water_entries
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
