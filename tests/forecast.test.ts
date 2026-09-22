import { describe, it, expect } from "vitest";
import { calculateWeightTrend, calculateWeightForecast } from "../src/lib/nutrition/forecast";

describe("Weight Forecast", () => {
  it("smooths weight fluctuations using EMA", () => {
    const rawHistory = [
      { date: "2026-03-01", weightKg: 80.0 },
      { date: "2026-03-02", weightKg: 81.5 }, // резкий всплеск от соли/воды
      { date: "2026-03-03", weightKg: 79.8 },
      { date: "2026-03-04", weightKg: 79.5 },
    ];

    const trend = calculateWeightTrend(rawHistory);
    expect(trend).toHaveLength(4);
    expect(trend[0].trendWeight).toBe(80.0);
    // На второй день тренд не должен подскочить до 81.5, а сгладиться: 0.2*81.5 + 0.8*80 = 80.3
    expect(trend[1].trendWeight).toBe(80.3);
    // К 4 дню тренд сглажен (80.06 при скачке до 81.5 и падении до 79.5)
    expect(trend[3].trendWeight).toBe(80.06);
    expect(trend[3].trendWeight).toBeLessThan(trend[1].trendWeight);
  });

  it("calculates realistic forecast with deficit", () => {
    const weightHistory = [
      { date: "2026-03-01", weightKg: 80.0 },
      { date: "2026-03-07", weightKg: 79.5 },
      { date: "2026-03-14", weightKg: 79.0 },
    ];
    const calorieHistory = [
      { date: "2026-03-08", calories: 1800 },
      { date: "2026-03-09", calories: 1800 },
      { date: "2026-03-10", calories: 1800 },
    ];

    const forecast = calculateWeightForecast({
      weightHistory,
      calorieHistory,
      tdee: 2300,
      targetCalories: 1800,
      targetWeightKg: 75.0,
      forecastDays: 30,
    });

    // Дефицит 500 ккал/день -> потеря около 0.45 кг в неделю
    expect(forecast.actualDailyDeficit).toBe(500);
    expect(forecast.actualWeeklyChangeKg).toBeCloseTo(-0.45, 1);
    expect(forecast.forecastPoints).toHaveLength(30);
    expect(forecast.forecastPoints[29].actualPaceWeight).toBeLessThan(forecast.currentTrendWeight!);
    expect(forecast.forecastPoints[29].lowerBound).toBeLessThan(forecast.forecastPoints[29].actualPaceWeight);
    expect(forecast.estimatedTargetDate).toBeTruthy();
  });

  it("handles empty or single weight entries gracefully", () => {
    const forecast = calculateWeightForecast({
      weightHistory: [],
      calorieHistory: [],
      tdee: 2000,
      targetCalories: 2000,
    });

    expect(forecast.currentWeight).toBeNull();
    expect(forecast.forecastPoints).toHaveLength(60);
  });
});
