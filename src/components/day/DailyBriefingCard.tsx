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
      className="glass-card relative overflow-hidden rounded-3xl p-4 shadow-xs transition-all duration-300 animate-blur-reveal"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-xl p-2 shrink-0 ${
              isMorning
                ? "bg-amber-500/15 text-amber-500"
                : "bg-indigo-500/15 text-indigo-400"
            }`}
          >
            {isMorning ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {briefing.title}
              </span>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                AI
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-0.5">{briefing.headline}</h3>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label={isExpanded ? "Свернуть брифинг" : "Развернуть брифинг"}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Компактная полоса фокуса дня */}
      <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <Target className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate font-medium text-foreground">{briefing.recommendedFocus}</span>
      </div>

      {/* Развернутые пункты анализа */}
      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3 text-xs">
          <div className="space-y-1.5 text-muted-foreground">
            {briefing.keyPoints.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <p className="leading-relaxed text-foreground">{point}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 text-[11px] text-muted-foreground">
            <span>Прогресс калорий: {briefing.calorieProgressPercent}%</span>
            <span>Прогресс белка: {briefing.proteinProgressPercent}%</span>
          </div>
        </div>
      )}
    </section>
  );
}
