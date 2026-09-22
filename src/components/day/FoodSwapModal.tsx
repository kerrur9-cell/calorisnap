"use client";

import { useMemo } from "react";
import { X, ArrowRight, ArrowLeftRight, TrendingDown, Sparkles } from "lucide-react";
import { generateFoodSwaps, type FoodSwapItem } from "@/lib/nutrition/swap";

interface FoodSwapModalProps {
  item: FoodSwapItem;
  isOpen: boolean;
  onClose: () => void;
}

export function FoodSwapModal({ item, isOpen, onClose }: FoodSwapModalProps) {
  const swaps = useMemo(() => generateFoodSwaps(item), [item]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-title"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
        {/* iOS-стиль индикатор свайпа вниз */}
        <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />

        <header className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft p-2 text-primary">
              <ArrowLeftRight className="h-4 w-4" />
            </span>
            <div>
              <h2 id="swap-title" className="text-base font-bold">
                Умная замена блюда (Food Swap)
              </h2>
              <p className="text-xs text-muted-foreground">Альтернативы для лучшего соответствия цели</p>
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

        {/* Текущее блюдо */}
        <div className="rounded-2xl bg-muted/40 p-3.5 mb-4">
          <div className="text-xs text-muted-foreground font-medium">Текущее блюдо:</div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-semibold text-sm">{item.name}</span>
            <span className="text-xs font-bold text-foreground">
              {Math.round(item.calories)} ккал · {Math.round(item.weightGrams)} г
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Б {item.proteinG} г · Ж {item.fatG} г · У {item.carbsG} г
          </div>
        </div>

        {/* Список замен */}
        <div className="space-y-3">
          {swaps.map((swap, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border/60 bg-background/60 p-3.5 space-y-2 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {swap.title}
                </span>

                {swap.deltaCalories < 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <TrendingDown className="h-3 w-3" />
                    {swap.deltaCalories} ккал
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{swap.newName}</span>
              </div>

              <p className="text-xs text-muted-foreground">{swap.reason}</p>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/30 pt-2 text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{swap.newCalories} ккал ({swap.newWeightGrams} г)</span>
                {swap.deltaProteinG > 0 && (
                  <span className="font-semibold text-primary">+{swap.deltaProteinG} г белка</span>
                )}
                <span>Б {swap.newMacros.proteinG}</span>
                <span>Ж {swap.newMacros.fatG}</span>
                <span>У {swap.newMacros.carbsG}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-muted py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:w-auto sm:px-6"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
