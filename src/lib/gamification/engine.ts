import type { DailyStat } from "@/types/database";

export interface GamificationState {
  xp: number;
  level: number;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
  levelTitle: string;
  momentumDays: number; // Дни регулярности за последние 14 дней (без токсичного сброса)
  completedTodayActions: {
    loggedMeal: boolean;
    hitCalorieGoal: boolean;
    hitProteinGoal: boolean;
    loggedWeight: boolean;
  };
  todayEarnedXp: number;
  unlockedBadges: Badge[];
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: "consistency" | "nutrition" | "milestone";
  unlocked: boolean;
  progressText?: string;
}

const LEVEL_TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 1, title: "Новичок осознанности" },
  { minLevel: 3, title: "Искатель баланса" },
  { minLevel: 5, title: "Фокусированный трекер" },
  { minLevel: 8, title: "Мастер нутриентов" },
  { minLevel: 12, title: "Эксперт метаболизма" },
  { minLevel: 16, title: "Легенда постоянства" },
];

/**
 * Кривая опыта: каждый уровень требует чуть больше XP (квадратично-линейный рост).
 * Уровень 1: 0..150 XP
 * Уровень 2: 150..350 XP
 * Уровень 3: 350..600 XP и т.д.
 */
export function getLevelDetails(totalXp: number): {
  level: number;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  title: string;
} {
  let level = 1;
  let accumulatedXp = 0;
  let levelCost = 150;

  while (totalXp >= accumulatedXp + levelCost) {
    accumulatedXp += levelCost;
    level++;
    levelCost = Math.round(150 + (level - 1) * 75);
  }

  const xpInCurrentLevel = totalXp - accumulatedXp;
  const xpToNextLevel = levelCost;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpToNextLevel) * 100));

  const matchedTitle = [...LEVEL_TITLES].reverse().find((t) => level >= t.minLevel)?.title ?? "Осознанный трекер";

  return {
    level,
    xpInCurrentLevel,
    xpToNextLevel,
    progressPercent,
    title: matchedTitle,
  };
}

/**
 * Расчёт прогресса, XP и достижений на основе реальных данных пользователя.
 * Полностью детерминировано, без токсичных наказаний за пропущенный день.
 */
export function calculateGamification(params: {
  dailyStats: DailyStat[];
  weightsCount: number;
  targetCalories: number;
  targetProtein: number;
  todayTotals: {
    calories: number;
    proteinG: number;
    mealCount: number;
    hasWeightToday: boolean;
  };
}): GamificationState {
  const { dailyStats, weightsCount, targetCalories, targetProtein, todayTotals } = params;

  let totalXp = 0;
  let totalCalorieHits = 0;
  let totalProteinHits = 0;
  let daysWithFood = 0;

  // 1. Опыт за историю питания
  for (const day of dailyStats) {
    const cals = day.total_calories ?? 0;
    const protein = day.total_protein ?? 0;
    const meals = day.meal_count ?? 0;

    if (meals > 0 && cals > 0) {
      daysWithFood++;
      // +15 XP за каждый приём пищи (макс 4 в день = 60 XP)
      totalXp += Math.min(meals, 4) * 15;

      // Попадание в цель по калориям (±10% или дефицит): +40 XP
      if (targetCalories > 0 && cals >= targetCalories * 0.85 && cals <= targetCalories * 1.1) {
        totalXp += 40;
        totalCalorieHits++;
      }

      // Попадание в цель по белку (>= 85% от нормы): +35 XP
      if (targetProtein > 0 && protein >= targetProtein * 0.85) {
        totalXp += 35;
        totalProteinHits++;
      }
    }
  }

  // 2. Опыт за взвешивания: +20 XP за каждое
  totalXp += weightsCount * 20;


  // Опыт за сегодняшние действия
  let todayEarnedXp = 0;
  const completedTodayActions = {
    loggedMeal: todayTotals.mealCount > 0,
    hitCalorieGoal:
      targetCalories > 0 &&
      todayTotals.calories >= targetCalories * 0.85 &&
      todayTotals.calories <= targetCalories * 1.1,
    hitProteinGoal: targetProtein > 0 && todayTotals.proteinG >= targetProtein * 0.85,
    loggedWeight: todayTotals.hasWeightToday,
  };

  if (completedTodayActions.loggedMeal) todayEarnedXp += Math.min(todayTotals.mealCount, 4) * 15;
  if (completedTodayActions.hitCalorieGoal) todayEarnedXp += 40;
  if (completedTodayActions.hitProteinGoal) todayEarnedXp += 35;
  if (completedTodayActions.loggedWeight) todayEarnedXp += 20;

  // 4. Momentum (Импульс): количество активных дней из последних 14
  // Пользователь НЕ наказывается за один пропущенный день!
  const recentDays = dailyStats.slice(-14);
  const momentumDays = recentDays.filter((d) => (d.meal_count ?? 0) > 0).length + (completedTodayActions.loggedMeal ? 1 : 0);

  const levelInfo = getLevelDetails(totalXp);

  // 5. Набор достижений (Badges)
  const unlockedBadges: Badge[] = [
    {
      id: "first_meal",
      title: "Первый шаг",
      description: "Записан первый приём пищи в дневник",
      emoji: "🌱",
      category: "milestone",
      unlocked: daysWithFood > 0 || completedTodayActions.loggedMeal,
    },
    {
      id: "protein_fan",
      title: "Белковый фокус",
      description: "Норма белка выполнена 5 раз",
      emoji: "🥩",
      category: "nutrition",
      unlocked: totalProteinHits >= 5,
      progressText: `${totalProteinHits}/5`,
    },
    {
      id: "calorie_master",
      title: "Снайпер калорий",
      description: "Попадание в целевой коридор калорий 7 раз",
      emoji: "🎯",
      category: "nutrition",
      unlocked: totalCalorieHits >= 7,
      progressText: `${totalCalorieHits}/7`,
    },
    {
      id: "scale_regular",
      title: "Контроль динамики",
      description: "Зафиксировано 5 взвешиваний",
      emoji: "⚖️",
      category: "consistency",
      unlocked: weightsCount >= 5,
      progressText: `${weightsCount}/5`,
    },
    {
      id: "meal_streak",
      title: "Дисциплина питания",
      description: "Трекинг еды 10 дней подряд",
      emoji: "📋",
      category: "consistency",
      unlocked: daysWithFood >= 10,
      progressText: `${Math.min(daysWithFood, 10)}/10`,
    },
    {
      id: "momentum_7",
      title: "Недельный импульс",
      description: "Активность 7 дней из последних двух недель",
      emoji: "🔥",
      category: "consistency",
      unlocked: momentumDays >= 7,
      progressText: `${momentumDays}/7`,
    },
  ];

  return {
    xp: totalXp,
    level: levelInfo.level,
    xpInCurrentLevel: levelInfo.xpInCurrentLevel,
    xpToNextLevel: levelInfo.xpToNextLevel,
    levelProgressPercent: levelInfo.progressPercent,
    levelTitle: levelInfo.title,
    momentumDays: Math.min(momentumDays, 14),
    completedTodayActions,
    todayEarnedXp,
    unlockedBadges,
  };
}
