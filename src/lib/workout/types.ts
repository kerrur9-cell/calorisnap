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
  caloriesBurned: number;
  targetMuscles?: string[];
  notes?: string;
  equipmentPhotoUrl?: string;
  createdAt: string;
}

export interface DayEnergyBalance {
  /** Базовый обмен веществ (BMR), ккал */
  bmr: number;
  /** Потрачено на тренировках и активности за день, ккал */
  burnedCalories: number;
  /** Суммарный расход за день: BMR + тренировки, ккал */
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
