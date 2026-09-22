import { describe, it, expect } from "vitest";
import {
  EXPERIMENT_PROTOCOLS,
  evaluateExperiment,
  type ActiveExperiment,
  type ExperimentDayLog,
} from "@/lib/experiments/engine";

describe("Experiment Mode Engine", () => {
  it("provides available experiment protocols", () => {
    expect(EXPERIMENT_PROTOCOLS.length).toBeGreaterThanOrEqual(3);
    const highProtein = EXPERIMENT_PROTOCOLS.find((p) => p.id === "high_protein_14d");
    expect(highProtein).toBeDefined();
    expect(highProtein?.durationDays).toBe(14);
  });

  it("checks daily compliance for high protein protocol", () => {
    const highProtein = EXPERIMENT_PROTOCOLS.find((p) => p.id === "high_protein_14d")!;
    const mockMeals = { meal_type: "lunch" as const, entry_date: "2026-03-01", meal_items: [] };

    // 130g protein with 140g target (130 / 140 = 92.8% >= 90%) -> compliant
    expect(
      highProtein.checkDailyCompliance({
        totals: { calories: 1900, proteinG: 130, fatG: 60, carbsG: 180 },
        targets: { proteinG: 140, fatG: 65, carbsG: 200 },
        targetCalories: 2000,
        meals: mockMeals,
      })
    ).toBe(true);

    // 80g protein with 140g target -> non-compliant
    expect(
      highProtein.checkDailyCompliance({
        totals: { calories: 1900, proteinG: 80, fatG: 60, carbsG: 230 },
        targets: { proteinG: 140, fatG: 65, carbsG: 200 },
        targetCalories: 2000,
        meals: mockMeals,
      })
    ).toBe(false);
  });

  it("evaluates an active experiment progress and completion", () => {
    const active: ActiveExperiment = {
      protocolId: "clean_eating_7d",
      startDate: "2026-03-01",
      startWeightKg: 80.0,
      completedDays: 7,
    };

    const mockMeals = { meal_type: "lunch" as const, entry_date: "2026-03-01", meal_items: [] };

    // 7 days within calorie target
    const logs: ExperimentDayLog[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-0${i + 1}`,
      totals: { calories: 1950, proteinG: 120, fatG: 60, carbsG: 200 },
      targets: { proteinG: 120, fatG: 60, carbsG: 200 },
      targetCalories: 2000,
      meals: mockMeals,
    }));

    const evaluation = evaluateExperiment(active, logs, 78.8);
    expect(evaluation).not.toBeNull();
    expect(evaluation?.complianceRate).toBe(1);
    expect(evaluation?.weightDeltaKg).toBe(-1.2);
    expect(evaluation?.verdict).toContain("успешно завершён");
  });
});
