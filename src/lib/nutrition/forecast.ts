import { addDays } from "../utils";

export interface WeightDataPoint {
  date: string;
  weightKg: number;
}

export interface CalorieDataPoint {
  date: string;
  calories: number;
}

export interface TrendPoint {
  date: string;
  actualWeight?: number;
  trendWeight: number;
}

export interface ForecastPoint {
  date: string;
  actualPaceWeight: number;
  targetPaceWeight: number;
  maintenanceWeight: number;
  lowerBound: number;
  upperBound: number;
}

export interface WeightForecastResult {
  currentWeight: number | null;
  currentTrendWeight: number | null;
  historyTrend: TrendPoint[];
  forecastPoints: ForecastPoint[];
  actualAvgCalories: number;
  tdee: number;
  targetCalories: number;
  actualDailyDeficit: number;
  targetDailyDeficit: number;
  actualWeeklyChangeKg: number;
  targetWeeklyChangeKg: number;
  hasSufficientActualData: boolean;
  estimatedTargetDate: string | null;
  isRateRealistic: boolean;
  message: string;
}

const KCAL_PER_KG_FAT = 7700;
const EMA_ALPHA = 0.2; // Стандарт фильтрации водных колебаний (Hacker's Diet / Trend Weight)
const NATURAL_FLUCTUATION_KG = 0.7; // Естественный разброс суточных колебаний

/**
 * Экспоненциальное скользящее среднее для числового ряда.
 */
export function calculateEma(values: number[], alpha = EMA_ALPHA): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  let current = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      current = values[i];
    } else {
      current = alpha * values[i] + (1 - alpha) * current;
    }
    result.push(Math.round(current * 100) / 100);
  }
  return result;
}

/**
 * Расчёт экспоненциального скользящего среднего (EMA) для устранения водных колебаний.
 */
export function calculateWeightTrend(history: WeightDataPoint[]): TrendPoint[] {
  if (history.length === 0) return [];

  // Сортировка по возрастанию даты
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const rawWeights = sorted.map((p) => p.weightKg);
  const emaWeights = calculateEma(rawWeights, EMA_ALPHA);

  return sorted.map((point, idx) => ({
    date: point.date,
    actualWeight: point.weightKg,
    trendWeight: emaWeights[idx],
  }));
}

/**
 * Прогноз веса на 30–90 дней на основе сглаженного тренда, фактического энергобаланса и целей.
 */
export function calculateWeightForecast(params: {
  weightHistory: WeightDataPoint[];
  calorieHistory: CalorieDataPoint[];
  tdee: number;
  targetCalories: number;
  targetWeightKg?: number | null;
  forecastDays?: number;
}): WeightForecastResult {
  const {
    weightHistory,
    calorieHistory,
    tdee,
    targetCalories,
    targetWeightKg = null,
    forecastDays = 60,
  } = params;

  const historyTrend = calculateWeightTrend(weightHistory);
  const latestTrendPoint = historyTrend[historyTrend.length - 1];
  const currentWeight = latestTrendPoint?.actualWeight ?? null;
  const currentTrendWeight = latestTrendPoint?.trendWeight ?? null;

  // Исключаем сегодня, если день ещё не завершён (менее 50% целевых калорий)
  const todayStr = new Date().toISOString().split("T")[0];
  const completedCalorieDays = calorieHistory.filter((c) => {
    if (c.calories <= 0) return false;
    if (c.date === todayStr && c.calories < targetCalories * 0.5) return false;
    return true;
  });

  // Для фактического темпа требуется минимум 3 полных дня питания
  const hasSufficientActualData = completedCalorieDays.length >= 3;

  const actualAvgCalories = hasSufficientActualData
    ? Math.round(completedCalorieDays.reduce((acc, c) => acc + c.calories, 0) / completedCalorieDays.length)
    : targetCalories;

  const actualDailyDeficit = tdee - actualAvgCalories;
  const targetDailyDeficit = tdee - targetCalories;

  // Изменение веса в день и неделю
  let actualDailyChangeKg = -(actualDailyDeficit / KCAL_PER_KG_FAT);
  const targetDailyChangeKg = -(targetDailyDeficit / KCAL_PER_KG_FAT);
  const targetWeeklyChangeKg = Math.round(targetDailyChangeKg * 7 * 100) / 100;

  let isRateRealistic = true;
  let actualWeeklyChangeKg = 0;
  let message = "";

  if (!hasSufficientActualData) {
    // При недостатке дней (например, 1 неполный день) используем плановый темп, чтобы не показывать −2.2 кг/нед
    actualDailyChangeKg = targetDailyChangeKg;
    actualWeeklyChangeKg = targetWeeklyChangeKg;
    message = "Недостаточно данных для расчёта фактического темпа (нужно минимум 3 полных дня записей). Прогноз построен по вашему плану питания.";
  } else {
    const rawWeekly = actualDailyChangeKg * 7;
    // Ограничиваем экстремальные темпы физиологическим порогом ±1.2 кг/нед
    if (Math.abs(rawWeekly) > 1.2) {
      isRateRealistic = false;
      actualDailyChangeKg = (Math.sign(rawWeekly) || -1) * (1.2 / 7);
      actualWeeklyChangeKg = (Math.sign(rawWeekly) || -1) * 1.2;
      message = `Фактический дефицит показывает экстремальный темп (${rawWeekly > 0 ? "+" : ""}${rawWeekly.toFixed(2)} кг/нед). При резком дефиците первые сдвиги отражают потерю жидкости и гликогена, а не чистый жир. Реалистичный устойчивый темп ограничен ~1.0–1.2 кг/нед.`;
    } else {
      actualWeeklyChangeKg = Math.round(rawWeekly * 100) / 100;
      message = "Прогноз сформирован на основе модели энергобаланса и фактического питания.";
    }
  }

  const baseWeight = currentTrendWeight ?? currentWeight ?? 70;
  const startDate = latestTrendPoint?.date ?? new Date().toISOString().split("T")[0];

  const forecastPoints: ForecastPoint[] = [];

  for (let day = 1; day <= forecastDays; day++) {
    const date = addDays(startDate, day);
    const actualPaceWeight = Math.round((baseWeight + actualDailyChangeKg * day) * 100) / 100;
    const targetPaceWeight = Math.round((baseWeight + targetDailyChangeKg * day) * 100) / 100;
    const maintenanceWeight = Math.round(baseWeight * 100) / 100;

    forecastPoints.push({
      date,
      actualPaceWeight,
      targetPaceWeight,
      maintenanceWeight,
      lowerBound: Math.round((actualPaceWeight - NATURAL_FLUCTUATION_KG) * 100) / 100,
      upperBound: Math.round((actualPaceWeight + NATURAL_FLUCTUATION_KG) * 100) / 100,
    });
  }

  // Расчёт даты достижения целевого веса
  let estimatedTargetDate: string | null = null;

  if (targetWeightKg && currentTrendWeight) {
    const diff = targetWeightKg - currentTrendWeight;
    const isLosing = diff < 0;
    const isGaining = diff > 0;

    // Скорость в сторону цели
    const effectiveRatePerDay = actualDailyChangeKg !== 0 ? actualDailyChangeKg : targetDailyChangeKg;

    if ((isLosing && effectiveRatePerDay < 0) || (isGaining && effectiveRatePerDay > 0)) {
      const daysNeeded = Math.round(diff / effectiveRatePerDay);
      if (daysNeeded > 0 && daysNeeded <= 730) {
        estimatedTargetDate = addDays(startDate, daysNeeded);
        if (hasSufficientActualData) {
          message = `При текущем темпе цель ${targetWeightKg} кг может быть достигнута примерно к ${new Date(
            estimatedTargetDate + "T12:00:00"
          ).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}.`;
        }
      }
    } else if (Math.abs(diff) <= 0.5) {
      message = "Вы находитесь в пределах целевого веса.";
    } else if (hasSufficientActualData) {
      message = "Текущая калорийность не направлена в сторону целевого веса.";
    }
  }

  return {
    currentWeight,
    currentTrendWeight,
    historyTrend,
    forecastPoints,
    actualAvgCalories,
    tdee,
    targetCalories,
    actualDailyDeficit,
    targetDailyDeficit,
    actualWeeklyChangeKg,
    targetWeeklyChangeKg,
    hasSufficientActualData,
    estimatedTargetDate,
    isRateRealistic,
    message,
  };
}
