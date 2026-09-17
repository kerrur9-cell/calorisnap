import { describe, expect, it } from "vitest";
import { safeParseAnalysis } from "../src/lib/ai/schema";
import { calculateTdee } from "../src/lib/nutrition/tdee";
import { macrosForWeight, sumTotals } from "../src/lib/nutrition/macros";
import { addDays } from "../src/lib/utils";
import { nutritionSchema, resolveMealType } from "../src/lib/validation";

const analysis = { items: [{ name: "Rice", weight_grams: 100, weight_confidence: 0.5,
  calories_per_100g: 130, protein_per_100g: 2.7, fat_per_100g: 0, carbs_per_100g: 28,
  identification_confidence: 0.8 }], total_weight_grams: 100, scale_detected: false,
  scale_reading: null, overall_confidence: 0.5, warnings: [] };
describe("nutrition integrity", () => {
  it("rejects malformed AI nutrition instead of inventing zero calories", () => {
    expect(safeParseAnalysis({ ...analysis, items: [{ ...analysis.items[0], calories_per_100g: "unknown" }] }).ok).toBe(false);
    expect(safeParseAnalysis({ ...analysis, items: [{}] }).ok).toBe(false);
    expect(safeParseAnalysis({ ...analysis, items: [] }).ok).toBe(false);
  });
  it("accepts actual zero fat, decimal numeric strings and unit suffixes", () => {
    const result = safeParseAnalysis({ ...analysis, items: [{ ...analysis.items[0], weight_grams: "100 г", protein_per_100g: "2,7" }] });
    expect(result.ok && result.data.items[0].protein_per_100g).toBe(2.7);
    expect(result.ok && result.data.items[0].fat_per_100g).toBe(0);
  });
  it("normalizes mismatched Gemini totals instead of rejecting usable food data", () => {
    const result = safeParseAnalysis({ ...analysis, total_weight_grams: 260 });
    expect(result.ok && result.data.total_weight_grams).toBe(100);
    expect(result.ok && result.data.warnings.some((warning) => warning.includes("итоговый вес пересчитан"))).toBe(true);
  });
  it("keeps persisted snake_case macros in daily totals", () => {
    expect(sumTotals([{ calories: 260, protein_g: 5.4, fat_g: 0, carbs_g: 56 }])).toEqual({ calories: 260, proteinG: 5.4, fatG: 0, carbsG: 56 });
    expect(macrosForWeight({ calories: 130, protein: 2.7, fat: 0, carbs: 28 }, 200).calories).toBe(260);
  });
  it("rejects negative nutrition and unsupported profile ranges", () => {
    expect(nutritionSchema.safeParse({ calories: -1, protein: 0, fat: 0, carbs: 0 }).success).toBe(false);
    expect(() => calculateTdee({ gender: "male", age: -5, heightCm: 175, weightKg: 75, activityLevel: "moderate", goal: "lose" })).toThrow();
  });
  it("handles month boundaries and invalid URL meal types", () => {
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(["breakfast", "lunch", "dinner", "snack"]).toContain(resolveMealType("malicious"));
  });
});
