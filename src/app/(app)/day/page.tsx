"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Camera, Sparkles, Calculator, ChevronDown, Scale, Flame } from "lucide-react";
import { useDayLog, mealTypeMeta, MEAL_TYPES } from "@/hooks/useDayLog";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useProfile } from "@/hooks/useProfile";
import { CalorieRing } from "@/components/day/CalorieRing";
import { MacroBar } from "@/components/day/MacroBar";
import { MealCard } from "@/components/day/MealCard";
import { todayKey, addDays } from "@/lib/utils";
import { FoodAssistantBoundary } from "@/components/day/FoodAssistant";
import { sumTotals } from "@/lib/nutrition/macros";
import type { MealType, MealWithItems } from "@/types/database";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { SmartAlertBanner } from "@/components/day/SmartAlertBanner";
import { DailyBriefingCard } from "@/components/day/DailyBriefingCard";
import dynamic from "next/dynamic";

const MacroBalancer = dynamic(
  () => import("@/components/day/MacroBalancer").then((mod) => mod.MacroBalancer),
  { ssr: false }
);

const FoodAssistant = dynamic(
  () => import("@/components/day/FoodAssistant").then((mod) => mod.FoodAssistant),
  { ssr: false }
);

/**
 * Главный экран: день пользователя.
 * Кольцо калорий → БЖУ → приёмы пищи → быстрые виджеты.
 */
export default function DayPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [showAssistant, setShowAssistant] = useState(false);
  const [showBalancer, setShowBalancer] = useState(false);
  const isToday = dateKey === todayKey();

  const { data: day, isLoading, error } = useDayLog(dateKey);
  const { data: profile } = useProfile();

  const targetCalories = profile?.daily_calorie_target ?? 2000;
  const macroTargets = {
    proteinG: profile?.daily_protein_g ?? 120,
    fatG: profile?.daily_fat_g ?? 70,
    carbsG: profile?.daily_carbs_g ?? 200,
  };

  const { activeAlert, dismissAlert } = useSmartAlerts({
    targetCalories,
    consumedCalories: day?.totals.calories ?? 0,
    targetProtein: macroTargets.proteinG,
    consumedProtein: day?.totals.proteinG ?? 0,
    isToday,
  });

  const { totalBurnedCalories = 0, energyBalance } = useWorkouts(
    dateKey,
    day?.totals.calories ?? 0,
  );

  return (
    <main className="min-h-dvh bg-background px-4 pt-4">

      {/* Шапка с датой */}
      <header className="mb-3.5 flex items-center justify-between">
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

      {/* AI Брифинг дня (Утренний / Вечерний) */}
      <div className="mb-4">
        <DailyBriefingCard
          dateKey={dateKey}
          consumedTotals={day?.totals ?? { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }}
          calorieGoal={targetCalories}
          macroTargets={macroTargets}
          userName={profile?.display_name}
        />
      </div>

      {/* Умные контекстные предупреждения */}
      <SmartAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onAction={() => setShowBalancer(true)}
      />

      {isLoading ? (
        <SkeletonDay />
      ) : error ? (
        <div className="rounded-2xl bg-danger-soft p-4 text-center text-sm text-danger">
          Не удалось загрузить день. Проверьте подключение.
        </div>
      ) : (
        <>
          {/* Кольцо калорий */}
          <section className="mb-4 flex flex-col items-center">
            <CalorieRing current={day?.totals.calories ?? 0} target={targetCalories} />
            {isToday && (
              <button
                onClick={() => setShowAssistant(true)}
                className="btn-glossy spring-press mt-3 flex items-center gap-2 rounded-full bg-primary-soft/95 border border-primary/30 px-4.5 py-2 text-sm font-semibold text-primary shadow-xs hover:bg-primary hover:text-primary-foreground"
              >
                <Sparkles className="h-4 w-4" /> Спросить, что можно съесть
              </button>
            )}
            {isToday && showAssistant && <FoodAssistantBoundary><FoodAssistant onClose={() => setShowAssistant(false)} /></FoodAssistantBoundary>}
            <Link href="/calculator" className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline"><Calculator className="h-3.5 w-3.5" /> Калькулятор калорий</Link>
          </section>

          {/* БЖУ */}
          <section className="glass-card glossy-sheen scroll-sway-reverse mb-4 space-y-3 rounded-3xl p-5 shadow-md animate-blur-reveal stagger-1">
            <MacroBar
              label="Белки"
              value={day?.totals.proteinG ?? 0}
              target={macroTargets.proteinG}
              color="protein"
            />
            <MacroBar
              label="Жиры"
              value={day?.totals.fatG ?? 0}
              target={macroTargets.fatG}
              color="fat"
            />
            <MacroBar
              label="Углеводы"
              value={day?.totals.carbsG ?? 0}
              target={macroTargets.carbsG}
              color="carbs"
            />
            {isToday && (
              <div className="flex justify-end border-t border-border/40 pt-2.5">
                <button
                  onClick={() => setShowBalancer(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-all"
                >
                  <Scale className="h-3.5 w-3.5" /> Сбалансировать БЖУ
                </button>
              </div>
            )}
          </section>

          {/* Виджет расхода калорий и дефицита за день */}
          <section className="mb-4">
            <Link
              href="/burn"
              className="glass-card glossy-sheen spring-press flex items-center justify-between rounded-3xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-card/70 to-card/90 p-4 shadow-sm transition-all hover:border-orange-500/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 border border-orange-500/30 p-2.5 text-orange-500 shadow-2xs">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      Расход и тренировки
                    </span>
                    {(totalBurnedCalories ?? 0) > 0 && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-extrabold text-orange-600 dark:text-orange-400">
                        +{totalBurnedCalories} ккал
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(energyBalance?.netDeficit ?? 0) > 0
                      ? `Дефицит за сегодня: -${energyBalance?.netDeficit} ккал 🔥`
                      : (energyBalance?.netDeficit ?? 0) < 0
                        ? `Профицит: +${Math.abs(energyBalance?.netDeficit ?? 0)} ккал`
                        : "Расход и баланс в норме"}
                  </div>
                </div>
              </div>

              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 shrink-0">
                Записать →
              </span>
            </Link>
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


          {/* Модальное окно Macro Balancer */}
          {showBalancer && (
            <MacroBalancer
              targetCalories={targetCalories}
              remainingCalories={Math.max(0, Math.round(targetCalories - (day?.totals.calories ?? 0)))}
              targetMacros={macroTargets}
              remainingMacros={{
                proteinG: Math.max(0, Math.round(macroTargets.proteinG - (day?.totals.proteinG ?? 0))),
                fatG: Math.max(0, Math.round(macroTargets.fatG - (day?.totals.fatG ?? 0))),
                carbsG: Math.max(0, Math.round(macroTargets.carbsG - (day?.totals.carbsG ?? 0))),
              }}
              dateKey={dateKey}
              isOpen={showBalancer}
              onClose={() => setShowBalancer(false)}
            />
          )}

        </>
      )}
    </main>
  );
}

function formatDishesCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} блюд`;
  if (mod10 === 1) return `${count} блюдо`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} блюда`;
  return `${count} блюд`;
}

/** Категория приёма пищи в виде раскрывающегося аккордеона прямо в списке дня. */
function MealGroup({
  meals,
  dateKey,
  mealType,
  isToday,
}: {
  meals: MealWithItems[];
  dateKey: string;
  mealType: MealType;
  isToday: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const meta = mealTypeMeta(mealType);
  const totals = sumTotals(meals.flatMap((meal) => meal.meal_items));

  return (
    <div className="glass-card glossy-sheen scroll-sway overflow-hidden rounded-3xl transition-all shadow-md">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 select-none"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Свернуть" : "Развернуть"} ${meta.label}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-2xl shrink-0">{meta.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground">{meta.label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDishesCount(meals.length)} · {Math.round(totals.calories)} ккал · Б {Math.round(totals.proteinG)} · Ж {Math.round(totals.fatG)} · У {Math.round(totals.carbsG)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isToday && (
            <>
              <Link
                href={{ pathname: "/camera", query: { meal: mealType } }}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary spring-press"
                title="Сфотографировать"
                aria-label={`Сфотографировать в ${meta.label}`}
              >
                <Camera className="h-4 w-4" />
              </Link>
              <Link
                href={{ pathname: "/foods", query: { meal: mealType } }}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary spring-press"
                title="Добавить продукт"
                aria-label={`Добавить продукт в ${meta.label}`}
              >
                <Plus className="h-4 w-4" />
              </Link>
            </>
          )}
          <div className={`p-1.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-border/40 bg-muted/20 p-3 sm:p-4 space-y-3">
          <div className="space-y-3">
            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} dateKey={dateKey} />
            ))}
          </div>
          {isToday && <MealAddActions mealType={mealType} />}
        </div>
      )}
    </div>
  );
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
    <div className="glass-card glossy-sheen scroll-sway flex items-center justify-between rounded-3xl border border-dashed border-border/80 bg-card/40 p-4 transition-all shadow-xs">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <span className="text-xl">{meta.emoji}</span>
        <span className="font-semibold text-foreground/80">{meta.label}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={{ pathname: "/camera", query: { meal: mealType } }}
          className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-xs"
        >
          <Camera className="h-4 w-4" /> Фото
        </Link>
        <Link
          href={{ pathname: "/foods", query: { meal: mealType } }}
          className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-muted/80 border border-border/60 px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
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
        className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-primary-soft border border-primary/20 px-3.5 py-1.5 text-sm font-medium text-primary shadow-2xs"
        aria-label={`Добавить фото в ${meta.label}`}
      >
        <Camera className="h-4 w-4" /> Ещё фото
      </Link>
      <Link
        href={{ pathname: "/foods", query: { meal: mealType } }}
        className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-muted/80 border border-border/60 px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
        aria-label={`Добавить продукт в ${meta.label}`}
      >
        <Plus className="h-4 w-4" /> Ещё продукт
      </Link>
    </div>
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
