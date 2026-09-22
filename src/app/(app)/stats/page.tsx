"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { addDays, todayKey } from "@/lib/utils";
import { calculateTdee } from "@/lib/nutrition/tdee";
import { SmartInsightsCard } from "@/components/stats/SmartInsightsCard";
import type { MealHistoryEntry } from "@/lib/nutrition/personalization";
import dynamic from "next/dynamic";

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
  const { data: profile } = useProfile();
  const goal = profile?.daily_calorie_target ?? 2000;

  const days = useMemo(() => {
    const n = period === "week" ? 7 : 30;
    const today = todayKey();
    return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
  }, [period]);

  const { data: calories, error, isLoading } = useQuery({
    queryKey: ["stats", period, days[0]],
    queryFn: async () => {
      const supabase = createClient();
      const [stats, weights, meals] = await Promise.all([
        supabase
          .from("daily_stats")
          .select("*")
          .gte("entry_date", days[0])
          .lte("entry_date", days[days.length - 1])
          .order("entry_date"),
        supabase
          .from("weight_entries")
          .select("weight_kg, recorded_at")
          .gte("recorded_at", days[0])
          .lte("recorded_at", days[days.length - 1])
          .order("recorded_at", { ascending: true }),
        supabase
          .from("meal_entries")
          .select("id, meal_type, entry_date, logged_at, meal_items(id, custom_food_name, weight_grams, calories, protein_g, fat_g, carbs_g)")
          .gte("entry_date", days[0])
          .lte("entry_date", days[days.length - 1]),
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

      {/* Калории */}
      <ChartCard title="Калории">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, goal * 1.3]} />
            <Tooltip
              formatter={(value) => `${value} ккал`}
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: 12,
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="calories"
              radius={[6, 6, 0, 0]}
              fill="var(--primary)"
              // перекрашиваем дни с перебором
              shape={(props: unknown) => <BarShape {...(props as BarShapeProps)} goal={goal} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* БЖУ */}
      <ChartCard title="БЖУ по дням">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: 12, fontSize: 13 }}
            />
            <Bar dataKey="protein" stackId="m" fill="var(--protein)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="fat" stackId="m" fill="var(--fat)" />
            <Bar dataKey="carbs" stackId="m" fill="var(--carbs)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Вес */}
      {weightData.length > 0 && (
        <ChartCard title="Вес тела">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--primary)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

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

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  payload?: { calories?: number };
}

/** Бар, краснеющий при превышении цели */
function BarShape({ x, y, width, height, fill, payload, goal }: BarShapeProps & { goal: number }) {
  const over = (payload?.calories ?? 0) > goal;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={6}
      fill={over ? "var(--danger)" : fill}
    />
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md transition-all">
      <h2 className="mb-3 font-semibold text-foreground">{title}</h2>
      {children}
    </section>
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
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent && value.startsWith("-") ? "text-primary" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{unit}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
