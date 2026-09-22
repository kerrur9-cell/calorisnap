import { describe, it, expect } from "vitest";
import {
  analyzePersonalFoodGraph,
  getSmartFoodSuggestions,
  type MealHistoryEntry,
} from "@/lib/nutrition/personalization";

describe("Personal Food Graph", () => {
  const mockMeals: MealHistoryEntry[] = [
    {
      meal_type: "breakfast",
      entry_date: "2026-03-01",
      meal_items: [
        {
          custom_food_name: "Овсяная каша",
          weight_grams: 200,
          calories: 180,
          protein_g: 6,
          fat_g: 3,
          carbs_g: 32,
        },
        {
          custom_food_name: "Молоко 2.5%",
          weight_grams: 100,
          calories: 52,
          protein_g: 3,
          fat_g: 2.5,
          carbs_g: 4.7,
        },
        {
          custom_food_name: "Банан",
          weight_grams: 120,
          calories: 105,
          protein_g: 1.5,
          fat_g: 0.2,
          carbs_g: 25,
        },
      ],
    },
    {
      meal_type: "breakfast",
      entry_date: "2026-03-02",
      meal_items: [
        {
          custom_food_name: "Овсяная каша",
          weight_grams: 220,
          calories: 200,
          protein_g: 7,
          fat_g: 3.5,
          carbs_g: 35,
        },
        {
          custom_food_name: "Банан",
          weight_grams: 130,
          calories: 110,
          protein_g: 1.6,
          fat_g: 0.3,
          carbs_g: 26,
        },
      ],
    },
    {
      meal_type: "lunch",
      entry_date: "2026-03-01",
      meal_items: [
        {
          custom_food_name: "Куриное филе",
          weight_grams: 150,
          calories: 165,
          protein_g: 35,
          fat_g: 2.5,
          carbs_g: 0,
        },
        {
          custom_food_name: "Гречка варёная",
          weight_grams: 180,
          calories: 185,
          protein_g: 6,
          fat_g: 2,
          carbs_g: 36,
        },
      ],
    },
    {
      meal_type: "snack",
      entry_date: "2026-03-01",
      meal_items: [
        {
          custom_food_name: "Печенье с шоколадом",
          weight_grams: 100,
          calories: 500,
          protein_g: 6,
          fat_g: 25,
          carbs_g: 65,
        },
      ],
    },
    {
      meal_type: "snack",
      entry_date: "2026-03-02",
      meal_items: [
        {
          custom_food_name: "Печенье с шоколадом",
          weight_grams: 120,
          calories: 600,
          protein_g: 7,
          fat_g: 30,
          carbs_g: 78,
        },
      ],
    },
    {
      meal_type: "snack",
      entry_date: "2026-03-03",
      meal_items: [
        {
          custom_food_name: "Печенье с шоколадом",
          weight_grams: 80,
          calories: 400,
          protein_g: 5,
          fat_g: 20,
          carbs_g: 52,
        },
      ],
    },
  ];

  it("identifies frequent foods with accurate averages and typical meal types", () => {
    const graph = analyzePersonalFoodGraph(mockMeals);

    expect(graph.frequentFoods.length).toBeGreaterThan(0);
    const oatmeal = graph.frequentFoods.find((f) => f.foodName === "Овсяная каша");
    expect(oatmeal).toBeDefined();
    expect(oatmeal?.frequency).toBe(2);
    expect(oatmeal?.avgPortionGrams).toBe(210); // (200 + 220) / 2
    expect(oatmeal?.typicalMealTypes).toContain("breakfast");
  });

  it("computes food companions and co-occurrences", () => {
    const graph = analyzePersonalFoodGraph(mockMeals);

    const oatmealCompanions = graph.companionsByFood["овсяная каша"];
    expect(oatmealCompanions).toBeDefined();
    expect(oatmealCompanions.some((c) => c.foodName === "Банан")).toBe(true);
    // Banana co-occurred twice with oatmeal
    const banana = oatmealCompanions.find((c) => c.foodName === "Банан");
    expect(banana?.coOccurrenceCount).toBe(2);
  });

  it("suggests companions when adding food", () => {
    const graph = analyzePersonalFoodGraph(mockMeals);

    // When oatmeal is already in current food list, banana should be suggested first
    const suggestions = getSmartFoodSuggestions(graph, "breakfast", ["Овсяная каша"]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].foodName).toBe("Банан");
  });

  it("detects trigger patterns that correlate with calorie surplus days", () => {
    const dailyTotalsMap = new Map([
      ["2026-03-01", { totalCalories: 2600, targetCalories: 2000 }], // +600 kcal
      ["2026-03-02", { totalCalories: 2550, targetCalories: 2000 }], // +550 kcal
      ["2026-03-03", { totalCalories: 2450, targetCalories: 2000 }], // +450 kcal
    ]);

    const graph = analyzePersonalFoodGraph(mockMeals, dailyTotalsMap);
    expect(graph.triggers.length).toBeGreaterThan(0);

    const cookieTrigger = graph.triggers.find((t) => t.foodName === "Печенье с шоколадом");
    expect(cookieTrigger).toBeDefined();
    expect(cookieTrigger?.surplusRate).toBe(1); // 100% of days with cookie exceeded target
    expect(cookieTrigger?.avgSurplusCalories).toBeGreaterThan(400);
  });
});
