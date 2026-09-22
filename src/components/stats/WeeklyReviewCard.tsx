"use client";

import { useState } from "react";
import { Sparkles, Calendar, ChevronDown, ChevronUp, Loader2, CheckCircle2, Target } from "lucide-react";
import {
  computeWeeklyReview,
  type DayStatItem,
} from "@/lib/nutrition/weeklyReview";
import type { MealHistoryEntry } from "@/lib/nutrition/personalization";

interface WeeklyReviewCardProps {
  dailyStats: DayStatItem[];
  meals: MealHistoryEntry[];
  targetCalories: number;
  targetProteinG: number;
}

interface AiReviewDetails {
  summaryHeadline: string;
  deepAnalysis: string;
  keyStrength: string;
  nextWeekFocus: string;
  habitChallenge: string;
}

export function WeeklyReviewCard({
  dailyStats,
  meals,
  targetCalories,
  targetProteinG,
}: WeeklyReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiReview, setAiReview] = useState<AiReviewDetails | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const review = computeWeeklyReview(dailyStats, meals, targetCalories, targetProteinG);

  if (review.daysLogged < 3) return null;

  async function handleLoadAiReview() {
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avgCalories: review.avgCalories,
          targetCalories: review.targetCalories,
          adherencePercent: review.adherencePercent,
          avgProteinG: review.avgProteinG,
          targetProteinG: review.targetProteinG,
          weekendVsWeekdayDeltaKcal: review.weekendVsWeekdayDeltaKcal,
          topCalorieMeals: review.topCalorieMeals,
          daysLogged: review.daysLogged,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAiReview(data);
        setIsExpanded(true);
      }
    } catch {
      // Игнорируем
    } finally {
      setIsLoadingAi(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-primary-soft p-2 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold">Итоги недели</h3>
            <p className="text-xs text-muted-foreground">{review.daysLogged} из 7 дней с записями</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 transition-colors"
          aria-label={isExpanded ? "Свернуть" : "Развернуть"}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Ключевые показатели недели */}
      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
        <div className="rounded-xl bg-muted/40 p-2.5 text-center">
          <div className="font-bold text-sm tabular-nums">{review.avgCalories}</div>
          <div className="text-[11px] text-muted-foreground">средние ккал</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5 text-center">
          <div className="font-bold text-sm tabular-nums text-primary">{review.adherencePercent}%</div>
          <div className="text-[11px] text-muted-foreground">в цели нормы</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5 text-center">
          <div className="font-bold text-sm tabular-nums">{review.avgProteinG} г</div>
          <div className="text-[11px] text-muted-foreground">средний белок</div>
        </div>
      </div>

      {/* Быстрое резюме */}
      <p className="text-xs leading-relaxed text-muted-foreground pt-1">
        {review.instantSummary}
      </p>

      {/* Кнопка AI разбора */}
      {!aiReview && (
        <button
          onClick={handleLoadAiReview}
          disabled={isLoadingAi}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft/50 py-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary-soft"
        >
          {isLoadingAi ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Генерирую AI-анализ недели...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Глубокий AI-разбор недели
            </>
          )}
        </button>
      )}

      {/* Развёрнутый AI разбор */}
      {isExpanded && aiReview && (
        <div className="mt-3 space-y-3 border-t border-border/40 pt-3 text-xs">
          <div className="rounded-xl bg-primary-soft/40 p-3">
            <div className="font-bold text-foreground">{aiReview.summaryHeadline}</div>
            <p className="mt-1.5 leading-relaxed text-muted-foreground whitespace-pre-line">
              {aiReview.deepAnalysis}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Главная сила: </span>
                <span className="text-muted-foreground">{aiReview.keyStrength}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Фокус следующей недели: </span>
                <span className="text-muted-foreground">{aiReview.nextWeekFocus}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-600">Мини-челлендж: </span>
                <span className="text-foreground">{aiReview.habitChallenge}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
