import type { DayTotals, MacroTargets } from "./macros";

export type BriefingType = "morning" | "evening";

export interface YesterdayStats {
  totalCalories: number;
  targetCalories: number;
  totalProtein: number;
  targetProtein: number;
}

export interface DailyBriefingInput {
  timeOfDay?: BriefingType;
  currentTimeHour?: number; // 0..23
  todayConsumed: DayTotals;
  calorieGoal: number;
  macroTargets: MacroTargets;
  yesterdayStats?: YesterdayStats | null;
  userName?: string | null;
}

export interface DailyBriefingResult {
  type: BriefingType;
  title: string;
  greeting: string;
  headline: string;
  keyPoints: string[];
  recommendedFocus: string;
  remainingCalories: number;
  proteinProgressPercent: number;
  calorieProgressPercent: number;
}

export function determineBriefingType(hour = new Date().getHours()): BriefingType {
  return hour < 15 ? "morning" : "evening";
}

/**
 * Генерирует детерминированный, точный и поддерживающий утренний или вечерний брифинг.
 */
export function generateDailyBriefing({
  timeOfDay,
  currentTimeHour,
  todayConsumed,
  calorieGoal,
  macroTargets,
  yesterdayStats,
  userName,
}: DailyBriefingInput): DailyBriefingResult {
  const type = timeOfDay ?? determineBriefingType(currentTimeHour);
  const remainingCalories = Math.round(calorieGoal - todayConsumed.calories);
  const caloriePercent = Math.min(150, Math.round((todayConsumed.calories / Math.max(1, calorieGoal)) * 100));
  const proteinPercent = Math.min(150, Math.round((todayConsumed.proteinG / Math.max(1, macroTargets.proteinG)) * 100));

  const namePrefix = userName ? `${userName}, ` : "";

  if (type === "morning") {
    const headline = `Доброе утро! План на сегодня: ${calorieGoal} ккал.`;
    const keyPoints: string[] = [];

    if (yesterdayStats) {
      const yesterdayDiff = yesterdayStats.totalCalories - yesterdayStats.targetCalories;
      if (Math.abs(yesterdayDiff) <= 100) {
        keyPoints.push("Вчера вы идеально попали в норму калорий — отличная стабильность!");
      } else if (yesterdayDiff > 100) {
        keyPoints.push(
          `Вчера был небольшой профицит (+${Math.round(yesterdayDiff)} ккал). Сегодня не нужно голодать, просто держите целевые ${calorieGoal} ккал.`
        );
      } else {
        keyPoints.push(
          `Вчера был дефицит (${Math.round(Math.abs(yesterdayDiff))} ккал ниже цели). Сегодня начните день с плотного завтрака.`
        );
      }

      const yesterdayProteinShortfall = yesterdayStats.targetProtein - yesterdayStats.totalProtein;
      if (yesterdayProteinShortfall > 15) {
        keyPoints.push(
          `Вчера не хватило ${Math.round(yesterdayProteinShortfall)} г белка. Сегодня имеет смысл добавить источник белка уже в первый приём пищи.`
        );
      }
    } else {
      keyPoints.push(`Ваш суточный ориентир: ${calorieGoal} ккал (Б: ${macroTargets.proteinG}г, Ж: ${macroTargets.fatG}г, У: ${macroTargets.carbsG}г).`);
    }

    const recommendedFocus =
      proteinPercent < 20
        ? `Фокус утра: плотный завтрак с белком от 25-30 г (яйца, творог или каша с протеином).`
        : `Отличное начало дня! Продолжайте следовать плану.`;

    return {
      type: "morning",
      title: "Утренний план",
      greeting: `${namePrefix}доброе утро!`,
      headline,
      keyPoints,
      recommendedFocus,
      remainingCalories,
      proteinProgressPercent: proteinPercent,
      calorieProgressPercent: caloriePercent,
    };
  }

  // Вечерний брифинг (после 15:00)
  let headline = "";
  const keyPoints: string[] = [];

  if (todayConsumed.calories === 0) {
    headline = "День подходит к вечеру, но записи ещё не внесены.";
    keyPoints.push("Не забудьте отметить приёмы пищи, чтобы видеть свой реальный прогресс.");
  } else if (remainingCalories > 150) {
    headline = `Осталось ${remainingCalories} ккал на остаток дня.`;
    keyPoints.push(`Вы набрали ${Math.round(todayConsumed.calories)} из ${calorieGoal} ккал (${caloriePercent}%).`);
    
    const remainingProtein = Math.round(macroTargets.proteinG - todayConsumed.proteinG);
    if (remainingProtein > 10) {
      keyPoints.push(`Для идеального баланса не хватает ${remainingProtein} г белка на ужин.`);
    } else {
      keyPoints.push(`Норма белка практически закрыта (${Math.round(todayConsumed.proteinG)} г из ${macroTargets.proteinG} г)!`);
    }
  } else if (remainingCalories >= -100 && remainingCalories <= 150) {
    headline = `Отличное попадание в калорийность: ${Math.round(todayConsumed.calories)} ккал!`;
    keyPoints.push("Вы точно удерживаете баланс энергии сегодня без переедания.");
    if (proteinPercent >= 85) {
      keyPoints.push(`Отличный результат по белку: ${Math.round(todayConsumed.proteinG)} г (${proteinPercent}% от цели).`);
    }
  } else {
    // Небольшое превышение
    const surplus = Math.abs(remainingCalories);
    headline = `Калорийность дня: ${Math.round(todayConsumed.calories)} ккал (+${surplus} ккал к цели).`;
    keyPoints.push("Один день с профицитом — это абсолютно нормально и не ломает недельный прогресс.");
    keyPoints.push("Отдохните и восстановитесь к завтрашнему дню.");
  }

  const remainingProtein = Math.max(0, Math.round(macroTargets.proteinG - todayConsumed.proteinG));
  let recommendedFocus: string;

  if (todayConsumed.calories === 0) {
    recommendedFocus = `Запланируйте сбалансированный приём пищи на 400–600 ккал с упором на белок (цель дня: ${macroTargets.proteinG} г).`;
  } else if (remainingCalories > 600) {
    const dishCalories = Math.min(500, Math.max(350, Math.round(remainingCalories * 0.4)));
    recommendedFocus = remainingProtein > 15
      ? `Остаток бюджета дня: ${remainingCalories} ккал. Для закрытия нормы белка (осталось ${remainingProtein} г) отлично подойдёт порция белкового блюда на ~${dishCalories} ккал (например, запечённая рыба, птица или творог).`
      : `Остаток бюджета дня: ${remainingCalories} ккал. Распределите его на комфортный ужин (~400–500 ккал) и вечерний перекус.`;
  } else if (remainingCalories > 200) {
    recommendedFocus = remainingProtein > 15
      ? `На остаток дня (${remainingCalories} ккал): лёгкий белковый ужин на ~${remainingCalories} ккал (творог, омлет или морепродукты для добора ${remainingProtein} г белка).`
      : `На остаток дня (${remainingCalories} ккал): лёгкое блюдо или перекус, чтобы комфортно уложиться в дневной бюджет.`;
  } else if (remainingCalories > 0) {
    recommendedFocus = `Бюджет почти закрыт (осталось ${remainingCalories} ккал): лёгкий перекус или травяной чай перед сном.`;
  } else {
    recommendedFocus = `Цели по калориям на сегодня выполнены, вечерний отдых и восстановление!`;
  }

  return {
    type: "evening",
    title: "Итоги дня",
    greeting: `${namePrefix}добрый вечер!`,
    headline,
    keyPoints,
    recommendedFocus,
    remainingCalories,
    proteinProgressPercent: proteinPercent,
    calorieProgressPercent: caloriePercent,
  };
}
