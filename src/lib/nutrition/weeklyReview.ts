import type { MealHistoryEntry } from "./personalization";

export interface DayStatItem {
  entry_date: string;
  total_calories: number;
  total_protein?: number;
  total_fat?: number;
  total_carbs?: number;
}

export interface DayOfWeekStat {
  dayName: string;
  dayIndex: number; // 0 = Sun, 1 = Mon, ...
  avgCalories: number;
  count: number;
}

export interface MealHighlight {
  title: string;
  calories: number;
  proteinG: number;
  date: string;
  mealType: string;
}

export interface WeeklyReviewData {
  daysLogged: number;
  avgCalories: number;
  targetCalories: number;
  calorieDifference: number;
  adherencePercent: number;
  avgProteinG: number;
  targetProteinG: number;
  proteinAdherencePercent: number;
  weekendVsWeekdayDeltaKcal: number;
  topCalorieMeals: MealHighlight[];
  topProteinMeals: MealHighlight[];
  daysOfWeek: DayOfWeekStat[];
  qualityRating: "excellent" | "good" | "needs_attention";
  instantSummary: string;
}

const RUSSIAN_DAY_NAMES = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export function computeWeeklyReview(
  dailyStats: DayStatItem[],
  meals: MealHistoryEntry[],
  targetCalories: number,
  targetProteinG: number
): WeeklyReviewData {
  const loggedDays = dailyStats.filter((d) => d.total_calories > 0);
  const daysLogged = loggedDays.length;

  if (daysLogged === 0) {
    return {
      daysLogged: 0,
      avgCalories: 0,
      targetCalories,
      calorieDifference: 0,
      adherencePercent: 0,
      avgProteinG: 0,
      targetProteinG,
      proteinAdherencePercent: 0,
      weekendVsWeekdayDeltaKcal: 0,
      topCalorieMeals: [],
      topProteinMeals: [],
      daysOfWeek: [],
      qualityRating: "needs_attention",
      instantSummary: "Нет данных за выбранный период для анализа недели.",
    };
  }

  const totalCalories = loggedDays.reduce((acc, d) => acc + d.total_calories, 0);
  const avgCalories = Math.round(totalCalories / daysLogged);
  const calorieDifference = avgCalories - targetCalories;

  // Дни попадания в целевой коридор (+/- 10%)
  const onTargetDays = loggedDays.filter(
    (d) => Math.abs(d.total_calories - targetCalories) <= targetCalories * 0.1
  ).length;
  const adherencePercent = Math.round((onTargetDays / daysLogged) * 100);

  const totalProtein = loggedDays.reduce((acc, d) => acc + (d.total_protein ?? 0), 0);
  const avgProteinG = Math.round(totalProtein / daysLogged);
  const proteinAdherencePercent = Math.min(
    150,
    Math.round((avgProteinG / Math.max(1, targetProteinG)) * 100)
  );

  // Анализ паттерна будни vs выходные
  const weekdayCalories: number[] = [];
  const weekendCalories: number[] = [];
  const dayBuckets: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({
    sum: 0,
    count: 0,
  }));

  for (const d of loggedDays) {
    const dateObj = new Date(d.entry_date + "T12:00:00");
    const dayIdx = dateObj.getDay();
    dayBuckets[dayIdx].sum += d.total_calories;
    dayBuckets[dayIdx].count += 1;

    if (dayIdx === 0 || dayIdx === 6) {
      weekendCalories.push(d.total_calories);
    } else {
      weekdayCalories.push(d.total_calories);
    }
  }

  const avgWeekday =
    weekdayCalories.length > 0
      ? weekdayCalories.reduce((a, b) => a + b, 0) / weekdayCalories.length
      : avgCalories;
  const avgWeekend =
    weekendCalories.length > 0
      ? weekendCalories.reduce((a, b) => a + b, 0) / weekendCalories.length
      : avgCalories;
  const weekendVsWeekdayDeltaKcal = Math.round(avgWeekend - avgWeekday);

  const daysOfWeek: DayOfWeekStat[] = dayBuckets.map((b, idx) => ({
    dayName: RUSSIAN_DAY_NAMES[idx],
    dayIndex: idx,
    avgCalories: b.count > 0 ? Math.round(b.sum / b.count) : 0,
    count: b.count,
  }));

  // Топ приёмов пищи
  const mealHighlights: MealHighlight[] = [];
  for (const m of meals) {
    const mealKcal = m.meal_items.reduce((acc, i) => acc + i.calories, 0);
    const mealProtein = m.meal_items.reduce((acc, i) => acc + i.protein_g, 0);
    const title = m.meal_items.map((i) => i.custom_food_name).filter(Boolean).join(", ") || "Приём пищи";

    mealHighlights.push({
      title,
      calories: Math.round(mealKcal),
      proteinG: Math.round(mealProtein),
      date: m.entry_date,
      mealType: m.meal_type,
    });
  }

  const topCalorieMeals = [...mealHighlights]
    .sort((a, b) => b.calories - a.calories)
    .slice(0, 3);
  const topProteinMeals = [...mealHighlights]
    .sort((a, b) => b.proteinG - a.proteinG)
    .slice(0, 3);

  // Оценка качества
  let qualityRating: "excellent" | "good" | "needs_attention" = "good";
  if (adherencePercent >= 70 && proteinAdherencePercent >= 85) {
    qualityRating = "excellent";
  } else if (adherencePercent < 40 || proteinAdherencePercent < 60) {
    qualityRating = "needs_attention";
  }

  // Генерация детерминированного резюме
  const summaryParts: string[] = [];
  summaryParts.push(
    `За неделю заполнено ${daysLogged} дней. Средняя калорийность: ${avgCalories} ккал (цель: ${targetCalories} ккал).`
  );

  if (proteinAdherencePercent >= 85) {
    summaryParts.push(`Отличный средний белок: ${avgProteinG} г (${proteinAdherencePercent}% от нормы).`);
  } else {
    summaryParts.push(
      `По белку среднее составило ${avgProteinG} г из ${targetProteinG} г. Рекомендуется подтянуть источники белка.`
    );
  }

  if (weekendVsWeekdayDeltaKcal > 300) {
    summaryParts.push(
      `Заметен паттерн выходных: в субботу и воскресенье калорийность в среднем выше на +${weekendVsWeekdayDeltaKcal} ккал, чем в будни.`
    );
  }

  return {
    daysLogged,
    avgCalories,
    targetCalories,
    calorieDifference,
    adherencePercent,
    avgProteinG,
    targetProteinG,
    proteinAdherencePercent,
    weekendVsWeekdayDeltaKcal,
    topCalorieMeals,
    topProteinMeals,
    daysOfWeek,
    qualityRating,
    instantSummary: summaryParts.join(" "),
  };
}
