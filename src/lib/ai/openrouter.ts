import { FOOD_ANALYSIS_PROMPT } from "./prompts";
import { rebalanceWeights } from "./gemini";
import { foodAnalysisContent, type FoodAnalysisInput } from "./food-input";
import { normalizeFoodPreparation } from "../nutrition/food-preparation";
import { safeParseAnalysis, type AiAnalysisResponse } from "./schema";

export async function analyzeFoodPhotoWithOpenRouter(input: FoodAnalysisInput): Promise<AiAnalysisResponse> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("Дополнительный анализ фото не настроен");
  const model = process.env.OPENROUTER_VISION_MODEL?.trim() || "nvidia/nemotron-3.5-super-vl:free";
  // Never silently charge for a paid model or paid provider fallback.
  if (!model.endsWith(":free")) throw new Error("Для OpenRouter нужна бесплатная vision-модель");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        provider: { max_price: { prompt: 0, completion: 0 } },
        messages: [{ role: "user", content: foodAnalysisContent(input, FOOD_ANALYSIS_PROMPT) }],
        reasoning: { max_tokens: 0 },
        temperature: 0.1, max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(22_000),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      console.warn("OpenRouter photo failed", { status: response.status, model });
      if (response.status === 429) throw new Error("OpenRouter: бесплатная модель занята или достигнут лимит запросов. Попробуйте позже.");
      if (response.status === 401 || response.status === 403) throw new Error("OpenRouter: проверьте ключ и доступ к модели.");
      if (response.status === 402) throw new Error("OpenRouter: бесплатная модель сейчас недоступна для этого аккаунта.");
      throw new Error("OpenRouter не смог обработать фото. Попробуйте ещё раз.");
    }
    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("OpenRouter вернул пустой ответ. Повторите попытку.");
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = safeParseAnalysis(cleaned);
    if (!parsed.ok) throw new Error("Не удалось разобрать ответ OpenRouter. Повторите попытку или добавьте еду вручную.");
    const result = rebalanceWeights(normalizeFoodPreparation(parsed.data, "description" in input ? input.description : undefined), input.totalWeightGrams);
    if ("description" in input && result.is_food) {
      result.warnings = [...result.warnings, "Вес без указанной граммовки и КБЖУ оценены приблизительно. Проверьте порции перед сохранением."];
    }
    return result;
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("OpenRouter не успел обработать фото. Повторите попытку.");
    }
    if (error instanceof Error && (error.message.startsWith("OpenRouter") || error.message.startsWith("Не удалось разобрать"))) throw error;
    throw new Error("Не удалось связаться с OpenRouter. Повторите попытку.");
  }
}
