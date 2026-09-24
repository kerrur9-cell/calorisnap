/**
 * Типы Supabase. Написаны вручную под схему из supabase/migrations/0001_init.sql.
 * При изменении схемы можно перегенерировать:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * ВАЖНО: Row/Insert/Update должны быть `type`-алиасами, а не `interface`.
 * supabase-js сравнивает их с Record<string, unknown>, а interface такого
 * индекс-сигнал не даёт — и вся таблица схлопывается в `never`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Gender = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type WeightSource =
  | "scale_ocr"
  | "user_input"
  | "ai_estimated"
  | "manual";
export type FoodSource = "usda" | "open_food_facts" | "user_custom" | "verified";

export type Profile = {
  id: string;
  display_name: string | null;
  gender: Gender | null;
  birth_date: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  goal: Goal | null;
  activity_level: ActivityLevel | null;
  daily_calorie_target: number | null;
  daily_protein_g: number | null;
  daily_fat_g: number | null;
  daily_carbs_g: number | null;
  daily_water_ml: number | null;
  units: string;
  language: string;
  theme: string;
  onboarding_completed: boolean;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type WeightEntry = {
  id: string;
  user_id: string;
  weight_kg: number;
  note: string | null;
  recorded_at: string;
  created_at: string;
};

export type MealEntry = {
  id: string;
  user_id: string;
  meal_type: MealType;
  photo_url: string | null;
  photo_storage_path: string | null;
  confidence: number | null;
  ai_raw_response: Json | null;
  notes: string | null;
  logged_at: string;
  entry_date: string;
  created_at: string;
};

export type MealItem = {
  id: string;
  meal_entry_id: string;
  user_id: string;
  food_item_id: string | null;
  custom_food_name: string | null;
  weight_grams: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  weight_source: WeightSource | null;
  confidence: number | null;
  position: number;
  created_at: string;
};

export type FoodItem = {
  id: string;
  name: string;
  name_local: string | null;
  category: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  source: FoodSource;
  barcode: string | null;
  image_url: string | null;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WaterEntry = {
  id: string;
  user_id: string;
  amount_ml: number;
  entry_date: string;
  created_at: string;
};

export type AiFeedback = {
  id: string;
  user_id: string;
  meal_entry_id: string | null;
  photo_storage_path: string | null;
  ai_prediction: Json;
  user_correction: Json | null;
  was_accepted: boolean;
  created_at: string;
};

/** Дневная сводка (view daily_stats) */
export type DailyStat = {
  user_id: string;
  entry_date: string;
  total_calories: number | null;
  total_protein: number | null;
  total_fat: number | null;
  total_carbs: number | null;
  meal_count: number | null;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type WorkoutDbEntry = {
  id: string;
  user_id: string;
  exercise_name: string;
  category: "cardio" | "strength" | "machine" | "bodyweight";
  duration_minutes: number | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  calories_burned: number;
  gross_calories?: number | null;
  active_calories?: number | null;
  met?: number | null;
  speed_kmh?: number | null;
  incline_percent?: number | null;
  user_weight_used_kg?: number | null;
  calculation_method?: "acsm" | "compendium" | "strength_tut" | "manual" | null;
  calculation_details?: string | null;
  target_muscles: string[] | null;
  notes: string | null;
  equipment_photo_url: string | null;
  entry_date: string;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      weight_entries: Table<WeightEntry, "user_id" | "weight_kg">;
      meal_entries: Table<MealEntry, "user_id" | "meal_type">;
      meal_items: Table<MealItem, "meal_entry_id" | "user_id" | "weight_grams" | "calories" | "protein_g" | "fat_g" | "carbs_g">;
      food_items: Table<FoodItem, "name" | "calories_per_100g" | "protein_per_100g" | "fat_per_100g" | "carbs_per_100g">;
      water_entries: Table<WaterEntry, "user_id" | "amount_ml">;
      ai_feedback: Table<AiFeedback, "user_id" | "ai_prediction" | "was_accepted">;
      workout_entries: Table<WorkoutDbEntry, "user_id" | "exercise_name">;
      friend_access_codes: Table<{ id: string; user_id: string; code: string; is_active: boolean; created_at: string; updated_at: string }, "user_id" | "code">;
      friend_connections: Table<{ id: string; owner_id: string; viewer_id: string; status: "active" | "revoked"; created_at: string; updated_at: string }, "owner_id" | "viewer_id">;
    };
    Views: {
      daily_stats: { Row: DailyStat; Relationships: [] };
    };
    Functions: {
      save_meal: { Args: { p_id: string; p_date: string; p_type: string; p_items: Json; p_photo?: string | null; p_analysis?: Json | null }; Returns: string };
      consume_ai_quota: { Args: Record<string, never>; Returns: boolean };
      save_weight: { Args: { p_weight: number; p_date: string; p_targets: Json }; Returns: undefined };
      search_foods: { Args: { p_query: string; p_limit?: number }; Returns: FoodItem[] };
      generate_or_get_friend_code: { Args: Record<string, never>; Returns: string };
      refresh_friend_code: { Args: Record<string, never>; Returns: string };
      connect_friend_by_code: { Args: { p_code: string }; Returns: { owner_id: string; display_name: string; code: string } };
      revoke_viewer_access: { Args: { p_viewer_id: string }; Returns: undefined };
      disconnect_from_friend: { Args: { p_owner_id: string }; Returns: undefined };
      get_my_friends: { Args: Record<string, never>; Returns: { owner_id: string; display_name: string; avatar_url: string | null; connected_at: string }[] };
      get_my_viewers: { Args: Record<string, never>; Returns: { viewer_id: string; display_name: string; avatar_url: string | null; connected_at: string }[] };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** Приём пищи с вложенными продуктами — используется на экране дня */
export type MealWithItems = MealEntry & { meal_items: MealItem[] };
