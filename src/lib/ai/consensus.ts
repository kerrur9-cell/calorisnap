import { analyzeFoodPhoto, type AnalyzePhotoInput } from "./gemini";
import { analyzeFoodPhotoWithOpenRouter } from "./openrouter";
import { analyzeFoodPhotoWithGroq } from "./groq";
import { judgeAnalysesWithJev, type CandidateAnalysis } from "./jev-judge";
import type { AiAnalysisResponse } from "./schema";

export type AnalysisProvider = "gemini" | "openrouter" | "groq";

export interface MultiModelAnalysisOptions extends AnalyzePhotoInput {
  forcedProvider?: AnalysisProvider;
}

/**
 * Запускает 3 нейросети одновременно (Gemini, OpenRouter, Groq),
 * а затем передаёт их ответы арбитру JEV (TypeSafe AI) для выбора
 * наиболее правдивого, точного и реалистичного результата.
 */
export async function analyzeFoodPhotoWithConsensus(
  input: MultiModelAnalysisOptions,
): Promise<AiAnalysisResponse> {
  // Если запрошен конкретный провайдер (например, при ручном выборе или отладке)
  if (input.forcedProvider === "gemini") {
    return analyzeFoodPhoto(input);
  }
  if (input.forcedProvider === "openrouter") {
    return analyzeFoodPhotoWithOpenRouter(input);
  }
  if (input.forcedProvider === "groq") {
    return analyzeFoodPhotoWithGroq(input);
  }

  const tasks: Array<Promise<CandidateAnalysis>> = [];

  if (process.env.GEMINI_API_KEY?.trim()) {
    tasks.push(
      analyzeFoodPhoto(input).then((data) => ({
        provider: "gemini" as const,
        data,
      })),
    );
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    tasks.push(
      analyzeFoodPhotoWithOpenRouter(input).then((data) => ({
        provider: "openrouter" as const,
        data,
      })),
    );
  }

  if (process.env.GROQ_API_KEY?.trim()) {
    tasks.push(
      analyzeFoodPhotoWithGroq(input).then((data) => ({
        provider: "groq" as const,
        data,
      })),
    );
  }

  if (tasks.length === 0) {
    throw new Error("Ни один провайдер ИИ не настроен (отсутствуют API-ключи)");
  }

  const settled = await Promise.allSettled(tasks);
  const successful: CandidateAnalysis[] = [];
  const errors: string[] = [];

  for (const res of settled) {
    if (res.status === "fulfilled") {
      successful.push(res.value);
    } else {
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      errors.push(msg);
      console.warn("Provider analysis failed in ensemble:", msg);
    }
  }

  if (successful.length === 0) {
    const detail = errors[0] || "Все модели временно недоступны";
    throw new Error(`Не удалось распознать фото: ${detail}`);
  }

  if (successful.length === 1) {
    return successful[0].data;
  }

  // 2 или 3 модели ответили — арбитр JEV выбирает лучший ответ
  const winner = await judgeAnalysesWithJev(successful);
  return winner.data;
}
