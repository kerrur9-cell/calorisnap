"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Camera, Droplets, Sparkles, Calculator, ChevronDown, Scale, Mic, ChefHat } from "lucide-react";
import { useDayLog, mealTypeMeta, MEAL_TYPES } from "@/hooks/useDayLog";
import { useProfile } from "@/hooks/useProfile";
import { CalorieRing } from "@/components/day/CalorieRing";
import { MacroBar } from "@/components/day/MacroBar";
import { MealCard } from "@/components/day/MealCard";
import { todayKey, addDays } from "@/lib/utils";
import { FoodAssistant, FoodAssistantBoundary } from "@/components/day/FoodAssistant";
import { sumTotals } from "@/lib/nutrition/macros";
import type { MealType, MealWithItems } from "@/types/database";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { SmartAlertBanner } from "@/components/day/SmartAlertBanner";
import { MacroBalancer } from "@/components/day/MacroBalancer";
import { GamificationBadge } from "@/components/app/GamificationBadge";
import { VoiceAssistantModal } from "@/components/voice/VoiceAssistantModal";
import { DailyBriefingCard } from "@/components/day/DailyBriefingCard";
import { FridgeRecipeModal } from "@/components/fridge/FridgeRecipeModal";

/**
 * Главный экран: день пользователя.
 * Кольцо калорий → БЖУ → приёмы пищи → быстрые виджеты.
 */
export default function DayPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [showAssistant, setShowAssistant] = useState(false);
  const [showBalancer, setShowBalancer] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showFridgeModal, setShowFridgeModal] = useState(false);
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

  return (
    <main className="min-h-dvh bg-background px-4 pt-6">
      {/* Верхняя панель: Уровень/XP, Холодильник и Голосовой ассистент */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <GamificationBadge />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFridgeModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold shadow-xs transition-all hover:bg-muted active:scale-95"
            title="Что приготовить из холодильника"
            aria-label="Что приготовить из холодильника"
          >
            <ChefHat className="h-3.5 w-3.5 text-amber-500" />
            <span>Холодильник</span>
          </button>
          <button
            onClick={() => setShowVoiceModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-xs transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
            title="Голосовой ассистент"
            aria-label="Голосовой ассистент"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Голос</span>
          </button>
        </div>
      </div>

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

          {/* Модальное окно Macro Balancer */}
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

          {/* Модальное окно Голосового ассистента */}
          <VoiceAssistantModal
            isOpen={showVoiceModal}
            onClose={() => setShowVoiceModal(false)}
            dateKey={dateKey}
            consumedTotals={day?.totals ?? { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }}
            targetCalories={targetCalories}
            macroTargets={macroTargets}
            eatenFoodNames={[
              ...new Set(
                (day?.meals ?? []).flatMap((m) =>
                  m.meal_items.map((i) => i.custom_food_name).filter((n): n is string => Boolean(n))
                )
              ),
            ]}
            onOpenBalancer={() => setShowBalancer(true)}
          />
          <FridgeRecipeModal
            isOpen={showFridgeModal}
            onClose={() => setShowFridgeModal(false)}
            dateKey={dateKey}
            remainingCalories={targetCalories - (day?.totals.calories ?? 0)}
            remainingTotals={{
              calories: Math.max(0, targetCalories - (day?.totals.calories ?? 0)),
              proteinG: Math.max(0, macroTargets.proteinG - (day?.totals.proteinG ?? 0)),
              fatG: Math.max(0, macroTargets.fatG - (day?.totals.fatG ?? 0)),
              carbsG: Math.max(0, macroTargets.carbsG - (day?.totals.carbsG ?? 0)),
            }}
            macroTargets={macroTargets}
          />
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
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm border border-border/40 transition-colors">
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
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                title="Сфотографировать"
                aria-label={`Сфотографировать в ${meta.label}`}
              >
                <Camera className="h-4 w-4" />
              </Link>
              <Link
                href={{ pathname: "/foods", query: { meal: mealType } }}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
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
