import { GROQ_FOOD_ANALYSIS_PROMPT } from "./prompts";
import { rebalanceWeights } from "./gemini";
import { foodAnalysisContent, type FoodAnalysisInput } from "./food-input";
import { normalizeFoodPreparation } from "../nutrition/food-preparation";
import { safeParseAnalysis, type AiAnalysisResponse } from "./schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";

export async function analyzeFoodPhotoWithGroq(input: FoodAnalysisInput): Promise<AiAnalysisResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Резервный анализ фото не настроен");

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: foodAnalysisContent(input, GROQ_FOOD_ANALYSIS_PROMPT) }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 4096,
      }),
      signal: AbortSignal.timeout(22_000),
    });
  } catch {
    throw new Error("Резервный анализатор не ответил по сети");
  }

  if (!response.ok) {
    throw new Error(response.status === 429
      ? "Groq: превышена квота запросов. Попробуйте позже."
      : response.status >= 500 ? "Groq временно недоступен. Попробуйте позже."
      : `Резервный анализатор отклонил фото (${response.status})`);
  }
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  const parsed = safeParseAnalysis(content);
  if (!parsed.ok) throw new Error(`Резервный анализатор не распознал фото: ${parsed.error}`);
  const result = rebalanceWeights(normalizeFoodPreparation(parsed.data, "description" in input ? input.description : undefined), input.totalWeightGrams);
  if ("description" in input && result.is_food) result.warnings = [...result.warnings, "Вес без указанной граммовки и КБЖУ оценены приблизительно. Проверьте порции перед сохранением."];
  return result;
}
