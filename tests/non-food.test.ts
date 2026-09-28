import { describe, expect, it } from "vitest";
import { safeParseAnalysis } from "../src/lib/ai/schema";
import {
  normalizeNonFoodReason,
  getRandomNonFoodResponse,
  getNonFoodMeta,
  NON_FOOD_RESPONSES,
  type NonFoodReason,
} from "../src/lib/ai/nonFoodPhrases";

describe("Non-food detection & witty AI responses", () => {
  it("correctly parses explicit non-food rejection for a person/selfie", () => {
    const raw = JSON.stringify({
      is_food: false,
      not_food_reason: "person",
      funny_response: "Эй, это кажется вы! Вы прекрасны, но я не могу определить вашу калорийность — людей мы не едим! 😉",
      items: [],
      total_weight_grams: 0,
      scale_detected: false,
      scale_reading: null,
      overall_confidence: 0,
      warnings: [],
    });

    const parsed = safeParseAnalysis(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.data.is_food) return;

    expect(parsed.data.is_food).toBe(false);
    expect(parsed.data.not_food_reason).toBe("person");
    expect(parsed.data.funny_response).toContain("кажется вы");
    expect(parsed.data.items).toEqual([]);
    expect(parsed.data.total_weight_grams).toBe(0);
  });

  it("normalizes diverse AI reason strings into canonical categories", () => {
    expect(normalizeNonFoodReason("человек")).toBe("person");
    expect(normalizeNonFoodReason("Селфи пользователя")).toBe("person");
    expect(normalizeNonFoodReason("лицо человека")).toBe("person");
    expect(normalizeNonFoodReason("human face")).toBe("person");

    expect(normalizeNonFoodReason("рыжий кот")).toBe("pet");
    expect(normalizeNonFoodReason("собака")).toBe("pet");
    expect(normalizeNonFoodReason("cute puppy")).toBe("pet");

    expect(normalizeNonFoodReason("ноутбук Apple")).toBe("gadget");
    expect(normalizeNonFoodReason("экран смартфона")).toBe("gadget");
    expect(normalizeNonFoodReason("tech gadget")).toBe("gadget");

    expect(normalizeNonFoodReason("пустая тарелка")).toBe("empty_plate");
    expect(normalizeNonFoodReason("empty bowl")).toBe("empty_plate");

    expect(normalizeNonFoodReason("размытый снимок")).toBe("blur");
    expect(normalizeNonFoodReason("темнота")).toBe("blur");

    expect(normalizeNonFoodReason("ключи от машины")).toBe("inanimate_object");
    expect(normalizeNonFoodReason("кожаная обувь")).toBe("inanimate_object");
    expect(normalizeNonFoodReason("непонятная абстракция")).toBe("other");
  });

  it("provides delightful fallback funny phrases when model omits custom response", () => {
    const raw = JSON.stringify({
      is_food: false,
      not_food_reason: "pet",
    });

    const parsed = safeParseAnalysis(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.data.is_food) return;

    expect(parsed.data.is_food).toBe(false);
    expect(parsed.data.not_food_reason).toBe("pet");
    expect(parsed.data.funny_response.length).toBeGreaterThan(15);
    const lower = parsed.data.funny_response.toLowerCase();
    expect(
      lower.includes("питом") ||
      lower.includes("пушист") ||
      lower.includes("хвост") ||
      lower.includes("кот") ||
      lower.includes("звер")
    ).toBe(true);
  });

  it("rescues non-JSON conversational refusal mentioning people or pets", () => {
    const rawPersonText = "На фото изображено лицо человека, а не блюдо. Я не считаю калории в людях.";
    const parsedPerson = safeParseAnalysis(rawPersonText);
    expect(parsedPerson.ok).toBe(true);
    if (parsedPerson.ok && !parsedPerson.data.is_food) {
      expect(parsedPerson.data.is_food).toBe(false);
      expect(parsedPerson.data.not_food_reason).toBe("person");
      expect(parsedPerson.data.funny_response).toBe(rawPersonText);
    }

    const rawPetText = "Это домашний кот на диване, а не еда!";
    const parsedPet = safeParseAnalysis(rawPetText);
    expect(parsedPet.ok).toBe(true);
    if (parsedPet.ok && !parsedPet.data.is_food) {
      expect(parsedPet.data.is_food).toBe(false);
      expect(parsedPet.data.not_food_reason).toBe("pet");
    }
  });

  it("verifies rich non-food responses and metadata exist for all categories", () => {
    const reasons: NonFoodReason[] = [
      "person",
      "pet",
      "gadget",
      "empty_plate",
      "inanimate_object",
      "blur",
      "other",
    ];

    for (const reason of reasons) {
      const phrase = getRandomNonFoodResponse(reason);
      expect(typeof phrase).toBe("string");
      expect(phrase.length).toBeGreaterThan(20);

      const meta = getNonFoodMeta(reason);
      expect(meta.emoji).toBeDefined();
      expect(meta.title).toBeDefined();
      expect(meta.subtitle).toBeDefined();
      expect(meta.badge).toBeDefined();

      expect(NON_FOOD_RESPONSES[reason].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("maintains strict nutrition rejection when items are empty and not marked as non-food", () => {
    const emptyItemsFood = {
      items: [],
      total_weight_grams: 100,
      scale_detected: false,
      scale_reading: null,
      overall_confidence: 0.5,
      warnings: [],
    };
    expect(safeParseAnalysis(emptyItemsFood).ok).toBe(false);
  });

  it("still parses valid food with products properly", () => {
    const validFood = {
      items: [
        {
          name: "Oatmeal",
          name_local: "Овсянка",
          weight_grams: 200,
          weight_confidence: 0.9,
          calories_per_100g: 68,
          protein_per_100g: 2.5,
          fat_per_100g: 1.4,
          carbs_per_100g: 12,
          identification_confidence: 0.95,
        },
      ],
      total_weight_grams: 200,
      scale_detected: false,
      scale_reading: null,
      overall_confidence: 0.9,
      warnings: [],
    };

    const parsed = safeParseAnalysis(validFood);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.is_food).toBe(true);
      expect(parsed.data.items.length).toBe(1);
      expect(parsed.data.items[0].name_local).toBe("Овсянка");
    }
  });
});
