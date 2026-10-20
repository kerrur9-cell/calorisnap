import { expect, it } from "vitest";
import { safeParseAnalysis } from "../src/lib/ai/schema";
import { normalizeFoodPreparation, preparationFoodKey, PREPARATION_FOODS } from "../src/lib/nutrition/food-preparation";
import { macrosForWeight } from "../src/lib/nutrition/macros";

function food(name = "Гречка", english = "Buckwheat", calories = 343) {
  const parsed = safeParseAnalysis({ items: [{ name: english, name_local: name, weight_grams: 180,
    calories_per_100g: calories, protein_per_100g: 13, fat_per_100g: 3, carbs_per_100g: 72 }] });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

it("prevents dry-buckwheat nutrition from being applied to a cooked portion", () => {
  const result = normalizeFoodPreparation(food("Гречка сырая", "Buckwheat raw"));
  expect(result.items[0].calories_per_100g).toBe(110);
  expect(result.items[0].name_local).toBe("Гречка варёная");
  expect(result.items[0].weight_grams).toBe(180);
  expect(result.items[0].reference_food_key).toBe("buckwheat");
  expect(macrosForWeight(PREPARATION_FOODS.buckwheat.cooked.per100, 180).calories).toBe(198);
});
it("respects explicitly stated dry weight in inflected Russian text", () => {
  const result = normalizeFoodPreparation(food(), "180 г сухой гречки");
  expect(result.items[0].preparation_state).toBe("dry");
  expect(result.items[0].calories_per_100g).toBe(340);
  expect(result.items[0].weight_grams).toBe(180);
});
it("does not transfer another ingredient's dry state to buckwheat", () => {
  expect(normalizeFoodPreparation(food(), "50 г сухого риса и 180 г гречки").items[0].preparation_state).toBe("cooked");
});
it("keeps mixed dishes, brown rice, milk porridge and bakery products untouched", () => {
  for (const [local, english] of [["Гречка с курицей", "Buckwheat"], ["Рис бурый", "Brown rice"],
    ["Каша гречневая на молоке", "Buckwheat porridge"], ["Гречневые хлебцы", "Buckwheat crackers"],
    ["Паста с соусом", "Pasta with sauce"]]) {
    const result = normalizeFoodPreparation(food(local, english));
    expect(result.items[0].calories_per_100g).toBe(343);
    expect(result.items[0].reference_food_key).toBeUndefined();
  }
});
it("recognizes plain cooked staples in both languages", () => {
  expect(preparationFoodKey("boiled white rice")).toBe("rice");
  expect(preparationFoodKey("Макароны варёные без соли")).toBe("pasta");
  expect(preparationFoodKey("buckwheat porridge")).toBe("buckwheat");
  expect(preparationFoodKey("Каша гречневая")).toBe("buckwheat");
  expect(preparationFoodKey("Buckwheat kasha")).toBe("buckwheat");
  expect(preparationFoodKey("Гречневая каша рассыпчатая")).toBe("buckwheat");
  expect(preparationFoodKey("греческий йогурт")).toBeNull();
});
it("leaves non-food responses unchanged", () => {
  const parsed = safeParseAnalysis({ is_food: false, not_food_reason: "other", items: [] });
  if (!parsed.ok) throw new Error(parsed.error);
  expect(normalizeFoodPreparation(parsed.data)).toBe(parsed.data);
});
it("uses all four reference nutrients, rather than patching just calories", () => {
  const item = normalizeFoodPreparation(food("Рис", "Rice")).items[0];
  expect([item.calories_per_100g, item.protein_per_100g, item.fat_per_100g, item.carbs_per_100g]).toEqual([130, 2.7, 0.3, 28.2]);
});
