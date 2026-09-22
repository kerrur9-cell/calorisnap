import type { DayTotals, MacroTargets } from "../nutrition/macros";
import { decideAdvice } from "../nutrition/advice";

export type VoiceIntentType =
  | "TOTAL_CALORIES"
  | "REMAINING_CALORIES"
  | "REMAINING_PROTEIN"
  | "EATEN_FOODS"
  | "SUGGEST_FOOD"
  | "LOG_FOOD"
  | "UNKNOWN";

export interface VoiceQueryResult {
  type: VoiceIntentType;
  answerText: string;
  actionType?: "open_balancer" | "open_camera" | "open_foods" | "none";
}

/**
 * Классификация намерения голосового запроса.
 * Быстрое сопоставление по регулярным выражениям без затрат на LLM.
 */
export function classifyVoiceIntent(transcript: string): VoiceIntentType {
  const text = transcript.toLocaleLowerCase("ru-RU").trim();

  // 1. Вопросы об остатке белка
  if (/(белк.*остал|сколько.*белк.*(остал|нужно|надо)|дефицит.*белк)/iu.test(text)) {
    return "REMAINING_PROTEIN";
  }

  // 2. Вопросы об остатке калорий
  if (/(калори.*остал|сколько.*(мне|ещ[её]).*остал|остаток.*калори)/iu.test(text)) {
    return "REMAINING_CALORIES";
  }

  // 3. Вопросы о том, сколько съедено
  if (/(сколько.*(съел|сожрал|наел|потребил|скушал)|(съел|сожрал|наел|потребил|скушал).*сколько|сколько.*сегодня|калори.*сегодня|итог.*сегодня)/iu.test(text)) {
    return "TOTAL_CALORIES";
  }

  // 4. Вопросы о том, что именно съедено
  if (/(что.*(я|мы)?.*(ел|съел|скушал).*сегодня|список.*(блюд|еды)|что.*было.*сегодня)/iu.test(text)) {
    return "EATEN_FOODS";
  }

  // 5. Вопросы «что мне поесть / что можно съесть»
  if (/(что.*(мне|я)?.*(поесть|съесть|приготовить|скушать)|посоветуй.*еду|варианты.*перекус)/iu.test(text)) {
    return "SUGGEST_FOOD";
  }

  // 6. Логгирование еды
  if (/(я.*(съел|выпил|поел|скушал)|запиши|добавь|на.*(завтрак|обед|ужин|перекус)|грамм)/iu.test(text)) {
    return "LOG_FOOD";
  }

  // Если в тексте перечисляются продукты ("яйцо, кофе, хлеб"), считаем это логгированием
  if (/(яйц|кофе|хлеб|яблок|каш|куриц|творог|чай|сыр|мясо|рыб|суп|салат|рис|гречк)/iu.test(text)) {
    return "LOG_FOOD";
  }

  return "UNKNOWN";
}

/**
 * Мгновенный детерминированный ответ на числовые вопросы по дневнику
 * строго из текущего состояния приложения (0 токенов, 0 мс задержки).
 */
export function answerVoiceQuery(params: {
  intent: VoiceIntentType;
  consumed: DayTotals;
  targetCalories: number;
  targetMacros: MacroTargets;
  eatenFoodNames: string[];
}): VoiceQueryResult {
  const { intent, consumed, targetCalories, targetMacros, eatenFoodNames } = params;

  const decision = decideAdvice(targetCalories, targetMacros, consumed);

  switch (intent) {
    case "TOTAL_CALORIES": {
      const cals = Math.round(consumed.calories);
      const p = Math.round(consumed.proteinG);
      const f = Math.round(consumed.fatG);
      const c = Math.round(consumed.carbsG);
      return {
        type: "TOTAL_CALORIES",
        answerText: `Сегодня вы съели ${cals} ккал: ${p} г белка, ${f} г жиров и ${c} г углеводов.`,
      };
    }

    case "REMAINING_CALORIES": {
      if (decision.caloriesRemaining <= 0) {
        return {
          type: "REMAINING_CALORIES",
          answerText: `Вы полностью закрыли дневную норму. Перебор составляет ${Math.abs(decision.caloriesRemaining)} ккал.`,
        };
      }
      return {
        type: "REMAINING_CALORIES",
        answerText: `До вашей цели осталось ${decision.caloriesRemaining} ккал.`,
      };
    }

    case "REMAINING_PROTEIN": {
      const p = decision.macrosRemaining.proteinG;
      if (p <= 0) {
        return {
          type: "REMAINING_PROTEIN",
          answerText: "Вы уже выполнили дневную норму белка! Отличная работа.",
        };
      }
      return {
        type: "REMAINING_PROTEIN",
        answerText: `Вам осталось добрать ${p} грамм белка.`,
        actionType: "open_balancer",
      };
    }

    case "EATEN_FOODS": {
      if (eatenFoodNames.length === 0) {
        return {
          type: "EATEN_FOODS",
          answerText: "Сегодня вы пока ничего не записали в дневник.",
        };
      }
      const list = eatenFoodNames.slice(0, 7).join(", ");
      const more = eatenFoodNames.length > 7 ? ` и ещё ${eatenFoodNames.length - 7} позиций` : "";
      return {
        type: "EATEN_FOODS",
        answerText: `Сегодня записано: ${list}${more}.`,
      };
    }

    case "SUGGEST_FOOD": {
      if (decision.caloriesRemaining <= 50) {
        return {
          type: "SUGGEST_FOOD",
          answerText: "Вы уже набрали норму калорий на сегодня. Рекомендуется пить воду или травяной чай.",
        };
      }
      return {
        type: "SUGGEST_FOOD",
        answerText: `У вас в запасе ${decision.caloriesRemaining} ккал. Открываю балансировщик с идеальными вариантами перекуса.`,
        actionType: "open_balancer",
      };
    }

    default:
      return {
        type: "UNKNOWN",
        answerText: "Не удалось распознать команду. Вы можете спросить «Сколько осталось калорий?» или сказать «Я съел два яйца и тост».",
      };
  }
}
