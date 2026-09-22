import { z } from "zod";
import { FOOD_ANALYSIS_PROMPT } from "./prompts";
import { safeParseAnalysis, type AiAnalysisResponse } from "./schema";

/**
 * Клиент Gemini. Вызывается ТОЛЬКО с сервера (Route Handler),
 * ключ живёт в GEMINI_API_KEY и в браузер не попадает.
 */

const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL ?? process.env.GEMINI_PRIMARY_MODEL ?? "gemini-3-flash-preview";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.6-flash";

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

/**
 * Один вызов Gemini. Вторая попытка идёт отдельным HTTP-запросом клиента,
 * чтобы каждый вызов уложился в таймаут функции и UI показал реальный этап.
 */
async function callGemini(
  body: object,
  apiKey: string,
  model: string,
  timeoutMs = 22_000,
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );

      if (!res.ok) {
        const message = `Gemini ошибка ${res.status}`;
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, message: `${message}: ${text.slice(0, 200)}` };
      }

      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts;
      let rawText = "";
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (typeof part?.text === "string" && !part?.thought) {
            rawText += part.text;
          }
        }
        if (!rawText && parts[0]?.text) {
          rawText = parts[0].text;
        }
      }
      if (!rawText) {
        return { ok: false, status: 200, message: "Gemini вернул пустой ответ" };
      }
      return { ok: true, text: rawText };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, message: `Gemini не ответил: ${errMsg}` };
    }
}

export function rebalanceWeights(
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
  attempt: "primary" | "secondary" = "primary",
): Promise<AiAnalysisResponse> {
  const apiKey = attempt === "secondary" ? process.env.GEMINI_FALLBACK_API_KEY : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI не настроен: отсутствует ключ Gemini");
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

  let response = await callGemini(body, apiKey, attempt === "secondary" ? GEMINI_FALLBACK_MODEL : GEMINI_PRIMARY_MODEL);
  if (!response.ok && attempt === "primary") {
    const altKey = process.env.GEMINI_FALLBACK_API_KEY || apiKey;
    const altModel = GEMINI_FALLBACK_MODEL !== GEMINI_PRIMARY_MODEL ? GEMINI_FALLBACK_MODEL : "gemini-3.6-flash";
    const altResponse = await callGemini(body, altKey, altModel);
    if (altResponse.ok) {
      response = altResponse;
    }
  }

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

export interface GeminiJsonOptions<T = unknown> {
  systemPrompt?: string;
  prompt?: string;
  contents?: Array<{
    role: "user" | "model";
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  schema?: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseJsonSchema?: object;
}

const JSON_CANDIDATE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

/**
 * Универсальная генерация структурированного JSON через Gemini.
 * Автоматически перебирает быстрые надёжные модели (flash-lite -> flash)
 * и ключи (основной -> запасной), снимает markdown и валидирует Zod схему.
 */
export async function generateGeminiJson<T = unknown>(options: GeminiJsonOptions<T>): Promise<T> {
  const primaryKey = process.env.GEMINI_API_KEY;
  const fallbackKey = process.env.GEMINI_FALLBACK_API_KEY;
  const keys = [primaryKey, fallbackKey].filter((k): k is string => Boolean(k && k.trim()));

  if (keys.length === 0) {
    throw new Error("AI не настроен: отсутствует GEMINI_API_KEY");
  }

  const rawContents = options.contents && options.contents.length > 0
    ? options.contents
    : [
        {
          role: "user" as const,
          parts: [{ text: options.prompt ?? "" }],
        },
      ];

  // Нормализуем формат parts: Google Gemini REST API требует строго snake_case (inline_data, mime_type)
  const contents = rawContents.map((c) => ({
    role: c.role,
    parts: c.parts.map((p) => {
      const part: Record<string, unknown> = {};
      if (p.text !== undefined) part.text = p.text;
      const rawImg = (p as Record<string, unknown>).inline_data || (p as Record<string, unknown>).inlineData;
      if (rawImg && typeof rawImg === "object") {
        const imgObj = rawImg as Record<string, unknown>;
        part.inline_data = {
          mime_type: imgObj.mime_type || imgObj.mimeType || "image/jpeg",
          data: imgObj.data,
        };
      }
      return part;
    }),
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 4096,
      ...(options.responseJsonSchema ? { responseJsonSchema: options.responseJsonSchema } : {}),
    },
  };

  if (options.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: options.systemPrompt }],
    };
  }

  let lastError: Error | null = null;
  const deadline = options.timeoutMs === undefined ? Infinity : Date.now() + options.timeoutMs;

  for (const model of JSON_CANDIDATE_MODELS) {
    for (const key of keys) {
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw lastError ?? new Error("AI request timed out");
        const res = await callGemini(body, key, model, Math.min(22_000, remaining));
        if (!res.ok) {
          lastError = new Error(res.message);
          continue;
        }

        const cleaned = res.text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const parsed = JSON.parse(cleaned);

        if (options.schema) {
          const validated = options.schema.safeParse(parsed);
          if (!validated.success) {
            lastError = new Error(`Ответ модели не соответствует схеме: ${validated.error.message}`);
            continue;
          }
          return validated.data;
        }

        return parsed as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      if (Date.now() >= deadline) throw lastError ?? new Error("AI request timed out");
    }
  }

  throw lastError ?? new Error("Не удалось получить ответ от AI");
}

