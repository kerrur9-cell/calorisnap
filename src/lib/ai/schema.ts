import { z } from "zod";

/**
 * Проверяет структуру и диапазоны. Фактическую точность оценки фото
 * схема гарантировать не может: пользователь подтверждает результат.
 */

const asNumber = (v: unknown) => {
  if (typeof v === "string") {
    const normalized = v.trim().replace(",", ".");
    const match = normalized.match(/^-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : v;
  }
  return v;
};

const numToken = (max: number) =>
  z.preprocess(
    asNumber,
    z.number().finite().nonnegative().transform((n) => Math.min(n, max)),
  );

const confidenceToken = z.preprocess(
  asNumber,
  z.number().finite().default(0.5).transform((n) => Math.min(Math.max(n, 0), 1)),
);

const booleanToken = z.preprocess((v) => {
  if (typeof v === "string") return v.toLowerCase() === "true";
  return v;
}, z.boolean().default(false));

const warningsToken = z.preprocess((v) => {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return v;
}, z.array(z.string()).default([]));

const aiAnalysisItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_local: z.string().optional().default(""),
  weight_grams: numToken(5000).refine((n) => n > 0),
  weight_confidence: confidenceToken,
  calories_per_100g: numToken(1000),
  protein_per_100g: numToken(100),
  fat_per_100g: numToken(100),
  carbs_per_100g: numToken(100),
  identification_confidence: confidenceToken,
  notes: z.string().optional().default(""),
});

const aiAnalysisResponseSchema = z.object({
  items: z.array(aiAnalysisItemSchema).min(1).max(30),
  total_weight_grams: numToken(5000).optional(),
  scale_detected: booleanToken,
  scale_reading: numToken(5000).nullable().optional().default(null),
  overall_confidence: confidenceToken,
  warnings: warningsToken,
}).transform((value) => {
  const itemsTotal = value.items.reduce((sum, item) => sum + item.weight_grams, 0);
  const totalWeight = value.total_weight_grams && value.total_weight_grams > 0
    ? value.total_weight_grams
    : itemsTotal;
  const warnings = [...value.warnings];
  if (Math.abs(itemsTotal - totalWeight) > Math.max(3, value.items.length * 3)) {
    warnings.push("AI вернул несовпадающую сумму весов, поэтому итоговый вес пересчитан по продуктам.");
    return { ...value, total_weight_grams: itemsTotal, warnings };
  }
  return { ...value, total_weight_grams: totalWeight };
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;
export type AiAnalysisItem = z.infer<typeof aiAnalysisItemSchema>;

/** Нормализация «мусорного» JSON от модели в безопасный вид */
export function safeParseAnalysis(
  raw: unknown,
): { ok: true; data: AiAnalysisResponse } | { ok: false; error: string } {
  if (typeof raw === "string") {
    try {
      const json = raw.trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const firstBrace = json.indexOf("{");
      const lastBrace = json.lastIndexOf("}");
      raw = JSON.parse(firstBrace >= 0 && lastBrace > firstBrace ? json.slice(firstBrace, lastBrace + 1) : json);
    } catch {
      return { ok: false, error: "Модель вернула не-JSON ответ" };
    }
  }

  const result = aiAnalysisResponseSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `Ответ не прошёл валидацию: ${first?.path.join(".") ?? "?"} — ${first?.message ?? "?"}`,
    };
  }

  return { ok: true, data: result.data };
}

/** Уверенность -> тип бейджа для UI */
export function confidenceLevel(
  value: number,
): "high" | "medium" | "low" {
  if (value >= 0.8) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}

/** Русская подпись уверенности */
export function confidenceLabel(value: number): string {
  const level = confidenceLevel(value);
  switch (level) {
    case "high":
      return "Уверенно";
    case "medium":
      return "Примерно";
    case "low":
      return "Проверьте";
  }
}
