import { describe, it, expect } from "vitest";
import { getLevelDetails, calculateGamification } from "../src/lib/gamification/engine";

describe("Gamification Engine", () => {
  it("calculates level curve progression correctly", () => {
    const l1 = getLevelDetails(50);
    expect(l1.level).toBe(1);
    expect(l1.xpInCurrentLevel).toBe(50);
    expect(l1.xpToNextLevel).toBe(150);

    const l2 = getLevelDetails(200); // 150 + 50
    expect(l2.level).toBe(2);
    expect(l2.xpInCurrentLevel).toBe(50);

    const l5 = getLevelDetails(1500);
    expect(l5.level).toBeGreaterThanOrEqual(4);
    expect(l5.title).toBeTruthy();
  });

  it("rewards XP for meals, protein and targets without punishing for missed days", () => {
    const dailyStats = [
      {
        user_id: "u1",
        entry_date: "2026-03-01",
        total_calories: 1950,
        total_protein: 130,
        total_fat: 65,
        total_carbs: 200,
        meal_count: 3,
      },
      {
        user_id: "u1",
        entry_date: "2026-03-02",
        total_calories: 1900,
        total_protein: 125,
        total_fat: 60,
        total_carbs: 190,
        meal_count: 4,
      },
    ];

    const result = calculateGamification({
      dailyStats,
      weightsCount: 2,
      targetCalories: 2000,
      targetProtein: 120,
      todayTotals: {
        calories: 600,
        proteinG: 40,
        mealCount: 1,
        hasWeightToday: true,
      },
    });

    expect(result.xp).toBeGreaterThan(150);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.momentumDays).toBeGreaterThanOrEqual(2);
    const firstMealBadge = result.unlockedBadges.find((b) => b.id === "first_meal");
    expect(firstMealBadge?.unlocked).toBe(true);
  });
});
