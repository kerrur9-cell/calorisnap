import { describe, it, expect } from "vitest";
import {
  calculateCardioCalories,
  calculateStrengthCalories,
  calculateEnergyBalance,
  calculateParsedWorkoutCalories,
} from "../src/lib/workout/calculator";
import { GYM_MACHINES } from "../src/lib/workout/machines";

describe("Workout & Energy Balance Calculator", () => {
  it("calculates realistic strength calories and prevents overestimation (e.g. barbell squats 4x10 @ 50kg)", () => {
    // Пользователь 55 кг делает "Приседания со штангой, 4 подх. × 10 повт. · 50 кг"
    // Реальный физиологический расход: ~30-40 ккал (а не 150-200 ккал)
    const burned = calculateParsedWorkoutCalories({
      exerciseName: "Приседания со штангой",
      category: "strength",
      sets: 4,
      reps: 10,
      weightKg: 50,
      userWeightKg: 55,
    });

    expect(burned).toBeGreaterThanOrEqual(28);
    expect(burned).toBeLessThanOrEqual(45);
    expect(burned).toBeLessThan(100);
  });

  it("calculates objective leg press calories for heavy weight (4x12 @ 100kg)", () => {
    // Жим ногами 4 по 12 с весом 100 кг для девушки 55 кг
    // Объективный расход: ~35-45 ккал (а не галлюцинации LLM на 169 ккал)
    const burned = calculateParsedWorkoutCalories({
      exerciseName: "Жим ногами в тренажере",
      category: "machine",
      sets: 4,
      reps: 12,
      weightKg: 100,
      userWeightKg: 55,
    });

    expect(burned).toBeGreaterThanOrEqual(35);
    expect(burned).toBeLessThanOrEqual(48);
    expect(burned).toBeLessThan(60);
  });

  it("calculates realistic bodyweight glute bridge calories", () => {
    const burned = calculateParsedWorkoutCalories({
      exerciseName: "Ягодичный мостик",
      category: "bodyweight",
      sets: 4,
      reps: 15,
      userWeightKg: 55,
    });

    expect(burned).toBeGreaterThanOrEqual(25);
    expect(burned).toBeLessThanOrEqual(45);
  });

  it("calculates small muscle isolation calories appropriately", () => {
    const burned = calculateParsedWorkoutCalories({
      exerciseName: "Подъем гантелей на бицепс",
      category: "strength",
      sets: 3,
      reps: 12,
      weightKg: 6,
      userWeightKg: 55,
    });

    expect(burned).toBeGreaterThanOrEqual(7);
    expect(burned).toBeLessThanOrEqual(18);
  });

  it("calculates cardio calories based on MET and duration", () => {
    // 30 минут бега для 55 кг (MET ~8.5)
    // 8.5 * 55 * 0.5 = ~234 ккал
    const burned = calculateParsedWorkoutCalories({
      exerciseName: "Бег на дорожке",
      category: "cardio",
      durationMinutes: 30,
      userWeightKg: 55,
    });

    expect(burned).toBeGreaterThan(200);
    expect(burned).toBeLessThan(260);
  });

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
    const burned = calculateStrengthCalories({
      weightKg: 55,
      sets: 4,
      intensityFactor: 1.4,
    });
    expect(burned).toBeGreaterThan(15);
    expect(burned).toBeLessThan(35);
  });

  it("calculates full daily energy balance and net deficit", () => {
    const biometrics = {
      gender: "female" as const,
      age: 22,
      heightCm: 165,
      weightKg: 55,
    };

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
