import { describe, it, expect } from "vitest";
import {
  analyzeWaterRetention,
  analyzePlateau,
  calculateRealFatLoss,
  type WeightRecord,
  type DayCalorieRecord,
} from "@/lib/nutrition/insights";

describe("Smart Progress Insights", () => {
  it("detects water retention on sudden weight spike after high carb intake", () => {
    const weights: WeightRecord[] = [
      { date: "2026-03-10", weightKg: 75.0 },
      { date: "2026-03-11", weightKg: 75.9 }, // +0.9 kg jump
    ];
    const nutrition: DayCalorieRecord[] = [
      { date: "2026-03-10", consumedCalories: 2600, targetCalories: 2000, carbsG: 320 },
      { date: "2026-03-11", consumedCalories: 2100, targetCalories: 2000, carbsG: 200 },
    ];

    const result = analyzeWaterRetention(weights, nutrition);
    expect(result.detected).toBe(true);
    expect(result.weightDeltaKg).toBe(0.9);
    expect(result.message).toContain("задержка воды и гликогена");
  });

  it("does not trigger water retention on small, normal daily fluctuations", () => {
    const weights: WeightRecord[] = [
      { date: "2026-03-10", weightKg: 75.0 },
      { date: "2026-03-11", weightKg: 75.2 }, // +0.2 kg
    ];
    const nutrition: DayCalorieRecord[] = [
      { date: "2026-03-10", consumedCalories: 1900, targetCalories: 2000 },
      { date: "2026-03-11", consumedCalories: 1950, targetCalories: 2000 },
    ];

    const result = analyzeWaterRetention(weights, nutrition);
    expect(result.detected).toBe(false);
  });

  it("identifies genuine plateau after 14 days of constant weight under calorie deficit", () => {
    // 14 days where weight hovers around 74.0 kg while deficit is 400 kcal/day
    const weights: WeightRecord[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      weightKg: 74.0 + (i % 2 === 0 ? 0.1 : -0.1),
    }));

    const nutrition: DayCalorieRecord[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      consumedCalories: 1600,
      targetCalories: 2000, // -400 kcal deficit
    }));

    const result = analyzePlateau(weights, nutrition);
    expect(result.detected).toBe(true);
    expect(result.averageDeficitKcal).toBe(400);
    expect(result.actionRecommendation).toBe("refeed");
  });

  it("calculates real fat loss from cumulative energy deficit", () => {
    const weights: WeightRecord[] = [
      { date: "2026-03-01", weightKg: 80.0 },
      { date: "2026-03-07", weightKg: 79.5 },
    ];
    // 7 days with 550 kcal deficit = 3850 kcal deficit = ~0.50 kg pure fat
    const nutrition: DayCalorieRecord[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-0${i + 1}`,
      consumedCalories: 1450,
      targetCalories: 2000,
    }));

    const result = calculateRealFatLoss(weights, nutrition);
    expect(result).not.toBeNull();
    expect(result?.cumulativeDeficitKcal).toBe(3850);
    expect(result?.estimatedFatLossKg).toBe(0.5);
  });
});
