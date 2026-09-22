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
 * В среднем силовой сет (подход + отдых) расходует около 0.08–0.14 ккал на кг веса тела за сет
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
  const caloriesPerSet = weightKg * 0.08 * intensityFactor;
  return Math.round(caloriesPerSet * sets);
}

export interface ParsedWorkoutInput {
  exerciseName: string;
  category: "cardio" | "strength" | "machine" | "bodyweight";
  durationMinutes?: number | null;
  sets?: number | null;
  reps?: number | null;
  weightKg?: number | null;
  userWeightKg: number;
  userHeightCm?: number;
  userGender?: "male" | "female";
  userAge?: number;
}

/**
 * Точный физиологический расчет энергозатрат на основе параметров упражнения и биометрии.
 * Защищает от галлюцинаций LLM (когда AI путает одно упражнение из 4 подходов с целой часовой тренировкой).
 */
export function calculateParsedWorkoutCalories(input: ParsedWorkoutInput): number {
  const userWeight = Number.isFinite(input.userWeightKg) && input.userWeightKg > 0 ? input.userWeightKg : 55;
  const name = (input.exerciseName || "").toLowerCase();
  const category = input.category || "machine";

  // 1. Проверяем, является ли упражнение кардио
  const isCardio =
    category === "cardio" ||
    /бег|run|спринт|sprint|ходьба|walk|шаги|шаг|step|дорожк|эллипс|ellipt|велик|велосипед|bike|cycl|скакалк|jump|гребл|row|бассейн|плаван|swim|степпер|лестниц|stair/i.test(name);

  if (isCardio) {
    let met = 6.5;
    if (/бег|run|спринт|sprint/i.test(name)) met = 8.5;
    else if (/скакалк|прыжк|jump/i.test(name)) met = 10.0;
    else if (/степпер|лестниц|stair/i.test(name)) met = 8.5;
    else if (/гребл|row/i.test(name)) met = 7.0;
    else if (/эллипс|ellipt/i.test(name)) met = 6.5;
    else if (/вело|bike|cycl/i.test(name)) met = 6.8;
    else if (/плаван|swim/i.test(name)) met = 7.0;
    else if (/в гору|incline|подъем/i.test(name)) met = 6.8;
    else if (/ходьба|walk|прогулк/i.test(name)) met = 3.8;
    else if (/йога|пилатес|растяжк|стретч/i.test(name)) met = 3.0;

    let minutes = input.durationMinutes;
    if (!minutes || minutes <= 0) {
      if (input.sets && input.sets > 0) {
        minutes = input.sets * 5;
      } else {
        minutes = 20;
      }
    }

    const cals = calculateCardioCalories({
      weightKg: userWeight,
      durationMinutes: minutes,
      met,
    });
    return Math.max(5, cals);
  }

  // 2. Если указана только длительность силовой тренировки в минутах (например, "силовая 40 минут")
  if (input.durationMinutes && input.durationMinutes > 0 && (!input.sets || input.sets <= 0)) {
    const cals = calculateCardioCalories({
      weightKg: userWeight,
      durationMinutes: input.durationMinutes,
      met: 5.0,
    });
    return Math.max(10, cals);
  }

  // 3. Силовые упражнения / тренажеры / упражнения со своим весом
  let sets = input.sets && input.sets > 0 ? input.sets : null;
  if (!sets) {
    if (input.reps && input.reps > 0) {
      sets = Math.max(1, Math.round(input.reps / 12));
    } else {
      sets = 3;
    }
  }

  // Классификация мышечных групп и биомеханики
  const isHeavyLowerBody =
    /присед|squat|жим ногами|leg press|станов|deadlift|мостик|thrust|выпад|lunge|гакк|hack|ягодиц/i.test(name);
  const isUpperCompound =
    /тяга|pulldown|row|подтягиван|pull up|жим|bench|отжиман|push up|брусья|dips|спин|грудь/i.test(name);
  const isIsolation =
    /бицепс|трицепс|махи|разведен|плеч|подъем на бицепс|curl|extension|lateral|разгибан|сгибан/i.test(name);
  const isCore =
    /пресс|скручиван|планк|гиперэкстенз|кора|abs|crunch|plank/i.test(name);

  // Коэффициент энергозатрат на 1 подход с учетом времени подхода, отдыха и EPOC
  let baseSetKcalPerKg = 0.12;
  if (isHeavyLowerBody) {
    baseSetKcalPerKg = 0.18; // тяжелые ноги/ягодицы (~10 ккал за подход для 55 кг)
  } else if (isUpperCompound) {
    baseSetKcalPerKg = 0.12; // тяги/жимы (~6.5 ккал за подход для 55 кг)
  } else if (isIsolation) {
    baseSetKcalPerKg = 0.075; // изоляция на руки/плечи (~4 ккал за подход)
  } else if (isCore) {
    baseSetKcalPerKg = 0.08; // пресс (~4.5 ккал за подход)
  }

  // Учет рабочего веса отягощения (штанга/гантели)
  let weightBonus = 1.0;
  if (input.weightKg && input.weightKg > 0) {
    const ratio = Math.min(1.5, input.weightKg / userWeight);
    weightBonus = 1.0 + ratio * 0.35;
  }

  // Учет повторений
  let repsBonus = 1.0;
  if (input.reps && input.reps > 0) {
    if (input.reps > 15) repsBonus = 1.15;
    else if (input.reps < 6) repsBonus = 0.9;
  }

  const caloriesPerSet = userWeight * baseSetKcalPerKg * weightBonus * repsBonus;
  const totalCalories = Math.round(caloriesPerSet * sets);

  // Физиологический лимит для ОДНОГО упражнения:
  // 4 подхода приседаний не могут потратить 200 ккал — потолок 75-80 ккал
  const maxCap = Math.round(userWeight * (isHeavyLowerBody ? 1.3 : 0.9) * (sets / 4));
  return Math.min(Math.max(5, totalCalories), Math.max(25, maxCap));
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
