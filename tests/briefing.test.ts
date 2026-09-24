import { describe, it, expect } from "vitest";
import {
  generateDailyBriefing,
  determineBriefingType,
} from "@/lib/nutrition/briefing";

describe("Daily Briefing", () => {
  it("determines morning vs evening based on hour", () => {
    expect(determineBriefingType(9)).toBe("morning");
    expect(determineBriefingType(14)).toBe("morning");
    expect(determineBriefingType(15)).toBe("evening");
    expect(determineBriefingType(20)).toBe("evening");
  });

  it("generates morning briefing taking into account yesterday deficit/surplus", () => {
    const briefing = generateDailyBriefing({
      timeOfDay: "morning",
      todayConsumed: { calories: 250, proteinG: 12, fatG: 8, carbsG: 30 },
      calorieGoal: 2000,
      macroTargets: { proteinG: 140, fatG: 65, carbsG: 215 },
      yesterdayStats: {
        totalCalories: 1700,
        targetCalories: 2000,
        totalProtein: 100,
        targetProtein: 140,
      },
    });

    expect(briefing.type).toBe("morning");
    expect(briefing.title).toBe("Утренний план");
    expect(briefing.keyPoints.some((p) => p.includes("дефицит"))).toBe(true);
    expect(briefing.keyPoints.some((p) => p.includes("не хватило 40 г белка"))).toBe(true);
  });

  it("generates supportive evening briefing when on track", () => {
    const briefing = generateDailyBriefing({
      timeOfDay: "evening",
      todayConsumed: { calories: 1950, proteinG: 135, fatG: 60, carbsG: 210 },
      calorieGoal: 2000,
      macroTargets: { proteinG: 140, fatG: 65, carbsG: 215 },
    });

    expect(briefing.type).toBe("evening");
    expect(briefing.title).toBe("Итоги дня");
    expect(briefing.headline).toContain("Отличное попадание в калорийность");
  });

  it("generates shame-free evening briefing when in surplus", () => {
    const briefing = generateDailyBriefing({
      timeOfDay: "evening",
      todayConsumed: { calories: 2400, proteinG: 150, fatG: 90, carbsG: 250 },
      calorieGoal: 2000,
      macroTargets: { proteinG: 140, fatG: 65, carbsG: 215 },
    });

    expect(briefing.type).toBe("evening");
    expect(briefing.keyPoints.some((p) => p.includes("не ломает недельный прогресс"))).toBe(true);
  });

  it("suggests realistic portions instead of single huge meal when remaining calories is high", () => {
    const briefing = generateDailyBriefing({
      timeOfDay: "evening",
      todayConsumed: { calories: 508, proteinG: 40, fatG: 20, carbsG: 45 },
      calorieGoal: 2000,
      macroTargets: { proteinG: 140, fatG: 65, carbsG: 215 },
    });

    expect(briefing.remainingCalories).toBe(1492);
    // Should NOT say "белковое блюдо на 1492 ккал"
    expect(briefing.recommendedFocus).not.toContain("блюдо на 1492 ккал");
    expect(briefing.recommendedFocus).toContain("Остаток бюджета дня: 1492 ккал");
    expect(briefing.recommendedFocus).toMatch(/порция .* ~[345]\d0 ккал/);
  });
});
