import type { Goal } from "./tdee";
import { round } from "../utils";

/**
 * Распределение БЖУ и норма воды.
 * Пропорции подобраны под цель: на дефиците белка больше (сохранение мышц).
 */

export interface MacroSplit {
  /** Доля калорий из белков */
  protein: number;
  /** Доля калорий из жиров */
  fat: number;
  /** Доля калорий из углеводов */
  carbs: number;
}

export const GOAL_MACRO_SPLIT: Record<Goal, MacroSplit> = {
  lose: { protein: 0.3, fat: 0.3, carbs: 0.4 },
  maintain: { protein: 0.25, fat: 0.3, carbs: 0.45 },
  gain: { protein: 0.25, fat: 0.25, carbs: 0.5 },
};

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** Калории → граммы БЖУ (белок 4 ккал/г, жир 9, углеводы 4) */
export function calculateMacroTargets(
  targetCalories: number,
  goal: Goal,
): MacroTargets {
  const split = GOAL_MACRO_SPLIT[goal];
  return {
    proteinG: Math.round((targetCalories * split.protein) / 4),
    fatG: Math.round((targetCalories * split.fat) / 9),
    carbsG: Math.round((targetCalories * split.carbs) / 4),
  };
}

/** Норма воды: 30 мл на кг веса, округлённая до 100 мл */
export function calculateWaterTargetMl(weightKg: number): number {
  return Math.round((weightKg * 30) / 100) * 100;
}

/** Данные на 100 г продукта (короткие ключи — как в ответе AI и формах) */
export interface Per100 {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** БЖУ для конкретной порции по данным на 100 г */
export function macrosForWeight(
  per100g: Per100,
  weightGrams: number,
): { calories: number } & MacroTargets {
  const k = weightGrams / 100;
  return {
    calories: Math.round(per100g.calories * k),
    proteinG: round(per100g.protein * k),
    fatG: round(per100g.fat * k),
    carbsG: round(per100g.carbs * k),
  };
}

export interface DayTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function emptyTotals(): DayTotals {
  return { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 };
}

/** Строка из БД (meal_items / ai feedback): ключи snake_case */
export type NutritionRow = {
  calories?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
};

/**
 * Сумма по строкам БД. ВАЖНО: из БД приходят snake_case ключи (protein_g и т.д.).
 * Раньше тут были camelCase и макросы давали 0 — только калории совпадали по имени.
 */
export function sumTotals(items: NutritionRow[]): DayTotals {
  return items.reduce<DayTotals>(
    (acc, item) => ({
      calories: acc.calories + (item.calories ?? 0),
      proteinG: round(acc.proteinG + (item.protein_g ?? 0)),
      fatG: round(acc.fatG + (item.fat_g ?? 0)),
      carbsG: round(acc.carbsG + (item.carbs_g ?? 0)),
    }),
    emptyTotals(),
  );
}

/** Процент выполнения нормы, 0..∞ */
export function progressPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((value / target) * 100);
}
