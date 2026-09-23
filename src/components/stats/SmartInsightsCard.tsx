"use client";

import { Droplets, Activity, Flame, ShieldAlert, Sparkles, Lightbulb, Target } from "lucide-react";
import {
  evaluateSmartProgressInsights,
  type WeightRecord,
  type DayCalorieRecord,
} from "@/lib/nutrition/insights";

interface SmartInsightsCardProps {
  weights: WeightRecord[];
  nutritionHistory: DayCalorieRecord[];
}

export function SmartInsightsCard({ weights, nutritionHistory }: SmartInsightsCardProps) {
  const insights = evaluateSmartProgressInsights(weights, nutritionHistory);

  const hasAnyInsight =
    insights.waterRetention.detected ||
    insights.plateau.detected ||
    (insights.realFatLoss && insights.realFatLoss.estimatedFatLossKg > 0);

  if (!hasAnyInsight) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Умные инсайты динамики тела</h3>
      </div>

      {/* Задержка воды */}
      {insights.waterRetention.detected && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-sky-500">
            <Droplets className="h-4 w-4 shrink-0" />
            <span>Задержка воды: +{insights.waterRetention.weightDeltaKg} кг</span>
          </div>
          <p className="mt-1.5 leading-relaxed text-muted-foreground">
            {insights.waterRetention.message}
          </p>
          {insights.waterRetention.recommendation && (
            <p className="mt-1.5 flex items-start gap-1.5 font-medium text-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{insights.waterRetention.recommendation}</span>
            </p>
          )}
        </div>
      )}

      {/* Детекция истинного плато */}
      {insights.plateau.detected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-amber-500">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Физиологическое плато ({insights.plateau.daysStalled} дней)</span>
          </div>
          <p className="mt-1.5 leading-relaxed text-muted-foreground">
            {insights.plateau.message}
          </p>
          <div className="mt-2 rounded-lg bg-background/80 p-2.5 text-foreground font-medium flex items-start gap-1.5">
            <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            {insights.plateau.actionRecommendation === "refeed" ? (
              <span>
                <strong>Рекомендация: Рефид (Diet Break)</strong> на 2 дня — увеличьте калории до нормы поддержания (TDEE) за счёт сложных углеводов. Это нормализует лептин и разблокирует дальнейший сброс.
              </span>
            ) : (
              <span>
                <strong>Рекомендация:</strong> Пересчитайте TDEE в калькуляторе с учётом нового снизившегося веса.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Реальная потеря чистого жира по дефициту */}
      {insights.realFatLoss && insights.realFatLoss.estimatedFatLossKg > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft p-1.5 text-primary">
              <Flame className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold">
                Сгорело чистого жира: ~{insights.realFatLoss.estimatedFatLossKg} кг
              </div>
              <div className="text-muted-foreground text-[11px]">
                Накопленный дефицит: {insights.realFatLoss.cumulativeDeficitKcal} ккал
              </div>
            </div>
          </div>
          <div className="text-right tabular-nums text-muted-foreground text-[11px]">
            <div className="flex items-center gap-1 justify-end">
              <Activity className="h-3 w-3 text-primary" />
              <span>По весам: {insights.realFatLoss.scaleWeightChangeKg > 0 ? `+${insights.realFatLoss.scaleWeightChangeKg}` : insights.realFatLoss.scaleWeightChangeKg} кг</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
