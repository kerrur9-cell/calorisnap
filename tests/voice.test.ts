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

describe("Voice Response Schema Validation", () => {
  it("validates successful food logging response with smart AI response", async () => {
    const { voiceResponseSchema } = await import("../src/lib/voice/schema");
    const sample = {
      transcript: "Съел 2 яйца и тост",
      status: "success",
      suggestedMealType: "breakfast",
      items: [
        {
          name: "Яйцо куриное",
          weight_grams: 110,
          calories: 150,
          protein_g: 13,
          fat_g: 11,
          carbs_g: 1,
        },
        {
          name: "Тост из пшеничного хлеба",
          weight_grams: 35,
          calories: 85,
          protein_g: 3,
          fat_g: 1,
          carbs_g: 16,
        },
      ],
      aiResponse: "Записал 2 яйца и тост (~235 ккал). Проверьте граммовки перед сохранением.",
      tips: "Отличный белковый завтрак!",
    };

    const parsed = voiceResponseSchema.parse(sample);
    expect(parsed.status).toBe("success");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.aiResponse).toContain("Записал 2 яйца");
    expect(parsed.tips).toBe("Отличный белковый завтрак!");
  });

  it("validates nutrition question response with empty items and smart answer", async () => {
    const { voiceResponseSchema } = await import("../src/lib/voice/schema");
    const sample = {
      transcript: "Сколько калорий в банане?",
      status: "question_answered",
      items: [],
      aiResponse: "В среднем банане (~120 г) содержится около 105-115 ккал и 27 г углеводов.",
    };

    const parsed = voiceResponseSchema.parse(sample);
    expect(parsed.status).toBe("question_answered");
    expect(parsed.items).toHaveLength(0);
    expect(parsed.aiResponse).toContain("105-115 ккал");
  });

  it("validates non-food chat phrase with helpful guidance", async () => {
    const { voiceResponseSchema } = await import("../src/lib/voice/schema");
    const sample = {
      transcript: "Какая сегодня погода на улице?",
      status: "not_food",
      items: [],
      aiResponse: "Я нутрициолог-ассистент CaloriSnap. Назовите съеденные блюда для записи в дневник!",
    };

    const parsed = voiceResponseSchema.parse(sample);
    expect(parsed.status).toBe("not_food");
    expect(parsed.items).toHaveLength(0);
    expect(parsed.aiResponse).toContain("CaloriSnap");
  });

  it("defaults missing optional fields safely", async () => {
    const { voiceResponseSchema } = await import("../src/lib/voice/schema");
    const minimal = {};
    const parsed = voiceResponseSchema.parse(minimal);
    expect(parsed.status).toBe("success");
    expect(parsed.items).toEqual([]);
    expect(parsed.transcript).toBe("");
    expect(parsed.aiResponse).toBe("");
  });
});
