import { z } from "zod";
import type { DayTotals, MacroTargets } from "./macros";

export type AdviceMode = "normal" | "goal_reached" | "over_limit";

export type AdviceDecision = {
  mode: AdviceMode;
  caloriesRemaining: number;
  macrosRemaining: MacroTargets;
};

export type AdvicePreference = "ready_to_eat" | "low_effort" | "standard";

/** Turns common short requests into an unambiguous instruction for the model. */
export function detectAdvicePreference(message: string): AdvicePreference {
  const text = message.toLocaleLowerCase("ru-RU");
  if (/(без\s+готовк|не\s*хоч[уюе].{0,18}готов|готов.{0,18}не\s*хоч|нич[её]го?\s+готов|ленив.{0,24}без)/u.test(text)) return "ready_to_eat";
  if (/(ленив|быстр|минимум\s+готовк|прост.{0,18}приготов)/u.test(text)) return "low_effort";
  return "standard";
}

export function decideAdvice(
  targetCalories: number,
  macroTargets: MacroTargets,
  consumed: DayTotals,
): AdviceDecision {
  const caloriesRemaining = Math.round(targetCalories - consumed.calories);
  const macrosRemaining = {
    proteinG: Math.max(0, Math.round(macroTargets.proteinG - consumed.proteinG)),
    fatG: Math.max(0, Math.round(macroTargets.fatG - consumed.fatG)),
    carbsG: Math.max(0, Math.round(macroTargets.carbsG - consumed.carbsG)),
  };
  return {
    mode: caloriesRemaining < 0 ? "over_limit" : caloriesRemaining === 0 ? "goal_reached" : "normal",
    caloriesRemaining,
    macrosRemaining,
  };
}

const recommendationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  portion: z.string().trim().min(1).max(100),
  calories: z.number().finite().nonnegative().max(5000),
  protein: z.number().finite().nonnegative().max(500),
  fat: z.number().finite().nonnegative().max(500),
  carbs: z.number().finite().nonnegative().max(500),
  reason: z.string().trim().min(1).max(280),
});

export const adviceResponseSchema = z.object({
  mode: z.enum(["normal", "goal_reached", "over_limit"]),
  message: z.string().trim().min(1).max(500),
  highlights: z.array(z.string().trim().min(1).max(140)).max(3).default([]),
  recommendations: z.array(recommendationSchema).max(3).default([]),
});

export type AdviceResponse = z.infer<typeof adviceResponseSchema>;

/** Model output is never allowed to override calorie rules or show invalid food. */
export function validateAdvice(raw: unknown, decision: AdviceDecision, excludedNames: string[] = []): AdviceResponse | null {
  const parsed = adviceResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const response = parsed.data;
  if (decision.mode !== "normal") {
    return { ...response, mode: decision.mode, recommendations: [] };
  }
  const names = new Set<string>();
  const excluded = new Set(excludedNames.map((name) => name.toLocaleLowerCase("ru-RU").trim()));
  const recommendations = response.recommendations.filter((item) => {
    const name = item.name.toLocaleLowerCase("ru-RU").trim();
    if (names.has(name) || excluded.has(name) || item.calories > decision.caloriesRemaining) return false;
    names.add(name);
    return true;
  });
  return { ...response, mode: "normal", recommendations };
}
