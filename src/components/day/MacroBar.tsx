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
  const barColor = over ? "var(--danger)" : `var(--${color})`;

  const dotColorClass =
    color === "protein"
      ? "bg-sky-400"
      : color === "fat"
        ? "bg-amber-400"
        : "bg-emerald-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", dotColorClass)} />
          <span className="font-semibold text-foreground/90">{label}</span>
        </div>
        <div className="tabular-nums text-xs text-muted-foreground">
          <span className={cn("font-bold text-foreground", over && "text-danger")}>
            {Math.round(value)}
          </span>
          <span className="mx-1 opacity-60">/</span>
          <span>{target}</span>
          <span className="ml-1 text-[11px] opacity-75">{suffix}</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className="macro-glossy h-full rounded-full shadow-xs transition-all duration-700 ease-out"
          style={{ width: `${Math.min(percent, 100)}%`, background: `linear-gradient(to right, color-mix(in srgb, ${barColor} 80%, transparent), ${barColor})` }}
        />
      </div>
    </div>
  );
}
