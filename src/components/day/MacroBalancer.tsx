"use client";

import { useState } from "react";
import { X, Scale, Plus, Check, Loader2, Sparkles } from "lucide-react";
import { balanceMacros, type BalancedRecommendation } from "@/lib/nutrition/balancer";
import type { MacroTargets } from "@/lib/nutrition/macros";
import { saveMeal } from "@/lib/meals";
import { useQueryClient } from "@tanstack/react-query";
import { dayQueryKey } from "@/hooks/useDayLog";

interface MacroBalancerProps {
  targetCalories: number;
  remainingCalories: number;
  targetMacros: MacroTargets;
  remainingMacros: MacroTargets;
  dateKey: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MacroBalancer({
  targetCalories,
  remainingCalories,
  targetMacros,
  remainingMacros,
  dateKey,
  isOpen,
  onClose,
}: MacroBalancerProps) {
  const queryClient = useQueryClient();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const balanceResult = balanceMacros({
    targetCalories,
    remainingCalories,
    targetMacros,
    remainingMacros,
  });

  async function handleAddRecommendation(rec: BalancedRecommendation) {
    const key = `${rec.foodName}-${rec.servingGrams}`;
    setAddingId(key);
    setError(null);

    try {
      const mealId = crypto.randomUUID();
      await saveMeal({
        id: mealId,
        date: dateKey,
        type: "snack",
        items: [
          {
            custom_food_name: rec.foodName,
            weight_grams: rec.servingGrams,
            calories: rec.calories,
            protein_g: rec.macros.proteinG,
            fat_g: rec.macros.fatG,
            carbs_g: rec.macros.carbsG,
            weight_source: "manual",
            position: 0,
          },
        ],
      });

      setAddedIds((prev) => new Set([...prev, key]));
      queryClient.invalidateQueries({ queryKey: dayQueryKey(dateKey) });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch {
      setError("Не удалось добавить в дневник. Попробуйте ещё раз.");
    } finally {
      setAddingId(null);
    }
  }

  const nutrientNameRu =
    balanceResult.primaryDeficit === "protein"
      ? "белка"
      : balanceResult.primaryDeficit === "fat"
      ? "жиров"
      : balanceResult.primaryDeficit === "carbs"
      ? "углеводов"
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balancer-title"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
        {/* iOS-стиль индикатор свайпа вниз */}
        <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />

        <header className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 id="balancer-title" className="text-base font-bold">
                Балансировщик БЖУ
              </h2>
              <p className="text-xs text-muted-foreground">Алгоритмический расчёт под остаток</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Статус баланса */}
        {balanceResult.isBalanced ? (
          <div className="rounded-2xl bg-primary-soft/50 p-6 text-center">
            <Check className="mx-auto h-8 w-8 text-primary" />
            <h3 className="mt-2 text-base font-bold">Рацион сбалансирован!</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Все целевые макронутриенты распределены пропорционально. Нет критического дефицита.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/40 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted-foreground">Главная потребность:</span>
                <span className="text-xs font-semibold text-primary">
                  Осталось {balanceResult.remainingCalories} ккал
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold">
                Не хватает ~{Math.round(balanceResult.deficitGrams)} г {nutrientNameRu}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Алгоритм подобрал точные порции продуктов из проверенной базы, которые закрывают этот дефицит без превышения бюджета калорий.
              </p>
            </div>

            {error && <div className="text-xs text-danger">{error}</div>}

            {/* Карточки рекомендаций */}
            <div className="space-y-2.5">
              {balanceResult.recommendations.map((rec) => {
                const key = `${rec.foodName}-${rec.servingGrams}`;
                const isAdded = addedIds.has(key);
                const isLoading = addingId === key;

                return (
                  <div
                    key={key}
                    className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/50 p-3.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm">{rec.foodName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Scale className="h-3 w-3" />
                          <span>{rec.servingGrams} г порция</span>
                          <span>·</span>
                          <span className="font-medium text-foreground">{rec.calories} ккал</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddRecommendation(rec)}
                        disabled={isAdded || isLoading}
                        className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          isAdded
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary-soft text-primary hover:bg-primary hover:text-primary-foreground"
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> В дневнике
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" /> Добавить
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground border-t border-border/30 pt-2">
                      <span className="font-medium text-primary">
                        +{Math.round(rec.nutrientGainGrams)}г {nutrientNameRu}
                      </span>
                      <span>Б {rec.macros.proteinG}</span>
                      <span>Ж {rec.macros.fatG}</span>
                      <span>У {rec.macros.carbsG}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-muted py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:w-auto sm:px-6"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
