"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { addDays, todayKey } from "@/lib/utils";
import { calculateTdee } from "@/lib/nutrition/tdee";
import { SmartInsightsCard } from "@/components/stats/SmartInsightsCard";
import type { MealHistoryEntry } from "@/lib/nutrition/personalization";
import { useFriendView } from "@/context/FriendViewContext";
import dynamic from "next/dynamic";

const StatsChartsSection = dynamic(
  () => import("@/components/stats/StatsChartsSection").then((m) => m.StatsChartsSection),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-56 rounded-3xl bg-card/60 border border-border animate-pulse" />
        <div className="h-52 rounded-3xl bg-card/60 border border-border animate-pulse" />
      </div>
    ),
  }
);

const WeightForecastChart = dynamic(
  () => import("@/components/charts/WeightForecastChart").then((m) => m.WeightForecastChart),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded-2xl bg-card border border-border animate-pulse" />,
  }
);

const WeeklyReviewCard = dynamic(
  () => import("@/components/stats/WeeklyReviewCard").then((m) => m.WeeklyReviewCard),
  {
    ssr: false,
    loading: () => <div className="h-32 rounded-2xl bg-card border border-border animate-pulse" />,
  }
);

const ExperimentDashboard = dynamic(
  () => import("@/components/experiments/ExperimentDashboard").then((m) => m.ExperimentDashboard),
  {
    ssr: false,
    loading: () => <div className="h-32 rounded-2xl bg-card border border-border animate-pulse" />,
  }
);

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background pb-24" />}>
      <StatsFlow />
    </Suspense>
  );
}

type Period = "week" | "month";

function StatsFlow() {
  const [period, setPeriod] = useState<Period>("week");
  const { targetUserId } = useFriendView();
  const { data: profile } = useProfile();
  const goal = profile?.daily_calorie_target ?? 2000;

  const days = useMemo(() => {
    const n = period === "week" ? 7 : 30;
    const today = todayKey();
    return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
  }, [period]);

  const { data: calories, error, isLoading } = useQuery({
    queryKey: ["stats", period, days[0], targetUserId ?? "self"],
    queryFn: async () => {
      const supabase = createClient();
      let effectiveId = targetUserId;
      if (!effectiveId) {
        const { data: { user } } = await supabase.auth.getUser();
        effectiveId = user?.id ?? null;
      }

      let statsQuery = supabase
        .from("daily_stats")
        .select("*")
        .gte("entry_date", days[0])
        .lte("entry_date", days[days.length - 1]);
      if (effectiveId) statsQuery = statsQuery.eq("user_id", effectiveId);

      let weightsQuery = supabase
        .from("weight_entries")
        .select("weight_kg, recorded_at")
        .gte("recorded_at", days[0])
        .lte("recorded_at", days[days.length - 1]);
      if (effectiveId) weightsQuery = weightsQuery.eq("user_id", effectiveId);

      let mealsQuery = supabase
        .from("meal_entries")
        .select("id, meal_type, entry_date, logged_at, meal_items(id, custom_food_name, weight_grams, calories, protein_g, fat_g, carbs_g)")
        .gte("entry_date", days[0])
        .lte("entry_date", days[days.length - 1]);
      if (effectiveId) mealsQuery = mealsQuery.eq("user_id", effectiveId);

      const [stats, weights, meals] = await Promise.all([
        statsQuery.order("entry_date"),
        weightsQuery.order("recorded_at", { ascending: true }),
        mealsQuery,
      ]);
      if (stats.error) throw stats.error;
      if (weights.error) throw weights.error;
      if (meals.error) throw meals.error;
      return {
        stats: stats.data ?? [],
        weights: weights.data ?? [],
        meals: (meals.data ?? []) as unknown as MealHistoryEntry[],
      };
    },
    staleTime: 60 * 1000,
  });

  const chartData = useMemo(() => {
    const statsMap = new Map((calories?.stats ?? []).map((s) => [s.entry_date, s]));
    return days.map((d) => {
      const stat = statsMap.get(d);
      return {
        date: d,
        label: new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }),
        calories: Number(stat?.total_calories ?? 0),
        protein: Number(stat?.total_protein ?? 0),
        fat: Number(stat?.total_fat ?? 0),
        carbs: Number(stat?.total_carbs ?? 0),
      };
    });
  }, [calories, days]);

  const weightData = useMemo(
    () =>
      (calories?.weights ?? []).map((w) => ({
        date: w.recorded_at!,
        weight: Number(w.weight_kg),
      })),
    [calories],
  );

  const avgCalories = useMemo(() => {
    const withFood = chartData.filter((d) => d.calories > 0);
    if (withFood.length === 0) return 0;
    return Math.round(
      withFood.reduce((a, d) => a + d.calories, 0) / withFood.length,
    );
  }, [chartData]);

  const weightDelta = useMemo(() => {
    if (weightData.length < 2) return 0;
    const first = weightData[0].weight;
    const last = weightData[weightData.length - 1].weight;
    return Math.round((last - first) * 100) / 100;
  }, [weightData]);

  const userTdee = useMemo(() => {
    if (
      profile?.gender &&
      profile?.birth_date &&
      profile?.height_cm &&
      profile?.current_weight_kg &&
      profile?.activity_level &&
      profile?.goal
    ) {
      try {
        const [y, m, d] = profile.birth_date.split("-").map(Number);
        const birth = new Date(y, m - 1, d);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
        const res = calculateTdee({
          gender: profile.gender,
          age,
          heightCm: profile.height_cm,
          weightKg: profile.current_weight_kg,
          activityLevel: profile.activity_level,
          goal: profile.goal,
        });
        return res.tdee;
      } catch {
        return (profile.daily_calorie_target ?? 2000) + 400;
      }
    }
    return (profile?.daily_calorie_target ?? 2000) + 400;
  }, [profile]);

  if (error) return <main className="p-6" role="alert">Не удалось загрузить статистику. Проверьте подключение и обновите страницу.</main>;
  if (isLoading) return <main className="p-6">Загружаем статистику…</main>;
  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-8">
      <header className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Статистика</h1>
        <PeriodToggle period={period} onChange={setPeriod} />
      </header>

      {/* Сводка */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          label="Средние калории"
          value={`${avgCalories}`}
          unit="ккал/день"
          hint={`цель ${goal}`}
        />
        <StatCard
          label="Белок в среднем"
          value={`${Math.round(chartData.filter((d) => d.protein > 0).reduce((sum, d) => sum + d.protein, 0) / Math.max(1, chartData.filter((d) => d.protein > 0).length))}`}
          unit="г/день"
          hint={`цель ${profile?.daily_protein_g ?? 120}`}
        />
        <StatCard
          label="Изменение веса"
          value={`${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(2).replace(".", ",")}`}
          unit="кг за период"
          hint={weightData.length < 2 ? "добавьте ещё запись веса" : ""}
          accent={weightDelta !== 0}
        />
        <StatCard
          label="Дней с записями"
          value={`${calories?.stats.length ?? 0}`}
          unit={`из ${days.length}`}
        />
      </div>

      {/* Интерактивные графики (динамически загружаемый легковесный чанк) */}
      <StatsChartsSection
        chartData={chartData}
        weightData={weightData}
        goal={goal}
      />

      {/* Прогноз веса */}
      <div className="mt-6">
        <WeightForecastChart
          weightHistory={(calories?.weights ?? []).map((w) => ({
            date: w.recorded_at!,
            weightKg: Number(w.weight_kg),
          }))}
          calorieHistory={(calories?.stats ?? []).map((s) => ({
            date: s.entry_date!,
            calories: Number(s.total_calories ?? 0),
          }))}
          tdee={userTdee}
          targetCalories={goal}
          targetWeightKg={profile?.target_weight_kg}
        />
      </div>

      {/* Умные инсайты динамики тела */}
      <div className="mt-6">
        <SmartInsightsCard
          weights={(calories?.weights ?? []).map((w) => ({
            date: w.recorded_at!,
            weightKg: Number(w.weight_kg),
          }))}
          nutritionHistory={(calories?.stats ?? []).map((s) => ({
            date: s.entry_date!,
            consumedCalories: Number(s.total_calories ?? 0),
            targetCalories: goal,
            carbsG: Number(s.total_carbs ?? 0),
          }))}
        />
      </div>

      {/* Еженедельный AI-разбор рациона */}
      <div className="mt-6">
        <WeeklyReviewCard
          dailyStats={(calories?.stats ?? []).map((s) => ({
            entry_date: s.entry_date!,
            total_calories: Number(s.total_calories ?? 0),
            total_protein: Number(s.total_protein ?? 0),
            total_fat: Number(s.total_fat ?? 0),
            total_carbs: Number(s.total_carbs ?? 0),
          }))}
          meals={calories?.meals ?? []}
          targetCalories={goal}
          targetProteinG={profile?.daily_protein_g ?? 120}
        />
      </div>

      {/* Режим экспериментов (диеты и протоколы) */}
      <div className="mt-6 mb-8">
        <ExperimentDashboard
          dayLogs={(calories?.stats ?? []).map((s) => ({
            date: s.entry_date!,
            totals: {
              calories: Number(s.total_calories ?? 0),
              proteinG: Number(s.total_protein ?? 0),
              fatG: Number(s.total_fat ?? 0),
              carbsG: Number(s.total_carbs ?? 0),
            },
            targets: {
              proteinG: profile?.daily_protein_g ?? 120,
              fatG: profile?.daily_fat_g ?? 70,
              carbsG: profile?.daily_carbs_g ?? 200,
            },
            targetCalories: goal,
            meals: {
              entry_date: s.entry_date!,
              meal_type: "lunch",
              meal_items: [],
            },
          }))}
          currentWeightKg={profile?.current_weight_kg ?? undefined}
        />
      </div>
    </main>
  );
}


function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex rounded-full bg-muted/70 p-1 text-sm border border-border/60 shadow-2xs">
      {(
        [
          ["week", "Неделя"],
          ["month", "Месяц"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`btn-glossy spring-press rounded-full px-4 py-1.5 font-medium transition-all ${
            period === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 shadow-xs border border-border/60 bg-card/75 backdrop-blur-xl transition-all">
      <div className="text-xs font-medium text-muted-foreground truncate">{label}</div>
      <div className={`text-2xl font-extrabold tracking-tight tabular-nums mt-0.5 ${accent && value.startsWith("-") ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{unit}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground/80 truncate">{hint}</div>}
    </div>
  );
}
