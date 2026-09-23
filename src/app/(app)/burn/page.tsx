"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  ChevronLeft,
  ChevronRight,
  Mic,
  Camera,
  Dumbbell,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useDayLog } from "@/hooks/useDayLog";
import { todayKey, addDays } from "@/lib/utils";
import { MachineCatalogModal } from "@/components/workout/MachineCatalogModal";
import { EquipmentPhotoModal } from "@/components/workout/EquipmentPhotoModal";
import { WorkoutVoiceModal } from "@/components/workout/WorkoutVoiceModal";
import { ManualWorkoutModal } from "@/components/workout/ManualWorkoutModal";

export default function BurnPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const isToday = dateKey === todayKey();

  // Загружаем калории, съеденные за этот день
  const { data: dayLog } = useDayLog(dateKey);
  const consumedCalories = dayLog?.totals.calories ?? 0;

  // Хук тренировок и баланса
  const {
    workouts,
    addWorkout,
    deleteWorkout,
    totalBurnedCalories,
    totalGrossCalories,
    energyBalance,
    biometrics,
    isWeightMissing,
  } = useWorkouts(dateKey, consumedCalories);

  // Модальные окна
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const userWeightKg = biometrics?.weightKg && biometrics.weightKg > 0 ? biometrics.weightKg : 0;
  const userHeightCm = biometrics?.heightCm ?? 165;
  const userGender = biometrics?.gender ?? "female";
  const userAge = biometrics?.age ?? 25;

  return (
    <main className="min-h-dvh bg-background px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
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
          <div className="flex items-center justify-center gap-1.5 font-extrabold text-foreground text-lg">
            <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
            <span>Расход калорий</span>
          </div>
          <div className="text-xs text-muted-foreground capitalize">
            {isToday
              ? "Сегодня"
              : new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
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

      {/* Предупреждение об отсутствии веса в профиле */}
      {isWeightMissing && (
        <div className="mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs flex items-center justify-between text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>Текущий вес в профиле не указан. Укажите вес для точного физиологического расчёта.</span>
          </div>
          <Link href="/profile" className="font-bold underline shrink-0 ml-2">
            Указать →
          </Link>
        </div>
      )}

      {/* Главная карточка суточного энергобаланса и дефицита */}
      <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Суточный баланс
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              energyBalance.netDeficit > 0
                ? "bg-success-soft text-success border border-success/30"
                : "bg-primary-soft text-primary border border-primary/30"
            }`}
          >
            {energyBalance.statusText}
          </span>
        </div>

        {/* Главная цифра: Итоговый дефицит/профицит */}
        <div className="flex items-baseline justify-between py-1">
          <div>
            <div className="text-3xl font-extrabold text-foreground tabular-nums">
              {energyBalance.netDeficit > 0
                ? `-${energyBalance.netDeficit}`
                : `+${Math.abs(energyBalance.netDeficit)}`}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ккал
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {energyBalance.netDeficit > 0 ? "Итоговый дефицит за сегодня" : "Профицит за сегодня"}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-primary">
              {energyBalance.statusDescription}
            </span>
          </div>
        </div>

        {/* Разложение калорий на составляющие (без двойного учёта BMR) */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-3 text-center text-xs">
          <div className="border-r border-border/50 pr-1">
            <div className="font-semibold text-foreground tabular-nums">
              {energyBalance.bmr} <span className="text-[10px] text-muted-foreground">ккал</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5" title="Базовый обмен веществ на ваш вес в покое за 24 ч">
              Базовый (BMR)
            </div>
          </div>

          <div className="border-r border-border/50 px-1">
            <div className="font-bold text-orange-500 tabular-nums">
              +{totalBurnedCalories} <span className="text-[10px] text-muted-foreground">ккал</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5" title="Активный расход тренировок сверх покоя (не дублирует BMR)">
              Активно {totalGrossCalories > totalBurnedCalories ? `(~${totalGrossCalories})` : ""}
            </div>
          </div>

          <div className="pl-1">
            <div className="font-semibold text-foreground tabular-nums">
              {consumedCalories} <span className="text-[10px] text-muted-foreground">ккал</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Съедено
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>
            Вес в расчёте: <b>{userWeightKg > 0 ? `${userWeightKg} кг` : "не указан (расчёт по умолчанию)"}</b>
          </span>
          <Link href="/profile" className="text-primary hover:underline">
            {userWeightKg > 0 ? "Изменить в профиле →" : "Указать в профиле →"}
          </Link>
        </div>
      </section>

      {/* Быстрые действия: 4 способа добавить тренировку */}
      <section className="mb-4">
        <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Записать упражнение
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Голос / Текст */}
          <button
            onClick={() => setShowVoice(true)}
            className="glass-card glossy-sheen scroll-sway spring-press flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/40 p-3 text-left transition-all hover:border-primary active:scale-[0.97]"
          >
            <div className="rounded-xl bg-primary-soft p-2 text-primary shrink-0 shadow-2xs">
              <Mic className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">
                Голосом / текстом
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                «Я сделала 4 по 15»
              </div>
            </div>
          </button>

          {/* Сфоткать тренажер */}
          <button
            onClick={() => setShowPhoto(true)}
            className="glass-card glossy-sheen scroll-sway-reverse spring-press flex items-center gap-3 rounded-2xl border border-border/80 bg-card/70 p-3 text-left transition-all hover:border-primary/50 active:scale-[0.97]"
          >
            <div className="rounded-xl bg-muted p-2 text-foreground shrink-0 shadow-2xs">
              <Camera className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">
                Сфоткать тренажер
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                AI определит по фото
              </div>
            </div>
          </button>

          {/* Каталог тренажеров */}
          <button
            onClick={() => setShowCatalog(true)}
            className="glass-card glossy-sheen scroll-sway spring-press flex items-center gap-3 rounded-2xl border border-border/80 bg-card/70 p-3 text-left transition-all hover:border-primary/50 active:scale-[0.97]"
          >
            <div className="rounded-xl bg-muted p-2 text-foreground shrink-0 shadow-2xs">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">
                Список тренажеров
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Выбрать из каталога
              </div>
            </div>
          </button>

          {/* Вручную ккал */}
          <button
            onClick={() => setShowManual(true)}
            className="glass-card glossy-sheen scroll-sway-reverse spring-press flex items-center gap-3 rounded-2xl border border-border/80 bg-card/70 p-3 text-left transition-all hover:border-primary/50 active:scale-[0.97]"
          >
            <div className="rounded-xl bg-muted p-2 text-foreground shrink-0 shadow-2xs">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">
                Вписать ккал
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Точное число калорий
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Список выполненных активностей за день */}
      <section className="mb-6 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Выполнено сегодня ({workouts.length})
          </h2>
          {totalBurnedCalories > 0 && (
            <span className="text-xs font-bold text-orange-500 tabular-nums">
              Итого: +{totalBurnedCalories} ккал
            </span>
          )}
        </div>

        {workouts.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 p-8 text-center bg-card/30">
            <span className="text-3xl mb-2">🔥</span>
            <div className="font-bold text-sm text-foreground mb-1">
              Нет записанных упражнений
            </div>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Сделайте тренировку, сфотографируйте тренажер или просто скажите голосом, сколько сделали
            </p>
            <button
              onClick={() => setShowVoice(true)}
              className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs"
            >
              <Mic className="h-3.5 w-3.5" /> Сказать упражнение
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="glass-card glossy-sheen scroll-sway flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-xs transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-xl bg-orange-500/15 border border-orange-500/25 p-2 text-orange-500 shrink-0">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-foreground truncate">
                      {w.exerciseName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {w.durationMinutes
                        ? `${w.durationMinutes} мин`
                        : w.sets
                        ? `${w.sets} подх. ${w.reps ? `× ${w.reps}` : ""}`
                        : "Упражнение"}
                      {w.speedKmh ? ` · ${w.speedKmh} км/ч` : ""}
                      {typeof w.inclinePercent === "number" ? ` · ${w.inclinePercent}%` : ""}
                      {w.weightKg ? ` · ${w.weightKg} кг` : ""}
                      {w.met ? ` · ${w.met} MET` : ""}
                      {w.targetMuscles && w.targetMuscles.length > 0
                        ? ` · ${w.targetMuscles[0]}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-orange-500 tabular-nums block">
                      +{w.caloriesBurned} <span className="text-[10px] font-normal">ккал</span>
                    </span>
                    {w.grossCalories && w.grossCalories !== w.caloriesBurned && (
                      <span className="text-[10px] text-muted-foreground block">
                        полный ~{w.grossCalories}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteWorkout(w.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:text-danger hover:bg-muted transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Модальные окна */}
      <MachineCatalogModal
        isOpen={showCatalog}
        onClose={() => setShowCatalog(false)}
        userWeightKg={userWeightKg}
        userHeightCm={userHeightCm}
        userGender={userGender}
        userAge={userAge}
        onAddWorkout={addWorkout}
      />

      <EquipmentPhotoModal
        isOpen={showPhoto}
        onClose={() => setShowPhoto(false)}
        userWeightKg={userWeightKg}
        userHeightCm={userHeightCm}
        userGender={userGender}
        userAge={userAge}
        onAddWorkout={addWorkout}
      />

      <WorkoutVoiceModal
        isOpen={showVoice}
        onClose={() => setShowVoice(false)}
        userWeightKg={userWeightKg}
        userHeightCm={userHeightCm}
        userGender={userGender}
        userAge={userAge}
        onAddWorkout={addWorkout}
      />

      <ManualWorkoutModal
        isOpen={showManual}
        onClose={() => setShowManual(false)}
        userWeightKg={userWeightKg}
        userHeightCm={userHeightCm}
        userGender={userGender}
        userAge={userAge}
        onAddWorkout={addWorkout}
      />
    </main>
  );
}
