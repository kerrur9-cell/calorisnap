"use client";

import { cn } from "@/lib/utils";

/**
 * Горизонтальный прогресс-бар макронутриента.
 * Цвет задаётся переменной CSS (--protein/--fat/--carbs).
 */
export function MacroBar({
  label,
  value,
  target,
  color,
  suffix = "г",
}: {
  label: string;
  value: number;
  target: number;
  color: "protein" | "fat" | "carbs";
  suffix?: string;
}) {
  const percent = target > 0 ? (value / target) * 100 : 0;
  const over = percent > 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className={cn("font-semibold", over && "text-danger")}>
            {Math.round(value)}
          </span>
          <span className="mx-1">/</span>
          {target}
          <span className="ml-1">{suffix}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out shadow-xs",
            color === "protein" && "bg-gradient-to-r from-protein/80 to-protein",
            color === "fat" && "bg-gradient-to-r from-fat/80 to-fat",
            color === "carbs" && "bg-gradient-to-r from-carbs/80 to-carbs",
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}