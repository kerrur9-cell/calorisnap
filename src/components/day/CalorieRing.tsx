"use client";

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
  const statusColor = overLimit
    ? "var(--danger)"
    : isNearLimit
      ? "var(--warning)"
      : "var(--calories)";
  const statusSoft = overLimit
    ? "var(--danger-soft)"
    : isNearLimit
      ? "var(--warning-soft)"
      : "color-mix(in srgb, var(--calories) 16%, transparent)";

  return (
    <div
      className="relative flex items-center justify-center animate-blur-reveal scroll-sway-subtle"
      style={{ width: size, height: size }}
    >
      {/* Мягкое фоновое рассеянное свечение (Atmospheric Ring Glow) */}
      <div
        className="pointer-events-none absolute inset-6 -z-10 rounded-full blur-2xl transition-all duration-700"
        style={{ backgroundColor: `color-mix(in srgb, ${statusColor} 18%, transparent)` }}
      />

      <svg
        width={size}
        height={size}
        className="-rotate-90 transform-gpu"
        style={{
          filter: `drop-shadow(0 0 12px color-mix(in srgb, ${statusColor} 45%, transparent))`,
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
          stroke={statusColor}
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
          className="text-4xl font-black tracking-tight tabular-nums transition-colors duration-300"
          style={{ color: overLimit || isNearLimit ? statusColor : "var(--foreground)" }}
        >
          {Math.round(current)}
        </span>
        <span className="text-sm font-medium text-muted-foreground mt-0.5">
          из {target} ккал
        </span>
        <span
          className="mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide shadow-2xs transition-all duration-500"
          style={{ color: statusColor, backgroundColor: statusSoft, borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)` }}
        >
          {overLimit
            ? `+${Math.round(current - target)} ккал`
            : `осталось ${Math.round(target - current)} ккал`}
        </span>
      </div>
    </div>
  );
}
