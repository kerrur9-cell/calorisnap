"use client";

import { useState } from "react";
import { Sun, Moon, ChevronDown, ChevronUp, Sparkles, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { addDays } from "@/lib/utils";
import { generateDailyBriefing, type YesterdayStats } from "@/lib/nutrition/briefing";
import type { DayTotals, MacroTargets } from "@/lib/nutrition/macros";

interface DailyBriefingCardProps {
  dateKey: string;
  consumedTotals: DayTotals;
  calorieGoal: number;
  macroTargets: MacroTargets;
  userName?: string | null;
}

export function DailyBriefingCard({
  dateKey,
  consumedTotals,
  calorieGoal,
  macroTargets,
  userName,
}: DailyBriefingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Загружаем статистику вчерашнего дня для утреннего контекста
  const yesterdayKey = addDays(dateKey, -1);
  const { data: yesterdayStats } = useQuery({
    queryKey: ["yesterday_stats", yesterdayKey],
    queryFn: async (): Promise<YesterdayStats | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("daily_stats")
        .select("total_calories, total_protein")
        .eq("entry_date", yesterdayKey)
        .maybeSingle();

      if (error || !data) return null;

      return {
        totalCalories: data.total_calories ?? 0,
        targetCalories: calorieGoal,
        totalProtein: data.total_protein ?? 0,
        targetProtein: macroTargets.proteinG,
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const briefing = generateDailyBriefing({
    todayConsumed: consumedTotals,
    calorieGoal,
    macroTargets,
    yesterdayStats,
    userName,
  });

  const isMorning = briefing.type === "morning";

  return (
    <section
      aria-label="AI Брифинг дня"
      className="glass-card glossy-sheen scroll-sway relative overflow-hidden rounded-3xl p-4.5 shadow-md transition-all duration-300 animate-blur-reveal"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-2xl p-2.5 shrink-0 border ${
              isMorning
                ? "bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-xs"
                : "bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-xs"
            }`}
          >
            {isMorning ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {briefing.title}
              </span>
              <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary shadow-2xs">
                AI
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-0.5 leading-snug">{briefing.headline}</h3>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors shrink-0 spring-press"
          aria-label={isExpanded ? "Свернуть брифинг" : "Развернуть брифинг"}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Интерактивная карточка рекомендации — полный текст без обрезания + раскрытие по тапу */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-background/70 border border-border/80 p-3 text-xs shadow-2xs hover:border-primary/40 hover:bg-background/90 transition-all cursor-pointer group select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary animate-pulse-soft" />
            <span className="text-[11px] uppercase tracking-wider">
              {isMorning ? "Фокус утра" : "Рекомендация на вечер"}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
            {isExpanded ? "Свернуть" : "Подробнее"}
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </div>

        {/* Полный текст рекомендации — никогда не обрезается и переносится комфортно */}
        <p className="text-xs font-medium text-foreground leading-relaxed break-words">
          {briefing.recommendedFocus}
        </p>
      </div>

      {/* Развернутые пункты анализа */}
      {isExpanded && (
        <div className="mt-3 space-y-2.5 border-t border-border/50 pt-3 text-xs animate-blur-reveal">
          <div className="space-y-2 text-muted-foreground">
            {briefing.keyPoints.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl bg-background/50 p-2.5 border border-border/40">
                <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="leading-relaxed text-foreground font-normal">{point}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 text-[11px] font-medium text-muted-foreground px-1">
            <span>Прогресс калорий: <strong className="text-foreground">{briefing.calorieProgressPercent}%</strong></span>
            <span>Прогресс белка: <strong className="text-foreground">{briefing.proteinProgressPercent}%</strong></span>
          </div>
        </div>
      )}
    </section>
  );
}
