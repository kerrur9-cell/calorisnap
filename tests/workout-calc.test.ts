import { describe, it, expect } from "vitest";
import {
  calculateDetailedWorkout,
  calculateMetEnergy,
  calculateEnergyBalance,
} from "../src/lib/workout/calculator";
import {
  calculateAcsmTreadmillMet,
  resolveMetForActivity,
  COMPENDIUM_ACTIVITIES,
} from "../src/lib/workout/compendium";

describe("Physiological Energy Calculation (Compendium & ACSM)", () => {
  it("computes exact Gross and Active calories for User Case: 80 kg, 15 min, 5.8 MET", () => {
    // 80 kg, 15 min, 5.8 MET (Compendium 17220: быстрая спортивная ходьба ~6.7 км/ч)
    // Gross = 5.8 * 80 * (15/60) = 116 kcal
    // Active = (5.8 - 1.0) * 80 * (15/60) = 4.8 * 80 * 0.25 = 96 kcal
    const energy = calculateMetEnergy({
      weightKg: 80,
      durationMinutes: 15,
      met: 5.8,
    });

    expect(energy.grossCalories).toBe(116);
    expect(energy.activeCalories).toBe(96);
    expect(energy.restingCalories).toBe(20);
    expect(energy.grossCalories - energy.activeCalories).toBe(energy.restingCalories);
  });

  it("calculates 15 min brisk walk at 6.7 km/h for 80 kg person via calculateDetailedWorkout", () => {
    const result = calculateDetailedWorkout({
      exerciseName: "Ходьба на дорожке",
      category: "cardio",
      durationMinutes: 15,
      speedKmh: 6.7,
      userWeightKg: 80,
    });

    expect(result.met).toBe(5.8);
    expect(result.grossCalories).toBe(116);
    expect(result.activeCalories).toBe(96);
    expect(result.userWeightKg).toBe(80);
    expect(result.isWeightEstimated).toBe(false);
    expect(result.isDurationEstimated).toBe(false);
    expect(result.explanation).toContain("5.8 MET");
  });

  it("uses ACSM walking equation for speed and incline (e.g. 6.0 km/h, 3% grade)", () => {
    // Speed: 6.0 km/h = 100 m/min. Incline: 3% = 0.03
    // VO2 = 3.5 + 0.1 * 100 + 1.8 * 100 * 0.03 = 3.5 + 10 + 5.4 = 18.9 ml/kg/min
    // MET = 18.9 / 3.5 = 5.4 MET
    const acsm = calculateAcsmTreadmillMet({
      speedKmh: 6.0,
      inclinePercent: 3,
      mode: "walking",
    });

    expect(acsm.modeUsed).toBe("walking");
    expect(acsm.met).toBeCloseTo(5.4, 1);
    expect(acsm.formula).toContain("ACSM");
  });

  it("uses ACSM running equation for running speed and incline (e.g. 10.0 km/h, 1% grade)", () => {
    // Speed: 10.0 km/h = 166.67 m/min. Incline: 1% = 0.01
    // VO2 = 3.5 + 0.2 * 166.67 + 0.9 * 166.67 * 0.01 = 3.5 + 33.33 + 1.5 = 38.33
    // MET = 38.33 / 3.5 = 10.95 -> ~11.0 MET
    const acsm = calculateAcsmTreadmillMet({
      speedKmh: 10.0,
      inclinePercent: 1,
      mode: "running",
    });

    expect(acsm.modeUsed).toBe("running");
    expect(acsm.met).toBeGreaterThanOrEqual(10.5);
    expect(acsm.met).toBeLessThanOrEqual(11.5);
  });

  it("flags missing weight without fabricating arbitrary values", () => {
    const result = calculateDetailedWorkout({
      exerciseName: "Бег на дорожке",
      category: "cardio",
      durationMinutes: 20,
      userWeightKg: null,
    });

    expect(result.isWeightEstimated).toBe(true);
    expect(result.activeCalories).toBeGreaterThan(0); // Fallback allows preview, but flagged
  });

  it("flags missing duration when duration was not provided", () => {
    const result = calculateDetailedWorkout({
      exerciseName: "Эллиптический тренажер",
      category: "cardio",
      durationMinutes: null,
      userWeightKg: 70,
    });

    expect(result.isDurationEstimated).toBe(true);
    expect(result.durationMinutes).toBe(15); // Sensible fallback for preview
  });

  it("prevents double-counting BMR in DayEnergyBalance", () => {
    // If user has BMR 1500 kcal (covering 24h of life)
    // and did a workout with Gross 116 kcal (Active 96 kcal + Resting 20 kcal during the workout)
    // Adding Gross 116 to BMR 1500 would count those 20 kcal resting TWICE (1500 already includes them).
    // Adding Active 96 gives true 24h expenditure: 1500 + 96 = 1596 kcal.
    const biometrics = {
      gender: "male" as const,
      age: 30,
      heightCm: 180,
      weightKg: 80,
    };

    const balance = calculateEnergyBalance({
      biometrics,
      burnedCalories: 96, // Active calories
      grossBurnedCalories: 116, // Gross calories
      consumedCalories: 2000,
    });

    expect(balance.burnedCalories).toBe(96);
    expect(balance.grossBurnedCalories).toBe(116);
    expect(balance.totalExpenditure).toBe(balance.bmr + 96);
    expect(balance.netDeficit).toBe(balance.totalExpenditure - 2000);
  });

  it("contains Compendium entries with validated MET ranges", () => {
    expect(COMPENDIUM_ACTIVITIES.walking_moderate.defaultMet).toBe(3.5);
    expect(COMPENDIUM_ACTIVITIES.walking_very_brisk.defaultMet).toBe(5.8);
    expect(COMPENDIUM_ACTIVITIES.running_jogging.defaultMet).toBe(7.0);
    expect(COMPENDIUM_ACTIVITIES.elliptical_moderate.defaultMet).toBe(5.0);
    expect(COMPENDIUM_ACTIVITIES.stationary_cycling_moderate.defaultMet).toBe(5.5);
  });

  it("resolves correct MET for named activities without speed", () => {
    const elliptical = resolveMetForActivity({ name: "Эллипс" });
    expect(elliptical.met).toBe(5.0);

    const bike = resolveMetForActivity({ name: "Велотренажер" });
    expect(bike.met).toBe(5.5);

    const stairs = resolveMetForActivity({ name: "Лестничный тренажер степпер" });
    expect(stairs.met).toBe(9.0);
  });
});
