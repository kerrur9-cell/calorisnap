"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MealType, MealWithItems } from "@/types/database";
import { sumTotals, type DayTotals } from "@/lib/nutrition/macros";

export interface DayData {
  meals: MealWithItems[];
  totals: DayTotals;
  mealCount: number;
}

export function dayQueryKey(dateKey: string) {
  return ["day", dateKey] as const;
}

/**
 * Загрузка всех приёмов пищи и продуктов за выбранный день.
 * Один запрос на «день», инвалидируется после любых изменений.
 */
export function useDayLog(dateKey: string) {
  return useQuery({
    queryKey: dayQueryKey(dateKey),
    queryFn: async (): Promise<DayData> => {
      const supabase = createClient();

      const mealsRes = await supabase
        .from("meal_entries")
        .select("*, meal_items(*)")
        .eq("entry_date", dateKey)
        .order("logged_at", { ascending: true })
        .returns<MealWithItems[]>();

      if (mealsRes.error) throw mealsRes.error;

      const meals = mealsRes.data ?? [];
      // Backfill names for entries created before names were snapshotted on save.
      const missingIds = [...new Set(meals.flatMap((meal) => meal.meal_items)
        .filter((item) => !item.custom_food_name && item.food_item_id)
        .map((item) => item.food_item_id!))];
      if (missingIds.length) {
        const { data: foods, error } = await supabase.from("food_items").select("id,name,name_local").in("id", missingIds);
        if (error) throw error;
        const names = new Map((foods ?? []).map((food) => [food.id, food.name_local || food.name]));
        meals.forEach((meal) => meal.meal_items.forEach((item) => {
          if (!item.custom_food_name && item.food_item_id) item.custom_food_name = names.get(item.food_item_id) ?? "Продукт";
        }));
      }
      meals.forEach((meal) => meal.meal_items.sort((a, b) => a.position - b.position));

      const totals = sumTotals(
        meals.flatMap((m) => m.meal_items),
      );

      return { meals, totals, mealCount: meals.length };
    },
    staleTime: 15_000,
  });
}

export type MealIconType = "sun" | "utensils" | "moon" | "apple";

export const MEAL_TYPES: {
  value: MealType;
  label: string;
  emoji: string;
  icon: MealIconType;
}[] = [
  { value: "breakfast", label: "Завтрак", emoji: "🌅", icon: "sun" },
  { value: "lunch", label: "Обед", emoji: "🍽️", icon: "utensils" },
  { value: "dinner", label: "Ужин", emoji: "🌙", icon: "moon" },
  { value: "snack", label: "Перекус", emoji: "🍎", icon: "apple" },
];

export function mealTypeMeta(type: MealType) {
  return MEAL_TYPES.find((m) => m.value === type) ?? MEAL_TYPES[0];
}

/** Вес дня в формате «Сегодня» / «Вчера» / дата */
export function mealTotals(meals: MealWithItems[]): DayTotals {
  return sumTotals(meals.flatMap((m) => m.meal_items));
}
