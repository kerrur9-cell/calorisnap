import { describe, it, expect } from "vitest";
import { classifyVoiceIntent, answerVoiceQuery } from "../src/lib/voice/intent";

describe("Voice Intent Classifier", () => {
  it("correctly identifies remaining calories questions", () => {
    expect(classifyVoiceIntent("Сколько мне осталось?")).toBe("REMAINING_CALORIES");
    expect(classifyVoiceIntent("сколько калорий осталось на сегодня")).toBe("REMAINING_CALORIES");
  });

  it("correctly identifies remaining protein questions", () => {
    expect(classifyVoiceIntent("Сколько белка мне осталось?")).toBe("REMAINING_PROTEIN");
    expect(classifyVoiceIntent("какой дефицит белка")).toBe("REMAINING_PROTEIN");
  });

  it("correctly identifies total eaten questions", () => {
    expect(classifyVoiceIntent("Сколько я сегодня съел?")).toBe("TOTAL_CALORIES");
    expect(classifyVoiceIntent("сколько калорий съел сегодня")).toBe("TOTAL_CALORIES");
  });

  it("correctly identifies food logging phrases", () => {
    expect(classifyVoiceIntent("Я съел два яйца, два куска хлеба и выпил латте")).toBe("LOG_FOOD");
    expect(classifyVoiceIntent("запиши на обед 200 грамм курицы")).toBe("LOG_FOOD");
  });

  it("provides deterministic local voice answers without LLM", () => {
    const consumed = { calories: 1200, proteinG: 80, fatG: 40, carbsG: 130 };
    const targetMacros = { proteinG: 120, fatG: 60, carbsG: 200 };

    const remainingCaloriesResult = answerVoiceQuery({
      intent: "REMAINING_CALORIES",
      consumed,
      targetCalories: 2000,
      targetMacros,
      eatenFoodNames: ["Овсянка", "Банан"],
    });

    expect(remainingCaloriesResult.answerText).toContain("800 ккал");

    const proteinResult = answerVoiceQuery({
      intent: "REMAINING_PROTEIN",
      consumed,
      targetCalories: 2000,
      targetMacros,
      eatenFoodNames: ["Овсянка"],
    });

    expect(proteinResult.answerText).toContain("40 грамм белка");
    expect(proteinResult.actionType).toBe("open_balancer");
  });
});
