"use client";

import { cn } from "@/lib/utils";

/**
 * Кольцо калорий — центральный элемент экрана дня.
 * Анимируется при изменении значения.
 */
export function CalorieRing({
  current,
  target,
  size = 200,
}: {
  current: number;
  target: number;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Доля прогресса, но не больше ~108% (не даём кольцу зайти на второй круг)
  const ratio = target > 0 ? Math.min(current / target, 1.08) : 0;
  const offset = circumference * (1 - ratio);

  const overLimit = current > target;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Фон */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        {/* Прогресс */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={overLimit ? "var(--danger)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      {/* Центр */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-4xl font-bold tabular-nums",
            overLimit && "text-danger",
          )}
        >
          {Math.round(current)}
        </span>
        <span className="text-sm text-muted-foreground">
          из {target} ккал
        </span>
        <span
          className={cn(
            "mt-1 text-xs font-medium",
            overLimit
              ? "text-danger"
              : target - current < target * 0.15
                ? "text-warning"
                : "text-primary",
          )}
        >
          {overLimit
            ? `+${Math.round(current - target)} ккал`
            : `осталось ${Math.round(target - current)} ккал`}
        </span>
      </div>
    </div>
  );
}