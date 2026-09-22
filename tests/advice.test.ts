import { describe, expect, it } from "vitest";
import { decideAdvice, validateAdvice } from "../src/lib/nutrition/advice";

const targets = { proteinG: 120, fatG: 70, carbsG: 200 };
const consumed = (calories: number) => ({ calories, proteinG: 40, fatG: 20, carbsG: 70 });
const valid = { mode: "normal", message: "Подойдёт один из вариантов.", highlights: ["Остаток рассчитан"], recommendations: [
  { name: "Творог", portion: "150 г", calories: 250, protein: 25, fat: 8, carbs: 10, reason: "Поможет добрать белок" },
] };

describe("deterministic advice decision", () => {
  it("permits food below the calorie goal", () => expect(decideAdvice(1800, targets, consumed(1200)).mode).toBe("normal"));
  it("permits a small food when 50 kcal remain", () => expect(decideAdvice(1800, targets, consumed(1750)).mode).toBe("normal"));
  it("does not recommend food at the goal", () => expect(decideAdvice(1800, targets, consumed(1800)).mode).toBe("goal_reached"));
  it("enters over_limit above goal, including a large excess", () => {
    expect(decideAdvice(1800, targets, consumed(2000)).mode).toBe("over_limit");
    expect(decideAdvice(1800, targets, consumed(12000)).mode).toBe("over_limit");
  });
  it("drops model recommendations that exceed remaining calories", () => {
    const decision = decideAdvice(1800, targets, consumed(1500));
    const result = validateAdvice({ ...valid, recommendations: [{ ...valid.recommendations[0], calories: 500 }] }, decision);
    expect(result?.recommendations).toEqual([]);
  });
  it("drops recommendations in over_limit even if the model returns them", () => {
    const result = validateAdvice(valid, decideAdvice(1800, targets, consumed(2000)));
    expect(result?.recommendations).toEqual([]);
  });
  it("drops duplicate foods", () => {
    const result = validateAdvice({ ...valid, recommendations: [...valid.recommendations, { ...valid.recommendations[0], portion: "200 г" }] }, decideAdvice(1800, targets, consumed(1200)));
    expect(result?.recommendations).toHaveLength(1);
  });
  it("rejects malformed model output", () => expect(validateAdvice({ nope: true }, decideAdvice(1800, targets, consumed(1200)))).toBeNull());
});
