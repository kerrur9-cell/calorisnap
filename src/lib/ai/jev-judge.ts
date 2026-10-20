import { z } from "zod";
import type { AiAnalysisResponse } from "./schema";

const jevAnswerSchema = z.object({
  answers: z.object({
    winner: z.object({
      type: z.literal("choice"),
      choice: z.string(),
      confidence: z.number().min(0).max(1),
      probabilities: z.record(z.string(), z.number().min(0).max(1)),
    }),
  }),
});

export interface CandidateAnalysis {
  provider: "gemini" | "openrouter" | "groq";
  data: AiAnalysisResponse;
}

function candidateSummary(c: CandidateAnalysis): string {
  if (!c.data.is_food) {
    return `[НЕ ЕДА] Причина: ${c.data.not_food_reason}. Ответ: ${c.data.funny_response || "Отказ"}`;
  }
  const itemsStr = c.data.items
    .map((it) => {
      const kcalTotal = Math.round((it.calories_per_100g * it.weight_grams) / 100);
      return `${it.name_local || it.name}: ${it.weight_grams}г (${it.calories_per_100g} ккал/100г, состояние: ${it.preparation_state || "готовое"}, всего: ${kcalTotal} ккал, Б:${it.protein_per_100g} Ж:${it.fat_per_100g} У:${it.carbs_per_100g})`;
    })
    .join("; ");
  const totalKcal = c.data.items.reduce(
    (sum, it) => sum + Math.round((it.calories_per_100g * it.weight_grams) / 100),
    0,
  );
  return `[ЕДА] Всего вес: ${c.data.total_weight_grams}г, калорий: ${totalKcal} ккал. Продукты: ${itemsStr}`;
}

/**
 * Арбитр JEV (TypeSafe AI) оценивает несколько вариантов анализа фото
 * и выбирает наиболее правдивый, физиологичный и кулинарно точный.
 */
export async function judgeAnalysesWithJev(
  candidates: CandidateAnalysis[],
): Promise<CandidateAnalysis> {
  if (candidates.length === 0) {
    throw new Error("Нет кандидатов для оценки");
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Если все кандидаты единогласно считают фото "не едой" — берём первый с лучшим юмором
  const nonFoodCount = candidates.filter((c) => !c.data.is_food).length;
  if (nonFoodCount === candidates.length) {
    return candidates[0];
  }

  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) {
    // Резервная эвристика без JEV: отсеиваем аномально завышенные калории круп (>300 ккал/100г для готовых)
    return selectBestHeuristic(candidates);
  }

  try {
    const criteria: Record<string, string> = {};
    candidates.forEach((c, idx) => {
      criteria[`candidate_${idx}`] = `Модель ${c.provider.toUpperCase()}: ${candidateSummary(c)}`;
    });

    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state: JSON.stringify({
          task: "Выбор наиболее точного, правдивого и кулинарно корректного анализа тарелки с едой",
          candidates_count: candidates.length,
        }),
        questions: {
          winner: {
            type: "choice",
            instructions:
              "Ты — главный кулинарный судья и нутрициолог JEV. Оцени представленные варианты анализа одного и того же блюда/фото от разных нейросетей. " +
              "Критерии истины: " +
              "1. Крупы, каши и макароны на тарелке ДОЛЖНЫ быть в варёном виде (~105-140 ккал/100г). Если модель применила калории сырой крупы (340+ ккал/100г) — штрафуй её! " +
              "2. Реалистичность порций (курица/мясо ~100-150г, гарнир ~150-200г, соленья ~20-50г). " +
              "3. Правильное разделение компонентов (не сваливать мясо и гарнир в одно блюдо, если они лежат отдельно). " +
              "4. Баланс БЖУ: калории примерно равны Б*4 + Ж*9 + У*4. " +
              "5. Если на фото точно не еда (человек, животное, гаджет) — правильным является отказ от подсчёта. " +
              "Выбери ключ самого правдивого кандидата.",
            criteria,
          },
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return selectBestHeuristic(candidates);
    }

    const json = await response.json();
    const parsed = jevAnswerSchema.safeParse(json);
    if (!parsed.success) {
      return selectBestHeuristic(candidates);
    }

    const choice = parsed.data.answers.winner.choice;
    const match = choice.match(/^candidate_(\d+)$/);
    if (match) {
      const selectedIndex = parseInt(match[1], 10);
      if (selectedIndex >= 0 && selectedIndex < candidates.length) {
        const winner = candidates[selectedIndex];
        const prob = parsed.data.answers.winner.probabilities[choice] ?? parsed.data.answers.winner.confidence;
        winner.data.warnings = [
          ...winner.data.warnings,
          `Одобрено арбитром JEV (уверенность консенсуса: ${Math.round(prob * 100)}%, источник: ${winner.provider})`,
        ];
        return winner;
      }
    }

    return selectBestHeuristic(candidates);
  } catch (err) {
    console.warn("JEV judge evaluation failed, falling back to heuristic:", err);
    return selectBestHeuristic(candidates);
  }
}

/**
 * Локальная эвристическая оценка на случай недоступности JEV:
 * наказывает за сухие калории круп на тарелке и премирует высокую согласованность.
 */
function selectBestHeuristic(candidates: CandidateAnalysis[]): CandidateAnalysis {
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const c of candidates) {
    if (!c.data.is_food) {
      // Если большинство за еду, не-еду штрафуем, и наоборот
      const nonFoodRatio = candidates.filter((x) => !x.data.is_food).length / candidates.length;
      const score = nonFoodRatio >= 0.5 ? 100 : -100;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
      continue;
    }

    let score = (c.data.overall_confidence || 0.5) * 50;

    for (const it of c.data.items) {
      const name = (it.name_local || it.name).toLowerCase();
      // Штраф за сухие крупы на тарелке (>250 ккал для гречки/риса/овсянки)
      if (/греч|рис|овсян|макарон|паст|каш/i.test(name)) {
        if (it.calories_per_100g > 250) {
          score -= 50;
        } else if (it.calories_per_100g >= 100 && it.calories_per_100g <= 160) {
          score += 30; // Премия за реалистичные готовые крупы
        }
      }
      // Премия за адекватный вес порции (10-800 г)
      if (it.weight_grams >= 10 && it.weight_grams <= 800) {
        score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}
