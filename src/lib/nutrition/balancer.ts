import { macrosForWeight, type MacroTargets, type Per100 } from "./macros";

export interface CandidateFood {
  id?: string;
  name: string;
  per100: Per100;
  category?: string;
  defaultServingGrams?: number;
}

export interface BalancedRecommendation {
  foodName: string;
  foodId?: string;
  servingGrams: number;
  calories: number;
  macros: MacroTargets;
  primaryNutrient: "protein" | "fat" | "carbs";
  nutrientGainGrams: number;
  reason: string;
}

export interface MacroBalanceStatus {
  primaryDeficit: "protein" | "fat" | "carbs" | "none";
  deficitGrams: number;
  remainingCalories: number;
  isBalanced: boolean;
  recommendations: BalancedRecommendation[];
}

/**
 * Базовый проверенный набор эталонных продуктов с высокой концентрацией конкретных нутриентов.
 * Используется алгоритмом для точного закрытия дефицита без лишних калорий.
 */
export const CORE_BALANCER_FOODS: CandidateFood[] = [
  // Высокобелковые с минимальным жиром и углеводами
  {
    name: "Творог 5%",
    per100: { calories: 121, protein: 17.0, fat: 5.0, carbs: 3.0 },
    category: "dairy",
    defaultServingGrams: 180,
  },
  {
    name: "Куриное филе (грудка)",
    per100: { calories: 113, protein: 23.6, fat: 1.9, carbs: 0.4 },
    category: "meat",
    defaultServingGrams: 150,
  },
  {
    name: "Тунец в собственном соку",
    per100: { calories: 101, protein: 23.0, fat: 1.0, carbs: 0 },
    category: "fish",
    defaultServingGrams: 130,
  },
  {
    name: "Греческий йогурт 2%",
    per100: { calories: 73, protein: 10.0, fat: 2.0, carbs: 3.8 },
    category: "dairy",
    defaultServingGrams: 150,
  },
  {
    name: "Яйцо куриное (вареное)",
    per100: { calories: 155, protein: 12.7, fat: 11.5, carbs: 0.7 },
    category: "eggs",
    defaultServingGrams: 110, // ~2 яйца
  },
  // Полезные жиры
  {
    name: "Авокадо",
    per100: { calories: 160, protein: 2.0, fat: 14.7, carbs: 1.8 },
    category: "fruits",
    defaultServingGrams: 80,
  },
  {
    name: "Миндаль",
    per100: { calories: 579, protein: 21.2, fat: 49.9, carbs: 9.1 },
    category: "nuts",
    defaultServingGrams: 30,
  },
  // Сложные углеводы
  {
    name: "Овсяная каша на воде",
    per100: { calories: 88, protein: 3.0, fat: 1.7, carbs: 15.0 },
    category: "grains",
    defaultServingGrams: 180,
  },
  {
    name: "Банан",
    per100: { calories: 89, protein: 1.5, fat: 0.2, carbs: 21.8 },
    category: "fruits",
    defaultServingGrams: 120,
  },
];

/**
 * Определяет приоритетный дефицит нутриента.
 */
export function identifyPrimaryDeficit(params: {
  targetMacros: MacroTargets;
  remainingMacros: MacroTargets;
}): { deficitType: "protein" | "fat" | "carbs" | "none"; deficitGrams: number } {
  const { targetMacros, remainingMacros } = params;

  // Рассчитываем процент нехватки относительно цели
  const proteinGapPct = targetMacros.proteinG > 0 ? remainingMacros.proteinG / targetMacros.proteinG : 0;
  const fatGapPct = targetMacros.fatG > 0 ? remainingMacros.fatG / targetMacros.fatG : 0;
  const carbsGapPct = targetMacros.carbsG > 0 ? remainingMacros.carbsG / targetMacros.carbsG : 0;

  // Белок всегда имеет наивысший приоритет в фитнес-диетах
  if (remainingMacros.proteinG >= 15 && proteinGapPct >= 0.25) {
    return { deficitType: "protein", deficitGrams: remainingMacros.proteinG };
  }

  // Если белок в норме, сравниваем жиры и углеводы
  if (fatGapPct > carbsGapPct && remainingMacros.fatG >= 10) {
    return { deficitType: "fat", deficitGrams: remainingMacros.fatG };
  }

  if (remainingMacros.carbsG >= 20) {
    return { deficitType: "carbs", deficitGrams: remainingMacros.carbsG };
  }

  if (remainingMacros.proteinG >= 8) {
    return { deficitType: "protein", deficitGrams: remainingMacros.proteinG };
  }

  return { deficitType: "none", deficitGrams: 0 };
}

/**
 * Подбирает порцию продукта, которая максимально закрывает дефицит
 * без превышения доступного бюджета калорий.
 */
export function calculateOptimalServing(params: {
  food: CandidateFood;
  deficitType: "protein" | "fat" | "carbs";
  deficitGrams: number;
  availableCalories: number;
}): BalancedRecommendation | null {
  const { food, deficitType, deficitGrams, availableCalories } = params;

  const nutrientPer100 =
    deficitType === "protein"
      ? food.per100.protein
      : deficitType === "fat"
      ? food.per100.fat
      : food.per100.carbs;

  if (nutrientPer100 <= 1) return null; // Продукт не является источником нутриента

  // Порция для 100% закрытия дефицита
  const exactGramsNeeded = (deficitGrams / nutrientPer100) * 100;

  // Ограничение по доступным калориям
  const maxGramsByCalories = (availableCalories / food.per100.calories) * 100;

  // Берём минимум: сколько нужно, но не больше, чем помещается в калораж
  let targetGrams = Math.min(exactGramsNeeded, maxGramsByCalories);

  // Кулинарные разумные рамки: минимум 30 г, максимум 350 г
  targetGrams = Math.min(targetGrams, 350);
  if (targetGrams < 25) return null;

  // Округляем до 5 грамм
  const servingGrams = Math.round(targetGrams / 5) * 5;
  const computed = macrosForWeight(food.per100, servingGrams);

  if (computed.calories > availableCalories + 15) return null; // Не превышать с запасом погрешности

  const nutrientGain =
    deficitType === "protein"
      ? computed.proteinG
      : deficitType === "fat"
      ? computed.fatG
      : computed.carbsG;

  const nutrientNameRu =
    deficitType === "protein" ? "белка" : deficitType === "fat" ? "полезных жиров" : "углеводов";

  return {
    foodName: food.name,
    foodId: food.id,
    servingGrams,
    calories: computed.calories,
    macros: {
      proteinG: computed.proteinG,
      fatG: computed.fatG,
      carbsG: computed.carbsG,
    },
    primaryNutrient: deficitType,
    nutrientGainGrams: nutrientGain,
    reason: `Порция ${servingGrams} г добавит +${Math.round(nutrientGain)} г ${nutrientNameRu} и идеально впишется в остаток ${availableCalories} ккал.`,
  };
}

/**
 * Главная функция Macro Balancer: определяет дефицит и генерирует оптимальные варианты из проверенной базы.
 */
export function balanceMacros(params: {
  targetCalories: number;
  remainingCalories: number;
  targetMacros: MacroTargets;
  remainingMacros: MacroTargets;
  customFoods?: CandidateFood[];
}): MacroBalanceStatus {
  const { remainingCalories, targetMacros, remainingMacros, customFoods = [] } = params;

  if (remainingCalories <= 40) {
    return {
      primaryDeficit: "none",
      deficitGrams: 0,
      remainingCalories,
      isBalanced: true,
      recommendations: [],
    };
  }

  const { deficitType, deficitGrams } = identifyPrimaryDeficit({
    targetMacros,
    remainingMacros,
  });

  if (deficitType === "none") {
    return {
      primaryDeficit: "none",
      deficitGrams: 0,
      remainingCalories,
      isBalanced: true,
      recommendations: [],
    };
  }

  // Объединяем эталонные продукты и пользовательские/внешние
  const pool = [...customFoods, ...CORE_BALANCER_FOODS];

  const recommendations: BalancedRecommendation[] = [];
  const seenNames = new Set<string>();

  for (const food of pool) {
    if (seenNames.has(food.name.toLowerCase())) continue;

    const recommendation = calculateOptimalServing({
      food,
      deficitType,
      deficitGrams,
      availableCalories: remainingCalories,
    });

    if (recommendation) {
      recommendations.push(recommendation);
      seenNames.add(food.name.toLowerCase());
    }

    if (recommendations.length >= 3) break;
  }

  // Сортировка по максимальной отдаче дефицитного нутриента на калорию (эффективность плотности)
  recommendations.sort(
    (a, b) => b.nutrientGainGrams / Math.max(1, b.calories) - a.nutrientGainGrams / Math.max(1, a.calories)
  );

  return {
    primaryDeficit: deficitType,
    deficitGrams,
    remainingCalories,
    isBalanced: recommendations.length === 0,
    recommendations,
  };
}
