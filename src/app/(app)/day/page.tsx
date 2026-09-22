"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Camera, Droplets, Sparkles, Calculator, ChevronDown, X } from "lucide-react";
import { useDayLog, mealTypeMeta, MEAL_TYPES } from "@/hooks/useDayLog";
import { useProfile } from "@/hooks/useProfile";
import { CalorieRing } from "@/components/day/CalorieRing";
import { MacroBar } from "@/components/day/MacroBar";
import { MealCard } from "@/components/day/MealCard";
import { todayKey, addDays } from "@/lib/utils";
import { FoodAssistant, FoodAssistantBoundary } from "@/components/day/FoodAssistant";
import { sumTotals } from "@/lib/nutrition/macros";
import type { MealType, MealWithItems } from "@/types/database";

/**
 * Главный экран: день пользователя.
 * Кольцо калорий → БЖУ → приёмы пищи → быстрые виджеты.
 */
export default function DayPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [showAssistant, setShowAssistant] = useState(false);
  const isToday = dateKey === todayKey();

  const { data: day, isLoading, error } = useDayLog(dateKey);
  const { data: profile } = useProfile();

  const targetCalories = profile?.daily_calorie_target ?? 2000;
  const macroTargets = {
    protein: profile?.daily_protein_g ?? 120,
    fat: profile?.daily_fat_g ?? 70,
    carbs: profile?.daily_carbs_g ?? 200,
  };

  return (
    <main className="min-h-dvh bg-background px-4 pt-8">
      {/* Шапка с датой */}
      <header className="mb-6 flex items-center justify-between">
        <button
          onClick={() => setDateKey((d) => addDays(d, -1))}
          aria-label="Предыдущий день"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          {isToday && (
            <div className="text-sm text-muted-foreground">Сегодня</div>
          )}
          <div className="text-lg font-bold capitalize">
            {new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
        <button
          onClick={() => setDateKey((d) => addDays(d, 1))}
          disabled={isToday}
          aria-label="Следующий день"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </header>

      {isLoading ? (
        <SkeletonDay />
      ) : error ? (
        <div className="rounded-2xl bg-danger-soft p-4 text-center text-sm text-danger">
          Не удалось загрузить день. Проверьте подключение.
        </div>
      ) : (
        <>
          {/* Кольцо калорий */}
          <section className="mb-6 flex flex-col items-center">
            <CalorieRing current={day?.totals.calories ?? 0} target={targetCalories} />
            {isToday && <button onClick={() => setShowAssistant(true)} className="mt-3 flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> Спросить, что можно съесть</button>}
            {isToday && showAssistant && <FoodAssistantBoundary><FoodAssistant onClose={() => setShowAssistant(false)} /></FoodAssistantBoundary>}
            <Link href="/calculator" className="mt-3 flex items-center gap-1 text-sm text-muted-foreground underline"><Calculator className="h-4 w-4" /> Калькулятор калорий</Link>
          </section>

          {/* БЖУ */}
          <section className="mb-8 space-y-3 rounded-2xl bg-card p-4 shadow-sm">
            <MacroBar
              label="Белки"
              value={day?.totals.proteinG ?? 0}
              target={macroTargets.protein}
              color="protein"
            />
            <MacroBar
              label="Жиры"
              value={day?.totals.fatG ?? 0}
              target={macroTargets.fat}
              color="fat"
            />
            <MacroBar
              label="Углеводы"
              value={day?.totals.carbsG ?? 0}
              target={macroTargets.carbs}
              color="carbs"
            />
          </section>

          {/* Приёмы пищи */}
          <section className="space-y-3">
            {MEAL_TYPES.map((mt) => {
              const meals = (day?.meals ?? []).filter(
                (m) => m.meal_type === mt.value,
              );
              if (meals.length === 0) {
                return (
                  <EmptyMeal
                    key={mt.value}
                    mealType={mt.value}
                    isToday={isToday}
                  />
                );
              }
              return <MealGroup key={mt.value} meals={meals} dateKey={dateKey} mealType={mt.value} isToday={isToday} />;
            })}
          </section>

          {/* Виджет воды */}
          <QuickStats
            waterMl={day?.waterMl ?? 0}
            waterTarget={profile?.daily_water_ml ?? 2000}
          />
        </>
      )}
    </main>
  );
}

/** Одна компактная категория, детали открываются отдельным полноэкранным листом. */
function MealGroup({ meals, dateKey, mealType, isToday }: { meals: MealWithItems[]; dateKey: string; mealType: MealType; isToday: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = mealTypeMeta(mealType);
  const totals = sumTotals(meals.flatMap((meal) => meal.meal_items));
  return <>
    <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted" aria-label={`Открыть ${meta.label}`}>
      <span className="text-2xl">{meta.emoji}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{meta.label}</span><span className="block text-xs text-muted-foreground">{meals.length} {meals.length === 1 ? "блюдо" : "блюда"} · {Math.round(totals.calories)} ккал</span></span><ChevronDown className="h-5 w-5 text-muted-foreground" />
    </button>
    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label={meta.label}>
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6"><header className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-2xl">{meta.emoji}</span><div><h2 className="text-xl font-bold">{meta.label}</h2><p className="text-xs text-muted-foreground">{Math.round(totals.calories)} ккал · Б {totals.proteinG} · Ж {totals.fatG} · У {totals.carbsG}</p></div></div><button onClick={() => setOpen(false)} className="rounded-full bg-muted p-2" aria-label="Закрыть"><X className="h-5 w-5" /></button></header><section className="space-y-3">{meals.map((meal) => <MealCard key={meal.id} meal={meal} dateKey={dateKey} />)}</section>{isToday && <MealAddActions mealType={mealType} />}</main>
    </div>}
  </>;
}

/** Пустая карточка приёма пищи с действиями добавить */
function EmptyMeal({
  mealType,
  isToday,
}: {
  mealType: (typeof MEAL_TYPES)[number]["value"];
  isToday: boolean;
}) {
  const meta = mealTypeMeta(mealType);
  if (!isToday) {
    return null;
  }
  return (
    <div className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-lg">{meta.emoji}</span>
        <span className="font-medium">{meta.label}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={{ pathname: "/camera", query: { meal: mealType } }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          <Camera className="h-4 w-4" /> Фото
        </Link>
        <Link
          href={{ pathname: "/foods", query: { meal: mealType } }}
          className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm"
        >
          <Plus className="h-4 w-4" /> Вручную
        </Link>
      </div>
    </div>
  );
}

function MealAddActions({
  mealType,
}: {
  mealType: (typeof MEAL_TYPES)[number]["value"];
}) {
  const meta = mealTypeMeta(mealType);
  return (
    <div className="-mt-1 flex justify-end gap-2 pr-1">
      <Link
        href={{ pathname: "/camera", query: { meal: mealType } }}
        className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary"
        aria-label={`Добавить фото в ${meta.label}`}
      >
        <Camera className="h-4 w-4" /> Ещё фото
      </Link>
      <Link
        href={{ pathname: "/foods", query: { meal: mealType } }}
        className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm"
        aria-label={`Добавить продукт в ${meta.label}`}
      >
        <Plus className="h-4 w-4" /> Ещё продукт
      </Link>
    </div>
  );
}

/** Быстрые виджеты под дневником */
function QuickStats({
  waterMl,
  waterTarget,
}: {
  waterMl: number;
  waterTarget: number;
}) {
  const waterPct = waterTarget > 0 ? Math.round((waterMl / waterTarget) * 100) : 0;
  return (
    <section className="mt-8 space-y-3">
      <Link
        href="/water"
        className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-colors hover:bg-muted"
      >
        <Droplets className="h-6 w-6 text-water" />
        <div className="flex-1">
          <div className="font-semibold">Вода</div>
          <div className="h-1.5 mt-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-water transition-all duration-500"
              style={{ width: `${Math.min(waterPct, 100)}%` }}
            />
          </div>
        </div>
        <div className="tabular-nums text-sm font-semibold">
          {waterMl >= 1000
            ? `${(waterMl / 1000).toFixed(1).replace(".", ",")} л`
            : `${waterMl} мл`}
          <span className="text-muted-foreground"> / {waterTarget >= 1000 ? `${(waterTarget / 1000).toFixed(1).replace(".", ",")} л` : `${waterTarget} мл`}</span>
        </div>
      </Link>
    </section>
  );
}

/** Скелетон при загрузке */
function SkeletonDay() {
  return (
    <div className="animate-pulse-soft space-y-6">
      <div className="mx-auto h-52 w-52 rounded-full bg-muted" />
      <div className="space-y-3 rounded-2xl bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 rounded bg-muted" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="h-32 rounded-2xl bg-card" />
      ))}
    </div>
  );
}
