import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";

export async function detectEquipment<T>(image: { data: string; mimeType: string }, systemPrompt: string, schema: z.ZodType<T>): Promise<T> {
  try {
    const primary = await generateGeminiJson({
      systemPrompt, contents: [{ role: "user", parts: [
        { text: "Определи тренажёр по изображению. Если не уверен — явно укажи это." },
        { inlineData: { mimeType: image.mimeType, data: image.data } },
      ] }], schema, temperature: 0.1, timeoutMs: 12_000,
    });
    if (typeof primary === "object" && primary !== null && "uncertain" in primary && primary.uncertain === true) {
      throw new Error("Equipment unclear");
    }
    return primary;
  } catch {
    const key = process.env.GROQ_API_KEY;
    if (key) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${attempt === 1 ? process.env.GROQ_FALLBACK_API_KEY || key : key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: [
              { type: "text", text: attempt === 0
                ? "Определи тренажёр, не рассчитывай калории."
                : "Повторно проверь фото по конструкции: сиденье, упоры, рукояти, траектория рычагов и нагрузка. Сопоставь с каталогом. Не угадывай, если оборудование не различимо. Верни JSON, калории не рассчитывай." },
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
            ] }], response_format: { type: "json_object" }, temperature: 0.1, max_completion_tokens: 2048,
          }), signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error("Vision unavailable");
        const result = await response.json();
        const parsed = schema.parse(JSON.parse(result?.choices?.[0]?.message?.content));
        if (attempt === 0 && typeof parsed === "object" && parsed !== null && "uncertain" in parsed && parsed.uncertain === true) continue;
        return parsed;
      } catch { /* Fall through to a user-facing, provider-independent error. */ }
      }
    }
    throw new Error("Не удалось распознать тренажёр. Повторите попытку с этим фото или выберите тренажёр из каталога.");
  }
}
