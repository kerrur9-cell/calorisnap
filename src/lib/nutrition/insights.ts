import { calculateEma } from "./forecast";

export interface WeightRecord {
  date: string;
  weightKg: number;
}

export interface DayCalorieRecord {
  date: string;
  consumedCalories: number;
  targetCalories: number;
  carbsG?: number;
}

export interface WaterRetentionResult {
  detected: boolean;
  weightDeltaKg: number;
  message?: string;
  recommendation?: string;
}

export interface PlateauResult {
  detected: boolean;
  daysStalled: number;
  averageDeficitKcal: number;
  message?: string;
  actionRecommendation?: "refeed" | "recalculate_tdee" | "none";
}

export interface RealFatLossResult {
  estimatedFatLossKg: number;
  scaleWeightChangeKg: number;
  waterOrMuscleMaskingKg: number;
  cumulativeDeficitKcal: number;
  message: string;
}

export interface SmartProgressInsights {
  waterRetention: WaterRetentionResult;
  plateau: PlateauResult;
  realFatLoss: RealFatLossResult | null;
}

/**
 * Анализирует внезапные скачки веса на фоне углеводов/соли (задержка воды, а не жир).
 */
export function analyzeWaterRetention(
  weights: WeightRecord[],
  nutritionHistory: DayCalorieRecord[]
): WaterRetentionResult {
  if (weights.length < 2) {
    return { detected: false, weightDeltaKg: 0 };
  }

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sortedWeights[sortedWeights.length - 1];
  const previous = sortedWeights[sortedWeights.length - 2];

  const weightDelta = Number((latest.weightKg - previous.weightKg).toFixed(2));

  // Скачок веса на 0.6 кг и более за 1-2 дня
  if (weightDelta >= 0.6) {
    const nutritionMap = new Map(nutritionHistory.map((n) => [n.date, n]));
    const recentNutrition = nutritionMap.get(previous.date) || nutritionMap.get(latest.date);

    const hasHighCarbsOrCal = recentNutrition
      ? (recentNutrition.carbsG && recentNutrition.carbsG >= 220) ||
        recentNutrition.consumedCalories >= recentNutrition.targetCalories + 250
      : true;

    if (hasHighCarbsOrCal) {
      return {
        detected: true,
        weightDeltaKg: weightDelta,
        message: `Скачок веса на +${weightDelta} кг за последние 1-2 дня — это задержка воды и гликогена, а не жировая масса. Чтобы набрать ${weightDelta} кг чистого жира, потребовалось бы переесть свыше ${Math.round(weightDelta * 7700)} ккал сверх нормы.`,
        recommendation: "Продолжайте обычный рацион и пейте чистую воду. Лишняя жидкость сойдёт самостоятельно за 48-72 часа.",
      };
    }
  }

  return { detected: false, weightDeltaKg: weightDelta };
}

/**
 * Детекция истинного плато: вес стоит 14+ дней при подтверждённом дефиците калорий.
 */
export function analyzePlateau(
  weights: WeightRecord[],
  nutritionHistory: DayCalorieRecord[]
): PlateauResult {
  if (weights.length < 10 || nutritionHistory.length < 10) {
    return { detected: false, daysStalled: 0, averageDeficitKcal: 0, actionRecommendation: "none" };
  }

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const sortedNutrition = [...nutritionHistory].sort((a, b) => a.date.localeCompare(b.date));

  // Берём окно последних 14 дней (или сколько доступно от 12 дней)
  const windowDays = Math.min(sortedWeights.length, 14);
  const recentWeights = sortedWeights.slice(-windowDays);

  const rawValues = recentWeights.map((w) => w.weightKg);
  const emaValues = calculateEma(rawValues, 0.3);

  const startEma = emaValues[0];
  const endEma = emaValues[emaValues.length - 1];
  const emaDelta = Math.abs(endEma - startEma);

  // Считаем средний дефицит калорий за этот же период
  const recentDates = new Set(recentWeights.map((w) => w.date));
  const relevantNutrition = sortedNutrition.filter((n) => recentDates.has(n.date));

  if (relevantNutrition.length === 0) {
    return { detected: false, daysStalled: 0, averageDeficitKcal: 0, actionRecommendation: "none" };
  }

  const totalDeficit = relevantNutrition.reduce(
    (acc, curr) => acc + (curr.targetCalories - curr.consumedCalories),
    0
  );
  const avgDeficit = Math.round(totalDeficit / relevantNutrition.length);

  // Если сглаженный вес практически не изменился (< 0.25 кг) за 12-14+ дней
  // и пользователь реально находился в расчетном дефиците (средний дефицит >= 250 ккал)
  if (emaDelta <= 0.25 && avgDeficit >= 250 && windowDays >= 12) {
    const isProlonged = windowDays >= 14;
    return {
      detected: true,
      daysStalled: windowDays,
      averageDeficitKcal: avgDeficit,
      actionRecommendation: isProlonged ? "refeed" : "recalculate_tdee",
      message: `Вес удерживается в одном коридоре уже ${windowDays} дней, несмотря на средний дефицит ~${avgDeficit} ккал/день. Это физиологическая адаптация (снижение базового расхода NEAT и задержка кортизоловой воды).`,
    };
  }

  return {
    detected: false,
    daysStalled: 0,
    averageDeficitKcal: avgDeficit,
    actionRecommendation: "none",
  };
}

/**
 * Рассчитывает фактическую потерю чистого жира по энергетическому балансу vs стрелка весов.
 */
export function calculateRealFatLoss(
  weights: WeightRecord[],
  nutritionHistory: DayCalorieRecord[]
): RealFatLossResult | null {
  if (weights.length < 2 || nutritionHistory.length < 3) return null;

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const firstWeight = sortedWeights[0].weightKg;
  const lastWeight = sortedWeights[sortedWeights.length - 1].weightKg;
  const scaleWeightChangeKg = Number((lastWeight - firstWeight).toFixed(2));

  // Суммарный дефицит за все учтённые дни
  let cumulativeDeficitKcal = 0;
  for (const n of nutritionHistory) {
    cumulativeDeficitKcal += n.targetCalories - n.consumedCalories;
  }

  // 1 кг жировой ткани человека = ~7700 ккал энергии
  const estimatedFatLossKg = Number((cumulativeDeficitKcal / 7700).toFixed(2));
  // Разница между весами и расчётным жиром (вода, гликоген, ЖКТ)
  const waterOrMuscleMaskingKg = Number(
    Math.abs(scaleWeightChangeKg * -1 - estimatedFatLossKg).toFixed(2)
  );

  let message = "";
  if (estimatedFatLossKg > 0) {
    message = `По суммарному дефициту (${cumulativeDeficitKcal} ккал) вы сожгли ~${estimatedFatLossKg} кг жира.`;
  } else {
    message = `Энергетический баланс стабилен (${Math.round(cumulativeDeficitKcal)} ккал).`;
  }

  return {
    estimatedFatLossKg,
    scaleWeightChangeKg,
    waterOrMuscleMaskingKg,
    cumulativeDeficitKcal,
    message,
  };
}

export function evaluateSmartProgressInsights(
  weights: WeightRecord[],
  nutritionHistory: DayCalorieRecord[]
): SmartProgressInsights {
  return {
    waterRetention: analyzeWaterRetention(weights, nutritionHistory),
    plateau: analyzePlateau(weights, nutritionHistory),
    realFatLoss: calculateRealFatLoss(weights, nutritionHistory),
  };
}
