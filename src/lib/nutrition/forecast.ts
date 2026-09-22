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

  // Анализ фактического питания за последние дни с ненулевыми записями
  const activeCalorieDays = calorieHistory.filter((c) => c.calories > 0);
  const actualAvgCalories =
    activeCalorieDays.length > 0
      ? Math.round(activeCalorieDays.reduce((acc, c) => acc + c.calories, 0) / activeCalorieDays.length)
      : targetCalories;

  const actualDailyDeficit = tdee - actualAvgCalories;
  const targetDailyDeficit = tdee - targetCalories;

  // Изменение веса в день и неделю: дефицит снижает вес (минус), профицит растит (плюс)
  const actualDailyChangeKg = -(actualDailyDeficit / KCAL_PER_KG_FAT);
  const targetDailyChangeKg = -(targetDailyDeficit / KCAL_PER_KG_FAT);

  const actualWeeklyChangeKg = Math.round(actualDailyChangeKg * 7 * 100) / 100;
  const targetWeeklyChangeKg = Math.round(targetDailyChangeKg * 7 * 100) / 100;

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
  let isRateRealistic = true;
  let message = "Прогноз сформирован на основе модели энергобаланса.";

  if (targetWeightKg && currentTrendWeight) {
    const diff = targetWeightKg - currentTrendWeight;
    const isLosing = diff < 0;
    const isGaining = diff > 0;

    // Скорость в сторону цели
    const effectiveRatePerDay = actualDailyChangeKg !== 0 ? actualDailyChangeKg : targetDailyChangeKg;

    // Проверяем безопасность темпа: безопасная потеря до 1 кг/нед, набор до 0.5 кг/нед
    if (Math.abs(actualWeeklyChangeKg) > 1.2) {
      isRateRealistic = false;
      message = "Текущий темп изменения веса слишком высокий для устойчивого результата.";
    }

    if ((isLosing && effectiveRatePerDay < 0) || (isGaining && effectiveRatePerDay > 0)) {
      const daysNeeded = Math.round(diff / effectiveRatePerDay);
      if (daysNeeded > 0 && daysNeeded <= 730) {
        estimatedTargetDate = addDays(startDate, daysNeeded);
        message = `При текущем темпе цель ${targetWeightKg} кг может быть достигнута примерно к ${new Date(
          estimatedTargetDate + "T12:00:00"
        ).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}.`;
      }
    } else if (Math.abs(diff) <= 0.5) {
      message = "Вы находитесь в пределах целевого веса.";
    } else {
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
    estimatedTargetDate,
    isRateRealistic,
    message,
  };
}
