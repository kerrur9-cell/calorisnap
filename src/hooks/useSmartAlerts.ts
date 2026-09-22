"use client";

import { useMemo, useState } from "react";

export type AlertSeverity = "info" | "warning" | "danger";

export interface SmartAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionType?: "open_balancer" | "none";
  actionLabel?: string;
}

export function useSmartAlerts(params: {
  targetCalories: number;
  consumedCalories: number;
  targetProtein: number;
  consumedProtein: number;
  isToday: boolean;
  mockHour?: number;
}) {
  const {
    targetCalories,
    consumedCalories,
    targetProtein,
    consumedProtein,
    isToday,
    mockHour,
  } = params;

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const activeAlert = useMemo<SmartAlert | null>(() => {
    // Алерты активны только для сегодняшнего дня
    if (!isToday || targetCalories <= 0) return null;

    const hour = mockHour ?? new Date().getHours();
    const remainingCalories = Math.round(targetCalories - consumedCalories);
    const remainingProtein = Math.round(Math.max(0, targetProtein - consumedProtein));

    // 1. Критический дефицит белка при исчерпании калорий
    if (remainingCalories > 0 && remainingCalories < 380 && remainingProtein >= 30) {
      const id = "protein_deficit_risk";
      if (!dismissedIds.has(id)) {
        return {
          id,
          severity: "warning",
          title: "Риск дефицита белка",
          message: `Осталось ${remainingCalories} ккал, но не добрано ещё ${remainingProtein} г белка. Лучше выбрать чистый белковый продукт (творог, тунец, филе).`,
          actionType: "open_balancer",
          actionLabel: "Сбалансировать БЖУ",
        };
      }
    }

    // 2. Превышение лимита калорий
    if (consumedCalories > targetCalories * 1.05) {
      const id = "calorie_over_limit";
      if (!dismissedIds.has(id)) {
        const overKcal = Math.round(consumedCalories - targetCalories);
        return {
          id,
          severity: "danger",
          title: "Превышение нормы калорий",
          message: `Дневной план превышен на ${overKcal} ккал. Не корите себя — один день не отменяет недельный дефицит. Завтра вернитесь к обычному ритму.`,
        };
      }
    }

    // 3. Слишком быстрый расход бюджета до полудня
    if (hour < 14 && consumedCalories >= targetCalories * 0.75) {
      const id = "fast_budget_drain";
      if (!dismissedIds.has(id)) {
        const pct = Math.round((consumedCalories / targetCalories) * 100);
        return {
          id,
          severity: "warning",
          title: "Быстрый расход калорий",
          message: `К полудню израсходовано ${pct}% дневного бюджета. Чтобы комфортно дойти до вечера без чувства голода, сделайте упор на объемные овощи и белок.`,
        };
      }
    }

    // 4. Слишком мало калорий к вечеру (риск ночного срыва)
    if (hour >= 19 && consumedCalories < targetCalories * 0.5 && consumedCalories > 0) {
      const id = "evening_calorie_surplus";
      if (!dismissedIds.has(id)) {
        return {
          id,
          severity: "info",
          title: "Большой запас калорий вечером",
          message: `Уже вечер, а съедено меньше половины нормы (${Math.round(consumedCalories)} из ${targetCalories} ккал). Обязательно сытно поужинайте, чтобы избежать срыва ночью.`,
        };
      }
    }

    return null;
  }, [
    targetCalories,
    consumedCalories,
    targetProtein,
    consumedProtein,
    isToday,
    mockHour,
    dismissedIds,
  ]);

  const dismissAlert = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  return { activeAlert, dismissAlert };
}
