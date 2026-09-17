/**
 * Расчёт энергетических норм.
 * Формула: Mifflin-St Jeor (см. ТЗ, раздел 10).
 * Никаких зависимостей — чистые функции, легко тестировать.
 */

export type Gender = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Малоподвижный",
  light: "Лёгкая активность",
  moderate: "Умеренная активность",
  active: "Высокая активность",
  very_active: "Очень высокая",
};

export const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary: "Сидячая работа, без тренировок",
  light: "Тренировки 1–3 раза в неделю",
  moderate: "Тренировки 3–5 раз в неделю",
  active: "Тренировки 6–7 раз в неделю",
  very_active: "Тренировки 2 раза в день",
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "Похудеть",
  maintain: "Поддерживать",
  gain: "Набрать массу",
};

/** Дефицит/профицит относительно TDEE, ккал */
export const GOAL_DELTA: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export interface TdeeInput {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface TdeeResult {
  /** Базовый метаболизм, ккал */
  bmr: number;
  /** Суточный расход с учётом активности, ккал */
  tdee: number;
  /** Целевые калории с учётом цели */
  targetCalories: number;
  /** Дефицит (отрицательный) или профицит (положительный) */
  delta: number;
  /** Ожидаемое изменение веса в неделю, кг */
  weeklyWeightDeltaKg: number;
}

/** BMR по формуле Миффлина-Сан Жеора */
export function calculateBmr(input: {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(input.gender === "male" ? base + 5 : base - 161);
}

export function calculateTdee(input: TdeeInput): TdeeResult {
  if (!Number.isFinite(input.age) || input.age < 18 || input.age > 120 ||
    !Number.isInteger(input.heightCm) || input.heightCm < 100 || input.heightCm >= 250 ||
    !Number.isFinite(input.weightKg) || input.weightKg < 20 || input.weightKg > 500) {
    throw new Error("Расчёт доступен для взрослых: возраст 18–120 лет, рост 100–249 см, вес 20–500 кг");
  }
  const bmr = calculateBmr(input);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[input.activityLevel]);
  const delta = GOAL_DELTA[input.goal];
  const targetCalories = Math.max(1200, tdee + delta);

  // ~7700 ккал на 1 кг жировой массы
  const weeklyWeightDeltaKg =
    Math.round(((targetCalories - tdee) * 7) / 7700 / 0.05) * 0.05;

  return {
    bmr,
    tdee,
    targetCalories,
    delta,
    weeklyWeightDeltaKg,
  };
}

/** Возраст в полных годах из даты рождения (YYYY-MM-DD) */
export function ageFromBirthDate(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
