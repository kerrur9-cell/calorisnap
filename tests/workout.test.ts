import { describe, it, expect } from "vitest";
import {
  calculateCardioCalories,
  calculateStrengthCalories,
  calculateEnergyBalance,
} from "../src/lib/workout/calculator";
import { GYM_MACHINES } from "../src/lib/workout/machines";

describe("Workout & Energy Balance Calculator", () => {
  it("calculates cardio calories correctly based on MET and user weight", () => {
    // Девушка весом 55 кг ходит в гору 30 минут (MET 7.0)
    // 7.0 * 55 * (30 / 60) = 192.5 ккал -> 193 ккал
    const burned = calculateCardioCalories({
      weightKg: 55,
      durationMinutes: 30,
      met: 7.0,
    });
    expect(burned).toBe(193);
  });

  it("calculates strength machine calories based on sets and weight", () => {
    // Девушка весом 55 кг делает 4 подхода ягодичного мостика (интенсивность 1.4)
    // 55 * 0.065 * 1.4 = ~5.005 ккал/сет * 4 = ~20 ккал
    const burned = calculateStrengthCalories({
      weightKg: 55,
      sets: 4,
      intensityFactor: 1.4,
    });
    expect(burned).toBeGreaterThan(15);
    expect(burned).toBeLessThan(35);
  });

  it("calculates full daily energy balance and net deficit", () => {
    // Девушка: 22 года, 165 см, 55 кг, BMR: 10*55 + 6.25*165 - 5*22 - 161 = 550 + 1031.25 - 110 - 161 = 1310 ккал
    const biometrics = {
      gender: "female" as const,
      age: 22,
      heightCm: 165,
      weightKg: 55,
    };

    // Тренировка сожгла 350 ккал. Всего расход = 1310 + 350 = 1660 ккал
    // За день съела 1200 ккал
    // Итоговый дефицит = 1660 - 1200 = +460 ккал
    const balance = calculateEnergyBalance({
      biometrics,
      burnedCalories: 350,
      consumedCalories: 1200,
    });

    expect(balance.bmr).toBe(1310);
    expect(balance.totalExpenditure).toBe(1660);
    expect(balance.netDeficit).toBe(460);
    expect(balance.status).toBe("optimal_deficit");
    expect(balance.statusText).toContain("Дефицит");
  });

  it("identifies surplus when consumed calories exceed expenditure", () => {
    const balance = calculateEnergyBalance({
      biometrics: {
        gender: "female",
        age: 25,
        heightCm: 168,
        weightKg: 58,
      },
      burnedCalories: 100,
      consumedCalories: 2100,
    });

    expect(balance.netDeficit).toBeLessThan(0);
    expect(balance.status).toBe("surplus");
  });

  it("verifies gym machine catalog integrity", () => {
    expect(GYM_MACHINES.length).toBeGreaterThan(10);
    const gluteBridge = GYM_MACHINES.find((m) => m.id === "glute_bridge_bench");
    expect(gluteBridge).toBeDefined();
    expect(gluteBridge?.targetMuscles).toContain("Большая ягодичная");
  });
});
