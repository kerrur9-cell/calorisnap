import { describe, it, expect } from "vitest";
import {
  identifyPrimaryDeficit,
  calculateOptimalServing,
  balanceMacros,
  CORE_BALANCER_FOODS,
} from "../src/lib/nutrition/balancer";

describe("Macro Balancer", () => {
  it("identifies protein deficit correctly", () => {
    const targetMacros = { proteinG: 140, fatG: 60, carbsG: 200 };
    const remainingMacros = { proteinG: 50, fatG: 10, carbsG: 20 };

    const result = identifyPrimaryDeficit({ targetMacros, remainingMacros });
    expect(result.deficitType).toBe("protein");
    expect(result.deficitGrams).toBe(50);
  });

  it("calculates optimal serving that fits into available calories", () => {
    const tuna = CORE_BALANCER_FOODS.find((f) => f.name.includes("Тунец"))!;
    const recommendation = calculateOptimalServing({
      food: tuna,
      deficitType: "protein",
      deficitGrams: 30,
      availableCalories: 250,
    });

    expect(recommendation).not.toBeNull();
    // 30г белка из тунца (23г на 100г) = ~130г
    expect(recommendation!.servingGrams).toBeGreaterThanOrEqual(120);
    expect(recommendation!.calories).toBeLessThanOrEqual(250);
    expect(recommendation!.primaryNutrient).toBe("protein");
  });

  it("scales down serving size if calorie budget is tight", () => {
    const cottage = CORE_BALANCER_FOODS.find((f) => f.name.includes("Творог"))!;
    // Доступно только 100 ккал, а дефицит белка большой (40г)
    const recommendation = calculateOptimalServing({
      food: cottage,
      deficitType: "protein",
      deficitGrams: 40,
      availableCalories: 100,
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation!.calories).toBeLessThanOrEqual(105);
    expect(recommendation!.servingGrams).toBeLessThan(100);
  });

  it("returns balanced status when calories are exhausted", () => {
    const result = balanceMacros({
      targetCalories: 2000,
      remainingCalories: 20,
      targetMacros: { proteinG: 140, fatG: 60, carbsG: 200 },
      remainingMacros: { proteinG: 40, fatG: 20, carbsG: 50 },
    });

    expect(result.isBalanced).toBe(true);
    expect(result.recommendations).toHaveLength(0);
  });
});
