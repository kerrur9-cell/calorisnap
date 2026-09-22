-- ============================================================
-- 0002_workouts.sql — CaloriSnap: Таблица расхода калорий и тренировок.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_name       TEXT NOT NULL,
  category            TEXT CHECK (category IN ('cardio', 'strength', 'machine', 'bodyweight')) DEFAULT 'machine',
  duration_minutes    INTEGER,
  sets                INTEGER,
  reps                INTEGER,
  weight_kg           DECIMAL(5,2),
  calories_burned     INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
  target_muscles      TEXT[],
  notes               TEXT,
  equipment_photo_url TEXT,
  entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_entries_user_date
  ON public.workout_entries(user_id, entry_date DESC);

-- RLS
ALTER TABLE public.workout_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workout_entries' AND policyname = 'own workouts'
  ) THEN
    CREATE POLICY "own workouts" ON public.workout_entries
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
