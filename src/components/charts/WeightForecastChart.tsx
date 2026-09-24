"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  calculateWeightForecast,
  type WeightDataPoint,
  type CalorieDataPoint,
} from "@/lib/nutrition/forecast";
import { Sparkles, TrendingDown, TrendingUp, Info } from "lucide-react";

interface WeightForecastChartProps {
  weightHistory: WeightDataPoint[];
  calorieHistory: CalorieDataPoint[];
  tdee: number;
  targetCalories: number;
  targetWeightKg?: number | null;
}

type ScenarioFilter = "actual" | "target" | "all";

export function WeightForecastChart({
  weightHistory,
  calorieHistory,
  tdee,
  targetCalories,
  targetWeightKg,
}: WeightForecastChartProps) {
  const [scenario, setScenario] = useState<ScenarioFilter>("actual");

  const forecast = useMemo(
    () =>
      calculateWeightForecast({
        weightHistory,
        calorieHistory,
        tdee,
        targetCalories,
        targetWeightKg,
        forecastDays: 45,
      }),
    [weightHistory, calorieHistory, tdee, targetCalories, targetWeightKg]
  );

  // Формируем объединённый ряд данных: последние 14 дней истории + 45 дней прогноза
  const chartData = useMemo(() => {
    const points: Array<{
      date: string;
      label: string;
      rawWeight?: number;
      trendWeight?: number;
      actualPace?: number;
      targetPace?: number;
      maintenance?: number;
      lowerBound?: number;
      upperBound?: number;
    }> = [];

    // Последние 14 точек истории
    const recentHistory = forecast.historyTrend.slice(-14);
    for (const h of recentHistory) {
      points.push({
        date: h.date,
        label: new Date(h.date + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }),
        rawWeight: h.actualWeight,
        trendWeight: h.trendWeight,
      });
    }

    // Точка стыковки истории и прогноза
    if (points.length > 0 && forecast.currentTrendWeight) {
      const last = points[points.length - 1];
      last.actualPace = forecast.currentTrendWeight;
      last.targetPace = forecast.currentTrendWeight;
      last.maintenance = forecast.currentTrendWeight;
      last.lowerBound = forecast.currentTrendWeight;
      last.upperBound = forecast.currentTrendWeight;
    }

    // Прогнозные точки (берём каждую 3-ю для аккуратности графика)
    const sampledForecast = forecast.forecastPoints.filter((_, idx) => idx % 3 === 0);
    for (const f of sampledForecast) {
      points.push({
        date: f.date,
        label: new Date(f.date + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }),
        actualPace: f.actualPaceWeight,
        targetPace: f.targetPaceWeight,
        maintenance: f.maintenanceWeight,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
      });
    }

    return points;
  }, [forecast]);

  if (weightHistory.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        Добавьте хотя бы одно взвешивание, чтобы включить умный прогноз веса.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-soft p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-bold">Прогноз изменения веса</h2>
            <p className="text-xs text-muted-foreground">Физиологическая модель энергобаланса</p>
          </div>
        </div>

        {/* Переключатель сценариев */}
        <div className="flex rounded-xl bg-muted p-1 text-xs font-medium">
          <button
            onClick={() => setScenario("actual")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              scenario === "actual" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            Фактический темп
          </button>
          <button
            onClick={() => setScenario("target")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              scenario === "target" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            По плану
          </button>
          <button
            onClick={() => setScenario("all")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              scenario === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">Истинный тренд веса</div>
          <div className="mt-0.5 text-lg font-bold">
            {forecast.currentTrendWeight?.toFixed(1).replace(".", ",")} кг
          </div>
          <div className="text-xs text-muted-foreground">сглаженный тренд</div>
        </div>

        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">
            {forecast.hasSufficientActualData ? "Фактический темп" : "Темп (по плану)"}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-lg font-bold">
            {forecast.actualWeeklyChangeKg < 0 ? (
              <TrendingDown className="h-4 w-4 text-primary" />
            ) : forecast.actualWeeklyChangeKg > 0 ? (
              <TrendingUp className="h-4 w-4 text-warning" />
            ) : null}
            {forecast.actualWeeklyChangeKg > 0 ? "+" : ""}
            {forecast.actualWeeklyChangeKg.toFixed(2).replace(".", ",")} кг/нед
          </div>
          <div className="text-xs text-muted-foreground">
            {forecast.hasSufficientActualData
              ? `дефицит ${forecast.actualDailyDeficit > 0 ? `${forecast.actualDailyDeficit} ккал` : "нет"}`
              : "план питания (<3 дн.)"}
          </div>
        </div>

        {targetWeightKg && (
          <div className="col-span-2 rounded-2xl bg-muted/40 p-3 sm:col-span-1">
            <div className="text-xs text-muted-foreground">Целевой вес</div>
            <div className="mt-0.5 text-lg font-bold">{targetWeightKg} кг</div>
            <div className="truncate text-xs text-muted-foreground">
              {forecast.estimatedTargetDate
                ? `к ${new Date(forecast.estimatedTargetDate + "T12:00:00").toLocaleDateString("ru-RU", {
                    month: "short",
                    year: "numeric",
                  })}`
                : "в процессе"}
            </div>
          </div>
        )}
      </div>

      {/* График */}
      <div className="h-60 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["dataMin - 1", "dataMax + 1"]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const num = Number(value);
                if (name === "rawWeight") return [`${num.toFixed(1)} кг`, "Замер веса"];
                if (name === "trendWeight") return [`${num.toFixed(1)} кг`, "Сглаженный тренд"];
                if (name === "actualPace") return [`${num.toFixed(1)} кг`, "Текущий темп"];
                if (name === "targetPace") return [`${num.toFixed(1)} кг`, "По целевому плану"];
                if (name === "maintenance") return [`${num.toFixed(1)} кг`, "Поддержание"];
                return [value, name];
              }}
            />

            {/* Коридор естественных колебаний */}
            {(scenario === "actual" || scenario === "all") && (
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill="var(--primary)"
                fillOpacity={0.08}
              />
            )}

            {/* Замеры (точки) */}
            <Line
              type="monotone"
              dataKey="rawWeight"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={{ r: 2.5, fill: "var(--muted-foreground)" }}
              name="rawWeight"
            />

            {/* Сглаженная линия истории */}
            <Line
              type="monotone"
              dataKey="trendWeight"
              stroke="var(--foreground)"
              strokeWidth={2.5}
              dot={false}
              name="trendWeight"
            />

            {/* Сценарий: текущий темп */}
            {(scenario === "actual" || scenario === "all") && (
              <Line
                type="monotone"
                dataKey="actualPace"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="actualPace"
              />
            )}

            {/* Сценарий: по плану */}
            {(scenario === "target" || scenario === "all") && (
              <Line
                type="monotone"
                dataKey="targetPace"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                name="targetPace"
              />
            )}

            {/* Сценарий: поддержание */}
            {scenario === "all" && (
              <Line
                type="monotone"
                dataKey="maintenance"
                stroke="#6b7280"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
                name="maintenance"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Поясняющая плашка */}
      <div className="flex items-start gap-2 rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">{forecast.message}</p>
          <p className="mt-0.5">
            Полупрозрачный коридор отражает естественные суточные колебания жидкости и соли (±0.7 кг).
          </p>
        </div>
      </div>
    </div>
  );
}
