import type { MealType } from "@/types/database";

export interface MealHistoryItem {
  id?: string;
  custom_food_name: string | null;
  food_item_id?: string | null;
  weight_grams: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface MealHistoryEntry {
  id?: string;
  meal_type: MealType;
  entry_date: string;
  logged_at?: string;
  meal_items: MealHistoryItem[];
}

export interface FrequentFood {
  foodName: string;
  frequency: number;
  avgPortionGrams: number;
  avgCalories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  typicalMealTypes: MealType[];
}

export interface CompanionSuggestion {
  foodName: string;
  baseFood: string;
  coOccurrenceCount: number;
  avgPortionGrams: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface TriggerPattern {
  foodName: string;
  surplusOccurrences: number;
  totalOccurrences: number;
  surplusRate: number; // e.g. 0.75 = 75% of days with this food exceeded calorie goal
  avgSurplusCalories: number;
  reason: string;
}

export interface FoodGraphAnalysis {
  frequentFoods: FrequentFood[];
  companionsByFood: Record<string, CompanionSuggestion[]>;
  triggers: TriggerPattern[];
}

function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Анализирует историю приёмов пищи и строит персональный продуктовый граф.
 */
export function analyzePersonalFoodGraph(
  meals: MealHistoryEntry[],
  dailyTotalsMap?: Map<string, { totalCalories: number; targetCalories: number }>
): FoodGraphAnalysis {
  const foodStats = new Map<
    string,
    {
      originalName: string;
      frequency: number;
      totalGrams: number;
      totalCalories: number;
      totalProtein: number;
      totalFat: number;
      totalCarbs: number;
      mealTypes: Map<MealType, number>;
      datesWithFood: Set<string>;
    }
  >();

  // Подсчёт частоты продуктов и макросов
  for (const meal of meals) {
    for (const item of meal.meal_items) {
      if (!item.custom_food_name) continue;
      const normalized = normalizeFoodName(item.custom_food_name);
      if (!normalized) continue;

      let stat = foodStats.get(normalized);
      if (!stat) {
        stat = {
          originalName: item.custom_food_name.trim(),
          frequency: 0,
          totalGrams: 0,
          totalCalories: 0,
          totalProtein: 0,
          totalFat: 0,
          totalCarbs: 0,
          mealTypes: new Map(),
          datesWithFood: new Set(),
        };
        foodStats.set(normalized, stat);
      }

      stat.frequency += 1;
      stat.totalGrams += Math.max(1, item.weight_grams);
      stat.totalCalories += item.calories;
      stat.totalProtein += item.protein_g;
      stat.totalFat += item.fat_g;
      stat.totalCarbs += item.carbs_g;
      stat.datesWithFood.add(meal.entry_date);

      const typeCount = stat.mealTypes.get(meal.meal_type) ?? 0;
      stat.mealTypes.set(meal.meal_type, typeCount + 1);
    }
  }

  // Построение FrequentFoods
  const frequentFoods: FrequentFood[] = Array.from(foodStats.entries())
    .map(([, stat]) => {
      const avgPortion = Math.round(stat.totalGrams / stat.frequency);
      const avgCalories = Math.round(stat.totalCalories / stat.frequency);
      const avgP = Number((stat.totalProtein / stat.frequency).toFixed(1));
      const avgF = Number((stat.totalFat / stat.frequency).toFixed(1));
      const avgC = Number((stat.totalCarbs / stat.frequency).toFixed(1));

      const per100Factor = avgPortion > 0 ? 100 / avgPortion : 1;

      // Сортировка типичных типов приёмов пищи по частоте
      const typicalMealTypes = Array.from(stat.mealTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([mt]) => mt);

      return {
        foodName: stat.originalName,
        frequency: stat.frequency,
        avgPortionGrams: avgPortion,
        avgCalories,
        protein_g: avgP,
        fat_g: avgF,
        carbs_g: avgC,
        calories_per_100g: Math.round(avgCalories * per100Factor),
        protein_per_100g: Number((avgP * per100Factor).toFixed(1)),
        fat_per_100g: Number((avgF * per100Factor).toFixed(1)),
        carbs_per_100g: Number((avgC * per100Factor).toFixed(1)),
        typicalMealTypes,
      };
    })
    .sort((a, b) => b.frequency - a.frequency);

  // Анализ парных продуктов (сочетаний в одном приёме пищи)
  const coOccurrences = new Map<string, Map<string, number>>();

  for (const meal of meals) {
    const uniqueItemsInMeal = Array.from(
      new Set(
        meal.meal_items
          .map((it) => (it.custom_food_name ? normalizeFoodName(it.custom_food_name) : ""))
          .filter(Boolean)
      )
    );

    for (let i = 0; i < uniqueItemsInMeal.length; i++) {
      const foodA = uniqueItemsInMeal[i];
      if (!coOccurrences.has(foodA)) coOccurrences.set(foodA, new Map());
      const pairMap = coOccurrences.get(foodA)!;

      for (let j = 0; j < uniqueItemsInMeal.length; j++) {
        if (i === j) continue;
        const foodB = uniqueItemsInMeal[j];
        pairMap.set(foodB, (pairMap.get(foodB) ?? 0) + 1);
      }
    }
  }

  const companionsByFood: Record<string, CompanionSuggestion[]> = {};

  for (const [foodAKey, pairMap] of coOccurrences.entries()) {
    const statA = foodStats.get(foodAKey);
    if (!statA) continue;

    const companions: CompanionSuggestion[] = [];
    for (const [foodBKey, count] of pairMap.entries()) {
      if (count < 2 && meals.length > 5) continue; // отсеиваем случайные единичные совпадения при достаточной истории
      const statB = foodStats.get(foodBKey);
      if (!statB) continue;

      const avgPortion = Math.round(statB.totalGrams / statB.frequency);
      const avgKcal = Math.round(statB.totalCalories / statB.frequency);
      const avgP = Number((statB.totalProtein / statB.frequency).toFixed(1));
      const avgF = Number((statB.totalFat / statB.frequency).toFixed(1));
      const avgC = Number((statB.totalCarbs / statB.frequency).toFixed(1));

      companions.push({
        foodName: statB.originalName,
        baseFood: statA.originalName,
        coOccurrenceCount: count,
        avgPortionGrams: avgPortion,
        calories: avgKcal,
        protein_g: avgP,
        fat_g: avgF,
        carbs_g: avgC,
      });
    }

    companions.sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);
    if (companions.length > 0) {
      companionsByFood[foodAKey] = companions;
    }
  }

  // Анализ триггерных продуктов (часто присутствуют в дни профицита калорий > 15%)
  const triggers: TriggerPattern[] = [];
  if (dailyTotalsMap && dailyTotalsMap.size > 0) {
    for (const [, stat] of foodStats.entries()) {
      if (stat.datesWithFood.size < 3) continue; // требуем минимум 3 дня употребления для паттерна

      let surplusDaysCount = 0;
      let totalSurplusDiff = 0;

      for (const date of stat.datesWithFood) {
        const dayInfo = dailyTotalsMap.get(date);
        if (!dayInfo) continue;
        const diff = dayInfo.totalCalories - dayInfo.targetCalories;
        // Профицит > 15% от цели или > 300 ккал
        if (diff > Math.max(300, dayInfo.targetCalories * 0.15)) {
          surplusDaysCount += 1;
          totalSurplusDiff += diff;
        }
      }

      const surplusRate = surplusDaysCount / stat.datesWithFood.size;
      // Если в 65%+ дней с этим продуктом был перебор калорий
      if (surplusRate >= 0.65 && surplusDaysCount >= 2) {
        triggers.push({
          foodName: stat.originalName,
          surplusOccurrences: surplusDaysCount,
          totalOccurrences: stat.datesWithFood.size,
          surplusRate: Number(surplusRate.toFixed(2)),
          avgSurplusCalories: Math.round(totalSurplusDiff / surplusDaysCount),
          reason: `В ${Math.round(surplusRate * 100)}% дней с этим продуктом калорийность превышала цель в среднем на +${Math.round(totalSurplusDiff / surplusDaysCount)} ккал`,
        });
      }
    }
    triggers.sort((a, b) => b.surplusRate - a.surplusRate);
  }

  return {
    frequentFoods,
    companionsByFood,
    triggers,
  };
}

/**
 * Получить контекстные быстрые подсказки при открытии добавления еды:
 * - если уже есть выбранные продукты: ищет их любимых спутников (companions);
 * - если список пуст: возвращает любимые продукты для конкретного приёма пищи (breakfast/lunch/etc).
 */
export function getSmartFoodSuggestions(
  graph: FoodGraphAnalysis,
  mealType: MealType,
  currentFoodNames: string[] = [],
  limit = 6
): FrequentFood[] {
  const normalizedCurrent = new Set(currentFoodNames.map(normalizeFoodName));

  // 1. Если уже добавлены продукты, ищем спутников для каждого
  const suggestedFromCompanions: FrequentFood[] = [];
  for (const foodName of currentFoodNames) {
    const key = normalizeFoodName(foodName);
    const companions = graph.companionsByFood[key];
    if (companions) {
      for (const comp of companions) {
        const compKey = normalizeFoodName(comp.foodName);
        if (normalizedCurrent.has(compKey)) continue;

        const freqMatch = graph.frequentFoods.find(
          (f) => normalizeFoodName(f.foodName) === compKey
        );
        if (freqMatch && !suggestedFromCompanions.some((s) => normalizeFoodName(s.foodName) === compKey)) {
          suggestedFromCompanions.push(freqMatch);
        }
      }
    }
  }

  if (suggestedFromCompanions.length >= limit) {
    return suggestedFromCompanions.slice(0, limit);
  }

  // 2. Дополняем популярными продуктами для конкретного приёма пищи
  const mealTypeFoods = graph.frequentFoods.filter(
    (f) =>
      f.typicalMealTypes.includes(mealType) &&
      !normalizedCurrent.has(normalizeFoodName(f.foodName)) &&
      !suggestedFromCompanions.some((s) => normalizeFoodName(s.foodName) === normalizeFoodName(f.foodName))
  );

  const combined = [...suggestedFromCompanions, ...mealTypeFoods];

  // 3. Если всё ещё мало, добираем самыми частыми продуктами вообще
  if (combined.length < limit) {
    for (const f of graph.frequentFoods) {
      if (
        !normalizedCurrent.has(normalizeFoodName(f.foodName)) &&
        !combined.some((s) => normalizeFoodName(s.foodName) === normalizeFoodName(f.foodName))
      ) {
        combined.push(f);
        if (combined.length >= limit) break;
      }
    }
  }

  return combined.slice(0, limit);
}
