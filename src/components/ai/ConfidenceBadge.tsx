"use client";

import { confidenceLevel, confidenceLabel } from "@/lib/ai/schema";
import { cn } from "@/lib/utils";

/**
 * Бейдж уверенности AI. Зелёный/жёлтый/красный — честность перед пользователем:
 * если модель не уверена, это видно сразу, без права изменить своё мнение.
 */
export function ConfidenceBadge({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const level = confidenceLevel(value);
  const label = confidenceLabel(value);
  const percent = Math.round(value * 100);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        level === "high" && "bg-primary-soft text-primary",
        level === "medium" && "bg-warning-soft text-warning",
        level === "low" && "bg-danger-soft text-danger",
        className,
      )}
    >
      {label} · {percent}%
    </span>
  );
}