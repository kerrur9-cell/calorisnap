import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";

// Only accept an unambiguous, complete treadmill description locally.
export function parseSimpleTreadmill(text: string) {
  const match = text.toLowerCase().trim().match(/^(\d+(?:[.,]\d+)?)\s*минут(?:а|ы)?\s+на беговой дорожке со скоростью\s+(\d+(?:[.,]\d+)?)\s*км\s*\/\s*ч(?:\s+(?:с (?:наклоном|уклоном)\s+(\d+(?:[.,]\d+)?)\s*%|без наклона))?[.!]?$/);
  if (!match) return null;
  const duration = Number(match[1].replace(",", "."));
  const speed = Number(match[2].replace(",", "."));
  if (duration <= 0 || duration > 1440 || speed <= 0 || speed > 40) return null;
  const incline = match[3] ? Number(match[3].replace(",", ".")) : text.includes("без наклона") ? 0 : null;
  if (incline !== null && incline > 40) return null;
  const ambiguous = speed >= 6.5 && speed <= 7.2;
  return {
    exerciseName: "Беговая дорожка", activityKey: "treadmill", category: "cardio",
    durationMinutes: duration, durationExplicitlyProvided: true,
    speedKmh: speed, speedExplicitlyProvided: true,
    inclinePercent: incline, inclineExplicitlyProvided: incline !== null,
    isAmbiguous: ambiguous,
    ambiguityNote: ambiguous ? "Уточните: это была ходьба или бег? При такой скорости возможны оба варианта." : null,
    neutralCommentary: "Расход энергии — оценка калькулятора, а не измерение. Проверьте тип движения и наклон дорожки.",
  };
}

export async function extractWorkout<T>(text: string, systemPrompt: string, schema: z.ZodType<T>): Promise<T> {
  const local = parseSimpleTreadmill(text);
  if (local) return schema.parse(local);
  try {
    return await generateGeminiJson({ systemPrompt, prompt: JSON.stringify({ description: text }), schema, temperature: 0.1, timeoutMs: 12_000 });
  } catch {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Не удалось распознать тренировку. Укажите её параметры вручную или повторите попытку.");
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
          messages: [{ role: "system", content: systemPrompt + " Не подставляй отсутствующие параметры. Никогда не возвращай калории, MET или собственные расчёты." }, { role: "user", content: JSON.stringify({ description: text }) }],
          response_format: { type: "json_object" }, temperature: 0.1, max_completion_tokens: 2048,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Provider unavailable");
      const result = await response.json();
      return schema.parse(JSON.parse(result?.choices?.[0]?.message?.content));
    } catch {
      throw new Error("Не удалось распознать тренировку. Укажите её параметры вручную или повторите попытку.");
    }
  }
}
