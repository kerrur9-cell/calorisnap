"use client";

import React from "react";
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

export interface ChartDataItem {
  date: string;
  label: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface WeightDataItem {
  date: string;
  weight: number;
}

interface StatsChartsSectionProps {
  chartData: ChartDataItem[];
  weightData: WeightDataItem[];
  goal: number;
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  payload?: { calories?: number };
}

/** Бар, краснеющий при превышении цели калорий */
function BarShape({
  x,
  y,
  width,
  height,
  fill,
  payload,
  goal,
}: BarShapeProps & { goal: number }) {
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

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md transition-all">
      <h2 className="mb-3 font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function StatsChartsSection({
  chartData,
  weightData,
  goal,
}: StatsChartsSectionProps) {
  return (
    <div className="space-y-4">
      {/* Калории */}
      <ChartCard title="Калории">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
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
              shape={(props: unknown) => (
                <BarShape {...(props as BarShapeProps)} goal={goal} />
              )}
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
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: 12,
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="protein"
              stackId="m"
              fill="var(--protein)"
              radius={[0, 0, 0, 0]}
            />
            <Bar dataKey="fat" stackId="m" fill="var(--fat)" />
            <Bar
              dataKey="carbs"
              stackId="m"
              fill="var(--carbs)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Вес */}
      {weightData.length > 0 && (
        <ChartCard title="Вес тела">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
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
    </div>
  );
}
