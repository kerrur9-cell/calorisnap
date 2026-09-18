import { GROQ_FOOD_ANALYSIS_PROMPT } from "./prompts";
import { rebalanceWeights, type AnalyzePhotoInput } from "./gemini";
import { safeParseAnalysis, type AiAnalysisResponse } from "./schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";

export async function analyzeFoodPhotoWithGroq(input: AnalyzePhotoInput): Promise<AiAnalysisResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Резервный анализ фото не настроен");

  const weightInstruction = input.totalWeightGrams
    ? `\n\nПользователь указал общий вес порции: ${input.totalWeightGrams} г. Распредели его по видимым продуктам.`
    : "";
  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: [
          { type: "text", text: GROQ_FOOD_ANALYSIS_PROMPT + weightInstruction },
          { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.dataBase64}` } },
        ] }],
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
    throw new Error(response.status === 429 || response.status >= 500
      ? "Все анализаторы сейчас перегружены. Попробуйте чуть позже."
      : `Резервный анализатор отклонил фото (${response.status})`);
  }
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  const parsed = safeParseAnalysis(content);
  if (!parsed.ok) throw new Error(`Резервный анализатор не распознал фото: ${parsed.error}`);
  return rebalanceWeights(parsed.data, input.totalWeightGrams);
}
