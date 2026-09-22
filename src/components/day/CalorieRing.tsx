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
  const isNearLimit = !overLimit && target - current < target * 0.15;
  const glowColor = overLimit
    ? "rgba(255, 59, 48, 0.45)"
    : isNearLimit
      ? "rgba(255, 149, 0, 0.4)"
      : "rgba(52, 199, 89, 0.4)";

  return (
    <div
      className="relative flex items-center justify-center animate-blur-reveal"
      style={{ width: size, height: size }}
    >
      {/* Мягкое фоновое рассеянное свечение (Atmospheric Ring Glow) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-6 rounded-full blur-2xl transition-all duration-700 -z-10",
          overLimit
            ? "bg-danger/15"
            : isNearLimit
              ? "bg-warning/15"
              : "bg-primary/15",
        )}
      />

      <svg
        width={size}
        height={size}
        className="-rotate-90 transform-gpu"
        style={{
          filter: `drop-shadow(0 0 12px ${glowColor})`,
          transition: "filter 0.7s ease",
        }}
      >
        {/* Фон */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          className="opacity-60"
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
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span
          className={cn(
            "text-4xl font-black tracking-tight tabular-nums transition-transform duration-300",
            overLimit && "text-danger",
          )}
        >
          {Math.round(current)}
        </span>
        <span className="text-sm font-medium text-muted-foreground mt-0.5">
          из {target} ккал
        </span>
        <span
          className={cn(
            "mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-500",
            overLimit
              ? "bg-danger-soft text-danger"
              : isNearLimit
                ? "bg-warning-soft text-warning"
                : "bg-primary-soft text-primary",
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