export type WorkoutCategory = "cardio" | "strength" | "machine" | "bodyweight";

export interface WorkoutEntry {
  id: string;
  userId?: string;
  entryDate: string; // YYYY-MM-DD
  exerciseName: string;
  category: WorkoutCategory;
  durationMinutes?: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  /** Активный расход калорий (сверх покоя), используемый для дневного баланса и дефицита */
  caloriesBurned: number;
  /** Полный расход калорий (gross energy expenditure) */
  grossCalories?: number;
  /** Активный расход калорий (net energy expenditure) */
  activeCalories?: number;
  /** Использованное значение MET */
  met?: number;
  /** Скорость в км/ч (для кардио) */
  speedKmh?: number;
  /** Уклон в % (для беговой дорожки) */
  inclinePercent?: number;
  /** Вес пользователя, использованный при расчёте (кг) */
  userWeightUsedKg?: number;
  /** Метод расчёта */
  calculationMethod?: "acsm" | "compendium" | "strength_tut" | "manual";
  /** Понятное текстовое объяснение формулы расчёта */
  calculationDetails?: string;
  targetMuscles?: string[];
  notes?: string;
  equipmentPhotoUrl?: string;
  createdAt: string;
}

export interface DayEnergyBalance {
  /** Базовый обмен веществ (BMR), ккал */
  bmr: number;
  /** Потрачено на тренировках и активности за день (активный расход сверх BMR), ккал */
  burnedCalories: number;
  /** Полный расход тренировок (включая покой во время тренировки), ккал */
  grossBurnedCalories?: number;
  /** Суммарный суточный расход: BMR + активные калории тренировок, ккал (без двойного учёта BMR) */
  totalExpenditure: number;
  /** Потреблено с пищей за день, ккал */
  consumedCalories: number;
  /**
   * Чистый дефицит (положительное число = дефицит, отрицательное = профицит).
   * netDeficit = totalExpenditure - consumedCalories
   */
  netDeficit: number;
  /** Текстовый статус и подсказка для пользователя */
  status: "high_deficit" | "optimal_deficit" | "maintenance" | "surplus";
  statusText: string;
  statusDescription: string;
}
