-- ============================================================
-- 0001_init.sql — CaloriSnap: начальная схема БД.
-- Применить в Supabase Dashboard → SQL Editor (или через CLI).
-- ============================================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy поиск продуктов

-- ============================================================
-- ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  birth_date    DATE,
  height_cm     INTEGER CHECK (height_cm > 0 AND height_cm < 250),
  current_weight_kg  DECIMAL(5,2) CHECK (current_weight_kg > 0),
  target_weight_kg   DECIMAL(5,2),
  goal          TEXT CHECK (goal IN ('lose', 'maintain', 'gain')),
  activity_level TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  daily_calorie_target INTEGER,
  daily_protein_g  INTEGER,
  daily_fat_g      INTEGER,
  daily_carbs_g    INTEGER,
  daily_water_ml   INTEGER DEFAULT 2500,
  units          TEXT CHECK (units IN ('metric','imperial')) DEFAULT 'metric',
  language       TEXT DEFAULT 'ru',
  theme          TEXT CHECK (theme IN ('auto','light','dark')) DEFAULT 'auto',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ВЕС ТЕЛА (история)
-- ============================================================
CREATE TABLE public.weight_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  weight_kg   DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0),
  note        TEXT,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recorded_at)
);
CREATE INDEX idx_weight_entries_user_date
  ON public.weight_entries(user_id, recorded_at DESC);

-- ============================================================
-- ЕДА: БАЗА ПРОДУКТОВ
-- ============================================================
CREATE TABLE public.food_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  name_local        TEXT, -- русское название для UI
  category          TEXT,
  calories_per_100g DECIMAL(6,1) NOT NULL,
  protein_per_100g  DECIMAL(5,1) NOT NULL,
  fat_per_100g      DECIMAL(5,1) NOT NULL,
  carbs_per_100g    DECIMAL(5,1) NOT NULL,
  source            TEXT CHECK (source IN ('usda','open_food_facts','user_custom','verified')) DEFAULT 'usda',
  barcode           TEXT,
  image_url         TEXT,
  is_verified       BOOLEAN DEFAULT FALSE,
  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Поиск по подстроке (русский и английский)
CREATE INDEX idx_food_items_name_trgm
  ON public.food_items USING gin(name gin_trgm_ops);
CREATE INDEX idx_food_items_name_local_trgm
  ON public.food_items USING gin(name_local gin_trgm_ops);
CREATE INDEX idx_food_items_barcode
  ON public.food_items(barcode) WHERE barcode IS NOT NULL;

-- ============================================================
-- ДНЕВНИК ПРИЁМОВ ПИЩИ
-- ============================================================
CREATE TABLE public.meal_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meal_type           TEXT CHECK (meal_type IN ('breakfast','lunch','dinner','snack')) NOT NULL,
  photo_url           TEXT,
  photo_storage_path  TEXT,
  confidence          DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  ai_raw_response     JSONB,
  notes               TEXT,
  logged_at           TIMESTAMPTZ DEFAULT NOW(),
  entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_meal_entries_user_date
  ON public.meal_entries(user_id, entry_date DESC);
CREATE INDEX idx_meal_entries_user_meal
  ON public.meal_entries(user_id, entry_date, meal_type);

-- ============================================================
-- ПРОДУКТЫ В ПРИЁМЕ ПИЩИ
-- ============================================================
CREATE TABLE public.meal_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_entry_id   UUID REFERENCES public.meal_entries(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  food_item_id    UUID REFERENCES public.food_items(id),
  custom_food_name TEXT,
  weight_grams    DECIMAL(6,1) NOT NULL CHECK (weight_grams > 0),
  calories        DECIMAL(7,1) NOT NULL,
  protein_g       DECIMAL(5,1) NOT NULL,
  fat_g           DECIMAL(5,1) NOT NULL,
  carbs_g         DECIMAL(5,1) NOT NULL,
  weight_source   TEXT CHECK (weight_source IN ('scale_ocr','user_input','ai_estimated','manual')),
  confidence      DECIMAL(3,2),
  position        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_meal_items_entry ON public.meal_items(meal_entry_id);

-- ============================================================
-- ВОДА
-- ============================================================
CREATE TABLE public.water_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_ml   INTEGER NOT NULL CHECK (amount_ml > 0),
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_water_entries_user_date
  ON public.water_entries(user_id, entry_date DESC);

-- ============================================================
-- ОБРАТНАЯ СВЯЗЬ (AI FEEDBACK)
-- ============================================================
CREATE TABLE public.ai_feedback (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meal_entry_id        UUID REFERENCES public.meal_entries(id) ON DELETE CASCADE,
  photo_storage_path   TEXT,
  ai_prediction        JSONB NOT NULL,
  user_correction      JSONB,
  was_accepted         BOOLEAN NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_feedback_user
  ON public.ai_feedback(user_id, created_at DESC);

-- ============================================================
-- ДНЕВНАЯ СТАТИСТИКА (view с security_invoker — иначе обходится RLS)
-- ============================================================
CREATE VIEW public.daily_stats
WITH (security_invoker = true) AS
SELECT
  me.user_id,
  me.entry_date,
  SUM(mi.calories)::NUMERIC  AS total_calories,
  SUM(mi.protein_g)::NUMERIC AS total_protein,
  SUM(mi.fat_g)::NUMERIC     AS total_fat,
  SUM(mi.carbs_g)::NUMERIC   AS total_carbs,
  COUNT(DISTINCT me.id)::INTEGER AS meal_count
FROM public.meal_entries me
JOIN public.meal_items mi ON mi.meal_entry_id = me.id
GROUP BY me.user_id, me.entry_date;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback    ENABLE ROW LEVEL SECURITY;

-- Удобная функция-помощник
CREATE OR REPLACE FUNCTION public.uid()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT auth.uid()
$$;

-- profiles
CREATE POLICY "own profile" ON public.profiles
  FOR ALL USING (id = public.uid()) WITH CHECK (id = public.uid());

-- weight_entries
CREATE POLICY "own" ON public.weight_entries
  FOR ALL USING (user_id = public.uid()) WITH CHECK (user_id = public.uid());

-- meal_entries
CREATE POLICY "own" ON public.meal_entries
  FOR ALL USING (user_id = public.uid()) WITH CHECK (user_id = public.uid());

-- meal_items
CREATE POLICY "own" ON public.meal_items
  FOR ALL USING (user_id = public.uid()) WITH CHECK (user_id = public.uid());

-- food_items: read public + own, write own
CREATE POLICY "read verified or own" ON public.food_items
  FOR SELECT USING (is_verified OR created_by = public.uid());

CREATE POLICY "insert own" ON public.food_items
  FOR INSERT WITH CHECK (created_by = public.uid());

CREATE POLICY "update own" ON public.food_items
  FOR UPDATE USING (created_by = public.uid());

-- water_entries
CREATE POLICY "own" ON public.water_entries
  FOR ALL USING (user_id = public.uid()) WITH CHECK (user_id = public.uid());

-- ai_feedback
CREATE POLICY "own" ON public.ai_feedback
  FOR ALL USING (user_id = public.uid()) WITH CHECK (user_id = public.uid());

-- ============================================================
-- ТРИГГЕРЫ
-- ============================================================

-- Автоматическое создание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Обновление updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER food_items_updated_at
  BEFORE UPDATE ON public.food_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STORAGE
-- ============================================================

-- Bucket для фото еды (приватный — доступ только владельцу)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-photos',
  'food-photos',
  FALSE,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
) ON CONFLICT DO NOTHING;

CREATE POLICY "upload own food photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'food-photos'
    AND (storage.foldername(name))[1] = public.uid()::text
  );

CREATE POLICY "read own food photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'food-photos'
    AND (storage.foldername(name))[1] = public.uid()::text
  );

CREATE POLICY "delete own food photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'food-photos'
    AND (storage.foldername(name))[1] = public.uid()::text
  );
