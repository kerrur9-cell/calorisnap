import { describe, it, expect } from "vitest";
import { generateFoodSwaps } from "../src/lib/nutrition/swap";

describe("Food Swap", () => {
  it("suggests lighter replacement for mayonnaise", () => {
    const original = {
      name: "Майонез провансаль",
      weightGrams: 50,
      calories: 310,
      proteinG: 0.5,
      fatG: 33.5,
      carbsG: 1.3,
    };

    const swaps = generateFoodSwaps(original);
    const lighter = swaps.find((s) => s.type === "lighter");
    expect(lighter).toBeDefined();
    expect(lighter!.deltaCalories).toBeLessThan(-200);
    expect(lighter!.newName).toContain("йогурт");
  });

  it("suggests protein-dense alternative for pizza or fastfood", () => {
    const original = {
      name: "Пицца пепперони",
      weightGrams: 300,
      calories: 840,
      proteinG: 28,
      fatG: 36,
      carbsG: 96,
    };

    const swaps = generateFoodSwaps(original);
    const highProtein = swaps.find((s) => s.type === "higher_protein");
    expect(highProtein).toBeDefined();
    expect(highProtein!.deltaCalories).toBeLessThan(0);
  });

  it("always provides a 25% portion reduction option for dishes >100g", () => {
    const original = {
      name: "Паста карбонара",
      weightGrams: 250,
      calories: 650,
      proteinG: 22,
      fatG: 28,
      carbsG: 75,
    };

    const swaps = generateFoodSwaps(original);
    const portionOption = swaps.find((s) => s.type === "portion_reduction");
    expect(portionOption).toBeDefined();
    expect(portionOption!.newWeightGrams).toBe(188); // 250 * 0.75
    expect(portionOption!.deltaCalories).toBeLessThan(-150);
  });
});
