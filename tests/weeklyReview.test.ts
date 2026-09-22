import { describe, it, expect } from "vitest";
import { computeWeeklyReview, type DayStatItem } from "@/lib/nutrition/weeklyReview";
import type { MealHistoryEntry } from "@/lib/nutrition/personalization";

describe("Weekly AI Review", () => {
  const mockDailyStats: DayStatItem[] = [
    { entry_date: "2026-03-02", total_calories: 1950, total_protein: 130 }, // Mon
    { entry_date: "2026-03-03", total_calories: 2050, total_protein: 140 }, // Tue
    { entry_date: "2026-03-04", total_calories: 1980, total_protein: 135 }, // Wed
    { entry_date: "2026-03-05", total_calories: 2000, total_protein: 125 }, // Thu
    { entry_date: "2026-03-06", total_calories: 2100, total_protein: 120 }, // Fri
    { entry_date: "2026-03-07", total_calories: 2500, total_protein: 110 }, // Sat
    { entry_date: "2026-03-08", total_calories: 2600, total_protein: 115 }, // Sun
  ];

  const mockMeals: MealHistoryEntry[] = [
    {
      entry_date: "2026-03-02",
      meal_type: "lunch",
      meal_items: [
        { custom_food_name: "Куриное филе", weight_grams: 200, calories: 220, protein_g: 46, fat_g: 3, carbs_g: 0 },
      ],
    },
    {
      entry_date: "2026-03-07",
      meal_type: "dinner",
      meal_items: [
        { custom_food_name: "Пицца Пепперони", weight_grams: 400, calories: 1100, protein_g: 40, fat_g: 45, carbs_g: 120 },
      ],
    },
  ];

  it("calculates weekly averages and detects weekend surge pattern", () => {
    const review = computeWeeklyReview(mockDailyStats, mockMeals, 2000, 130);

    expect(review.daysLogged).toBe(7);
    expect(review.avgCalories).toBeGreaterThan(2000);
    // Sat & Sun are 2500 & 2600 (avg 2550), weekdays are ~2016 (avg diff > 500)
    expect(review.weekendVsWeekdayDeltaKcal).toBeGreaterThan(400);
    expect(review.instantSummary).toContain("паттерн выходных");
  });

  it("identifies top calorie meals and top protein meals", () => {
    const review = computeWeeklyReview(mockDailyStats, mockMeals, 2000, 130);

    expect(review.topCalorieMeals.length).toBeGreaterThan(0);
    expect(review.topCalorieMeals[0].title).toContain("Пицца");
    expect(review.topCalorieMeals[0].calories).toBe(1100);

    expect(review.topProteinMeals.length).toBeGreaterThan(0);
    expect(review.topProteinMeals[0].proteinG).toBe(46);
  });
});
