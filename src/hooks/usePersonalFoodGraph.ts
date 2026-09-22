"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { addDays, todayKey } from "@/lib/utils";
import {
  analyzePersonalFoodGraph,
  type FoodGraphAnalysis,
  type MealHistoryEntry,
} from "@/lib/nutrition/personalization";
import { useProfile } from "./useProfile";

export function usePersonalFoodGraph() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["personal_food_graph"],
    queryFn: async (): Promise<FoodGraphAnalysis> => {
      const supabase = createClient();
      const today = todayKey();
      const startDate = addDays(today, -30);

      const [mealsRes, dailyStatsRes] = await Promise.all([
        supabase
          .from("meal_entries")
          .select("id, meal_type, entry_date, logged_at, meal_items(id, custom_food_name, weight_grams, calories, protein_g, fat_g, carbs_g)")
          .gte("entry_date", startDate)
          .lte("entry_date", today)
          .order("logged_at", { ascending: false }),
        supabase
          .from("daily_stats")
          .select("entry_date, total_calories")
          .gte("entry_date", startDate)
          .lte("entry_date", today),
      ]);

      if (mealsRes.error) throw mealsRes.error;

      const targetCalories = profile?.daily_calorie_target ?? 2000;
      const dailyTotalsMap = new Map<string, { totalCalories: number; targetCalories: number }>();

      if (dailyStatsRes.data) {
        for (const stat of dailyStatsRes.data) {
          dailyTotalsMap.set(stat.entry_date, {
            totalCalories: stat.total_calories ?? 0,
            targetCalories,
          });
        }
      }

      // Cast to MealHistoryEntry[]
      const rawMeals = (mealsRes.data ?? []) as unknown as MealHistoryEntry[];

      return analyzePersonalFoodGraph(rawMeals, dailyTotalsMap);
    },
    staleTime: 5 * 60 * 1000, // кешируем на 5 минут
  });
}
