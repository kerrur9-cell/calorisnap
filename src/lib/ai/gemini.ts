import { FOOD_ANALYSIS_PROMPT } from "./prompts";
import { safeParseAnalysis, type AiAnalysisResponse } from "./schema";

/**
 * Клиент Gemini. Вызывается ТОЛЬКО с сервера (Route Handler),
 * ключ живёт в GEMINI_API_KEY и в браузер не попадает.
 */

// gemini-3.6-flash часто отдаёт 429/high demand. Для фотоанализа первым
// используем стабильный flash, а переменную GEMINI_MODEL оставляем запасной.
const GEMINI_PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL ?? "gemini-3.5-flash";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? GEMINI_MODEL;

export interface AnalyzePhotoInput {
  /** base64 данные фото (без data: префикса) */
  dataBase64: string;
  mimeType: string;
  /** Опциональный вес, введённый пользователем заранее */
  totalWeightGrams?: number;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // The signal remains active while the response body is being read.
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Вызов Gemini с ретраями. Google периодически отдаёт 429/503 («high demand»),
 * поэтому при перегрузке сразу используем стабильную запасную модель.
 */
async function callGemini(
  body: object,
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  let last: { status: number; message: string } | null = null;
  const models = [...new Set([GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_MODEL])];

  for (const [index, model] of models.entries()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey!,
          },
          body: JSON.stringify(body),
        },
        22_000,
      );

      if (!res.ok) {
        last = { status: res.status, message: `Gemini ошибка ${res.status}` };
        // Capacity errors are often model-specific; fail over immediately.
        if (res.status === 429 || res.status >= 500) {
          if (index < models.length - 1) await sleep(300);
          continue;
        }
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, message: `${last.message}: ${text.slice(0, 200)}` };
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        last = { status: 200, message: "Gemini вернул пустой ответ" };
        if (index < models.length - 1) await sleep(300);
        continue;
      }
      return { ok: true, text: rawText };
    } catch {
      // A network issue may be isolated to the current model endpoint.
      last = { status: 0, message: "Gemini не ответил по сети" };
      if (index < models.length - 1) await sleep(300);
    }
  }

  return { ok: false, status: last?.status ?? 0, message: last?.message ?? "Gemini недоступен" };
}

function rebalanceWeights(
  data: AiAnalysisResponse,
  totalWeightGrams?: number,
): AiAnalysisResponse {
  if (!totalWeightGrams || totalWeightGrams <= 0 || data.items.length === 0) {
    return data;
  }

  const currentTotal = data.items.reduce((sum, item) => sum + item.weight_grams, 0);
  if (currentTotal <= 0) return { ...data, total_weight_grams: totalWeightGrams };

  const factor = totalWeightGrams / currentTotal;
  const items = data.items.map((item) => ({
    ...item,
    weight_grams: Math.max(1, Math.round(item.weight_grams * factor)),
  }));
  const roundedTotal = items.reduce((sum, item) => sum + item.weight_grams, 0);
  const delta = Math.round(totalWeightGrams - roundedTotal);
  if (delta !== 0) {
    const largestIndex = items.reduce(
      (best, item, index) => (item.weight_grams > items[best].weight_grams ? index : best),
      0,
    );
    items[largestIndex] = {
      ...items[largestIndex],
      weight_grams: Math.max(1, items[largestIndex].weight_grams + delta),
    };
  }

  return {
    ...data,
    items,
    total_weight_grams: totalWeightGrams,
    warnings: [
      ...data.warnings,
      "Вес продуктов приведён к общему весу, указанному пользователем.",
    ],
  };
}

export async function analyzeFoodPhoto(
  input: AnalyzePhotoInput,
): Promise<AiAnalysisResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("АI не настроен: нет GEMINI_API_KEY");
  }

  // Дополняем промпт переданным весом
  let prompt = FOOD_ANALYSIS_PROMPT;
  if (input.totalWeightGrams && input.totalWeightGrams > 0) {
    prompt +=
      `\n\nПОЛЬЗОВАТЕЛЬ УКАЗАЛ ОБЩИЙ ВЕС ПОРЦИИ: ${input.totalWeightGrams} г. ` +
      `Распредели этот вес между продуктами пропорционально визуальному объёму и верни total_weight_grams=${input.totalWeightGrams}.`;
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: input.mimeType,
              data: input.dataBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      // Побольше токенов: у тарелки со многими ингредиентами длинный JSON,
      // на обрезке модель выдавала битый ответ
      maxOutputTokens: 4096,
    },
  };

  const response = await callGemini(body);
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new Error("AI временно перегружен. Попробуйте ещё раз через минуту.");
    }
    throw new Error(response.message);
  }

  // Gemini может обернуть JSON в ```json ... ``` — снимаем
  const cleaned = response.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = safeParseAnalysis(cleaned);
  if (!parsed.ok) {
    throw new Error(
      `Модель вернула ответ, который не удалось разобрать: ${parsed.error}`,
    );
  }

  return rebalanceWeights(parsed.data, input.totalWeightGrams);
}
