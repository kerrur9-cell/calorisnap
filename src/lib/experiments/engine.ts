import type { DayTotals, MacroTargets } from "../nutrition/macros";
import type { MealHistoryEntry } from "../nutrition/personalization";
import { addDays, todayKey } from "../utils";

export interface ProtocolDefinition {
  id: string;
  title: string;
  durationDays: number;
  emoji: string;
  shortDescription: string;
  detailedDescription: string;
  expectedBenefits: string[];
  checkDailyCompliance: (params: {
    totals: DayTotals;
    targets: MacroTargets;
    targetCalories: number;
    meals: MealHistoryEntry;
  }) => boolean;
}

export interface ActiveExperiment {
  protocolId: string;
  startDate: string;
  startWeightKg?: number;
  completedDays: number;
  notes?: string;
}

export interface ExperimentDayLog {
  date: string;
  totals: DayTotals;
  targets: MacroTargets;
  targetCalories: number;
  meals: MealHistoryEntry;
  weightKg?: number;
}

export interface ExperimentEvaluation {
  protocol: ProtocolDefinition;
  startDate: string;
  endDate: string;
  totalDays: number;
  elapsedDays: number;
  compliantDaysCount: number;
  complianceRate: number; // 0..1
  isCompleted: boolean;
  startWeightKg?: number;
  currentWeightKg?: number;
  weightDeltaKg?: number;
  verdict: string;
}

export const EXPERIMENT_PROTOCOLS: ProtocolDefinition[] = [
  {
    id: "high_protein_14d",
    title: "14 дней белкового фокуса",
    durationDays: 14,
    emoji: "🥩",
    shortDescription: "Сытость и защита мышц при снижении веса",
    detailedDescription:
      "Удержание нормы белка от 90% каждый день. Повышает термический эффект пищи и снижает тягу к перекусам.",
    expectedBenefits: [
      "Долгое чувство сытости после еды",
      "Снижение вечерней тяги к сладкому",
      "Сохранение тонуса мышц",
    ],
    checkDailyCompliance: ({ totals, targets }) => {
      return totals.proteinG >= targets.proteinG * 0.9;
    },
  },
  {
    id: "clean_eating_7d",
    title: "7 дней без переедания",
    durationDays: 7,
    emoji: "🥗",
    shortDescription: "Строгий коридор калорий без профицита",
    detailedDescription:
      "Каждый день завершается без превышения нормы калорий более чем на 5%. Развивает осознанность порций.",
    expectedBenefits: [
      "Устранение чувства тяжести",
      "Быстрое уменьшение объёма талии",
      "Закрепление дисциплины",
    ],
    checkDailyCompliance: ({ totals, targetCalories }) => {
      return totals.calories > 0 && totals.calories <= targetCalories * 1.05;
    },
  },
  {
    id: "low_carb_kickstart_10d",
    title: "10 дней умеренных углеводов",
    durationDays: 10,
    emoji: "🥑",
    shortDescription: "Углеводы до 100 г/день для слива лишней воды",
    detailedDescription:
      "Ограничение простых углеводов и акцент на овощи, белки и полезные жиры. Быстро избавляет от отечности.",
    expectedBenefits: [
      "Сход отёков в первые 3 дня (-1..2 кг воды)",
      "Ровный уровень энергии без сонных 'провалов'",
      "Стабильный сахар в крови",
    ],
    checkDailyCompliance: ({ totals }) => {
      return totals.calories > 0 && totals.carbsG <= 100;
    },
  },
];

export function getProtocolById(id: string): ProtocolDefinition | undefined {
  return EXPERIMENT_PROTOCOLS.find((p) => p.id === id);
}

/**
 * Оценивает прогресс и результаты активного эксперимента.
 */
export function evaluateExperiment(
  experiment: ActiveExperiment,
  dayLogs: ExperimentDayLog[],
  latestWeightKg?: number
): ExperimentEvaluation | null {
  const protocol = getProtocolById(experiment.protocolId);
  if (!protocol) return null;

  const totalDays = protocol.durationDays;
  const endDate = addDays(experiment.startDate, totalDays - 1);
  const today = todayKey();

  // Отбираем дни, попадающие в окно эксперимента
  const relevantLogs = dayLogs.filter(
    (l) => l.date >= experiment.startDate && l.date <= endDate
  );

  let compliantDaysCount = 0;
  for (const log of relevantLogs) {
    if (protocol.checkDailyCompliance(log)) {
      compliantDaysCount += 1;
    }
  }

  const elapsedDays = Math.min(
    totalDays,
    Math.max(1, Math.round((new Date(today).getTime() - new Date(experiment.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );

  const evaluatedDaysCount = Math.max(1, relevantLogs.length);
  const complianceRate = Number((compliantDaysCount / evaluatedDaysCount).toFixed(2));
  const isCompleted = elapsedDays >= totalDays;

  const startWeightKg = experiment.startWeightKg;
  const currentWeightKg = latestWeightKg ?? startWeightKg;
  const weightDeltaKg =
    startWeightKg && currentWeightKg
      ? Number((currentWeightKg - startWeightKg).toFixed(2))
      : undefined;

  let verdict = "";
  if (!isCompleted) {
    verdict = `Эксперимент в процессе: день ${elapsedDays} из ${totalDays}. Соблюдение правил: ${compliantDaysCount} из ${evaluatedDaysCount} учтённых дней (${Math.round(complianceRate * 100)}%).`;
  } else if (complianceRate >= 0.75) {
    verdict = `Эксперимент успешно завершён с высоким соблюдением (${Math.round(complianceRate * 100)}%)!${
      weightDeltaKg !== undefined
        ? ` Динамика веса: ${weightDeltaKg > 0 ? `+${weightDeltaKg}` : weightDeltaKg} кг.`
        : ""
    } Этот протокол отлично подходит вашему организму.`;
  } else {
    verdict = `Эксперимент завершён с соблюдением ${Math.round(complianceRate * 100)}%. Протокол оказался требовательным. Вы можете повторить его позже или выбрать более мягкую цель.`;
  }

  return {
    protocol,
    startDate: experiment.startDate,
    endDate,
    totalDays,
    elapsedDays,
    compliantDaysCount,
    complianceRate,
    isCompleted,
    startWeightKg,
    currentWeightKg,
    weightDeltaKg,
    verdict,
  };
}
