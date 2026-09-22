import { calculateBmr, type Gender } from "@/lib/nutrition/tdee";
import type { DayEnergyBalance } from "./types";

export interface UserBiometrics {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Расчет энергозатрат кардио по шкале MET (Metabolic Equivalent of Task).
 * Формула: Калории = MET * вес_кг * (минуты / 60)
 */
export function calculateCardioCalories(params: {
  weightKg: number;
  durationMinutes: number;
  met: number;
}): number {
  const { weightKg, durationMinutes, met } = params;
  if (weightKg <= 0 || durationMinutes <= 0 || met <= 0) return 0;
  const cals = met * weightKg * (durationMinutes / 60);
  return Math.round(cals);
}

/**
 * Расчет энергозатрат силовой тренировки или работы на тренажере.
 * В среднем силовой сет (подход + отдых) расходует около 0.05–0.08 ккал на кг веса тела за сет
 * в зависимости от интенсивности упражнения (базовые упражнения на ноги сжигают больше, изолированные меньше).
 */
export function calculateStrengthCalories(params: {
  weightKg: number;
  sets: number;
  reps?: number;
  intensityFactor?: number; // 1.0 (обычная изоляция) .. 1.5 (тяжелые многосуставные/ноги)
}): number {
  const { weightKg, sets, intensityFactor = 1.0 } = params;
  if (weightKg <= 0 || sets <= 0) return 0;
  // Базовая трата: ~0.065 ккал на кг за подход средней тяжести
  const caloriesPerSet = weightKg * 0.065 * intensityFactor;
  return Math.round(caloriesPerSet * sets);
}

/**
 * Расчет суточного энергобаланса:
 * BMR + Тренировки vs Съеденные калории -> Итоговый дефицит/профицит.
 */
export function calculateEnergyBalance(params: {
  biometrics?: UserBiometrics | null;
  burnedCalories: number;
  consumedCalories: number;
}): DayEnergyBalance {
  const { biometrics, burnedCalories, consumedCalories } = params;

  let bmr = 1450;
  try {
    if (biometrics && biometrics.weightKg > 0 && biometrics.heightCm > 0) {
      const calculated = calculateBmr({
        gender: biometrics.gender || "female",
        age: Number.isFinite(biometrics.age) && biometrics.age > 0 ? biometrics.age : 25,
        heightCm: Number.isFinite(biometrics.heightCm) && biometrics.heightCm > 0 ? biometrics.heightCm : 165,
        weightKg: Number.isFinite(biometrics.weightKg) && biometrics.weightKg > 0 ? biometrics.weightKg : 55,
      });
      if (Number.isFinite(calculated) && calculated > 500) {
        bmr = calculated;
      }
    }
  } catch {
    bmr = 1450;
  }

  const safeBurned = Number.isFinite(burnedCalories) ? burnedCalories : 0;
  const safeConsumed = Number.isFinite(consumedCalories) ? consumedCalories : 0;
  const totalExpenditure = bmr + safeBurned;
  const netDeficit = totalExpenditure - safeConsumed;

  let status: DayEnergyBalance["status"] = "optimal_deficit";
  let statusText = "Оптимальный дефицит";
  let statusDescription = "Вы отлично сжигаете жир без стресса для организма!";

  if (netDeficit > 750) {
    status = "high_deficit";
    statusText = "Глубокий дефицит";
    statusDescription = "Большой дефицит! Не забывайте есть достаточно белка, чтобы не терять мышцы.";
  } else if (netDeficit >= 250 && netDeficit <= 750) {
    status = "optimal_deficit";
    statusText = `Дефицит ${netDeficit} ккал`;
    statusDescription = "Идеальный диапазон для комфортного и стабильного похудения 🔥";
  } else if (netDeficit >= -150 && netDeficit < 250) {
    status = "maintenance";
    statusText = "Поддержание веса";
    statusDescription = "Потреблено примерно столько же, сколько потрачено.";
  } else {
    status = "surplus";
    statusText = `Профицит ${Math.abs(netDeficit)} ккал`;
    statusDescription = "Профицит калорий. Отлично подходит для роста мышц или восстановления.";
  }

  return {
    bmr,
    burnedCalories,
    totalExpenditure,
    consumedCalories,
    netDeficit,
    status,
    statusText,
    statusDescription,
  };
}
