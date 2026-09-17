import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Округление до одного знака без «хвостов» вроде 0.30000000000000004 */
export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Дата в формате YYYY-MM-DD в локальной таймзоне (не UTC!) */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** «16 сентября, среда» */
export function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

/** «16 сентября» */
export function formatShortDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** «Сегодня» / «Вчера» / дата */
export function humanDateRu(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return "Сегодня";
  if (dateKey === addDays(today, -1)) return "Вчера";
  if (dateKey === addDays(today, 1)) return "Завтра";
  return formatDateRu(dateKey);
}

export const MEAL_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
} as const;

export const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealType = keyof typeof MEAL_LABELS;
