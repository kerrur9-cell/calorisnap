"use client";

import { useState, useMemo } from "react";
import { Search, X, Plus, Check, Sparkles, Loader2, Dumbbell, Lightbulb } from "lucide-react";
import { GYM_MACHINES, type GymMachineItem } from "@/lib/workout/machines";
import { calculateDetailedWorkout } from "@/lib/workout/calculator";
import type { WorkoutEntry } from "@/lib/workout/types";

interface MachineCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg: number;
  userHeightCm?: number;
  userGender?: "male" | "female";
  userAge?: number;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

export function MachineCatalogModal({
  isOpen,
  onClose,
  userWeightKg,
  userHeightCm,
  userGender,
  userAge,
  onAddWorkout,
}: MachineCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMachine, setSelectedMachine] = useState<GymMachineItem | null>(null);

  // Состояние калькулятора для выбранного тренажера
  const [sets, setSets] = useState(4);
  const [reps, setReps] = useState(15);
  const [minutes, setMinutes] = useState(25);
  const [weightKg, setWeightKg] = useState<number>(30);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiCalories, setAiCalories] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const filteredMachines = useMemo(() => {
    return GYM_MACHINES.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.targetMuscles.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleSelectMachine = (machine: GymMachineItem) => {
    setSelectedMachine(machine);
    setSets(machine.defaultSets);
    setReps(machine.defaultReps);
    setMinutes(machine.defaultMinutes ?? 25);
    setWeightKg(machine.defaultWeightKg ?? 30);
    setAiAdvice(null);
    setAiCalories(null);
    setIsAdded(false);
  };

  const detailedCalc = useMemo(() => {
    if (!selectedMachine) return null;
    return calculateDetailedWorkout({
      exerciseName: selectedMachine.name,
      category: selectedMachine.category === "cardio" ? "cardio" : "machine",
      sets: selectedMachine.category === "cardio" ? undefined : sets,
      reps: selectedMachine.category === "cardio" ? undefined : reps,
      weightKg: selectedMachine.category === "cardio" ? undefined : weightKg,
      durationMinutes: selectedMachine.category === "cardio" ? minutes : undefined,
      userWeightKg,
      userHeightCm,
      userGender,
      userAge,
    });
  }, [selectedMachine, userWeightKg, userHeightCm, userGender, userAge, minutes, sets, reps, weightKg]);

  const handleAskAi = async () => {
    if (!selectedMachine) return;
    setIsAiLoading(true);
    try {
      const isCardio = selectedMachine.category === "cardio";
      const queryText = isCardio
        ? `${selectedMachine.name} ${minutes} минут`
        : `${selectedMachine.name} ${sets} по ${reps} с весом ${weightKg} кг`;

      const res = await fetch("/api/ai/workout-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: queryText,
          userWeightKg,
          userHeightCm,
          userGender,
          userAge,
        }),
      });

      const data = await res.json();
      if (data) {
        if (data.advice) setAiAdvice(data.advice);
        if (typeof data.caloriesBurned === "number") setAiCalories(data.caloriesBurned);
      }
    } catch {
      // ignore
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = () => {
    if (!selectedMachine) return;
    const finalCalories = aiCalories ?? (detailedCalc?.activeCalories ?? 0);
    onAddWorkout({
      exerciseName: selectedMachine.name,
      category: selectedMachine.category === "cardio" ? "cardio" : "machine",
      durationMinutes: selectedMachine.category === "cardio" ? minutes : undefined,
      sets: selectedMachine.category !== "cardio" ? sets : undefined,
      reps: selectedMachine.category !== "cardio" ? reps : undefined,
      weightKg: selectedMachine.category !== "cardio" ? weightKg : undefined,
      caloriesBurned: finalCalories,
      grossCalories: detailedCalc?.grossCalories,
      activeCalories: finalCalories,
      met: detailedCalc?.met,
      userWeightUsedKg: userWeightKg,
      calculationMethod: detailedCalc?.calculationMethod,
      calculationDetails: detailedCalc?.explanation,
      targetMuscles: selectedMachine.targetMuscles,
      notes: aiAdvice || selectedMachine.techniqueTip,
    });
    setIsAdded(true);
    setTimeout(() => {
      onClose();
      setSelectedMachine(null);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass-card flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl overflow-hidden animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
              <Dumbbell className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base sm:text-lg leading-tight">
                Каталог тренажеров
              </h2>
              <p className="text-xs text-muted-foreground">
                Выберите тренажер для точного расчёта калорий
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Если выбран конкретный тренажер — показываем экран настройки и добавления */}
        {selectedMachine ? (
          <div className="overflow-y-auto py-4 space-y-4">
            <button
              onClick={() => setSelectedMachine(null)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              ← Назад ко всем тренажерам
            </button>

            <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/50 border border-primary/20 p-4">
              <span className="text-3xl shrink-0">{selectedMachine.emoji}</span>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {selectedMachine.name}
                </h3>
                {selectedMachine.nameEn && (
                  <div className="text-xs text-muted-foreground">
                    {selectedMachine.nameEn}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedMachine.targetMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Подсказка по технике */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-foreground/90">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 mb-1">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Совет по технике</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{selectedMachine.techniqueTip}</p>
            </div>

            {/* Настройка подходов или минут */}
            {selectedMachine.category === "cardio" ? (
              <div className="rounded-2xl border border-border/70 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Время тренировки</span>
                  <span className="text-primary tabular-nums">{minutes} мин</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>5 мин</span>
                  <span>30 мин</span>
                  <span>60 мин</span>
                  <span>90 мин</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/70 p-3">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Подходы (сетов)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSets((s) => Math.max(1, s - 1))}
                        className="h-8 w-8 rounded-lg bg-muted text-sm font-bold flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-bold text-base tabular-nums">
                        {sets}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSets((s) => s + 1)}
                        className="h-8 w-8 rounded-lg bg-muted text-sm font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-3">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Повторений в сете
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReps((r) => Math.max(1, r - 1))}
                        className="h-8 w-8 rounded-lg bg-muted text-sm font-bold flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-bold text-base tabular-nums">
                        {reps}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReps((r) => r + 1)}
                        className="h-8 w-8 rounded-lg bg-muted text-sm font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Выбор рабочего веса */}
                <div className="rounded-2xl border border-border/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Рабочий вес отягощения
                    </label>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {weightKg} кг
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeightKg((w) => Math.max(5, w - 5))}
                      className="h-8 w-12 rounded-lg bg-muted text-xs font-bold flex items-center justify-center hover:bg-muted/80"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min="5"
                      max="400"
                      step="5"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Math.max(0, Number(e.target.value)))}
                      className="w-full text-center font-bold text-base rounded-lg border border-border/80 bg-background/60 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => setWeightKg((w) => w + 5)}
                      className="h-8 w-12 rounded-lg bg-muted text-xs font-bold flex items-center justify-center hover:bg-muted/80"
                    >
                      +5
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[15, 30, 50, 80, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWeightKg(preset)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          weightKg === preset
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {preset} кг
                      </button>
                    ))}
                  </div>
                </div>

                {/* Кнопка запроса к ИИ */}
                <button
                  type="button"
                  onClick={handleAskAi}
                  disabled={isAiLoading}
                  className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft/90 border border-primary/30 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI анализирует технику...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Рассчитать и разобрать технику через ИИ
                    </>
                  )}
                </button>

                {aiAdvice && (
                  <div className="rounded-2xl bg-primary-soft/40 border border-primary/25 p-3 text-xs text-foreground/90 space-y-1 animate-fade-in">
                    <div className="font-bold text-primary flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Анализ ИИ:
                    </div>
                    <p>{aiAdvice}</p>
                  </div>
                )}
              </div>
            )}

            {/* Карточка расчета калорий */}
            <div className="rounded-2xl bg-card border border-border/80 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Активный расход ({userWeightKg} кг)</span>
                  {aiCalories !== null && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      <Sparkles className="h-2.5 w-2.5" /> ИИ подтвердил
                    </span>
                  )}
                </div>
                <div className="text-2xl font-extrabold text-primary tabular-nums">
                  ~{aiCalories ?? (detailedCalc?.activeCalories ?? 0)}{" "}
                  <span className="text-sm font-normal text-foreground">ккал</span>
                </div>
                {detailedCalc && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Полный расход: ~{detailedCalc.grossCalories} ккал ({detailedCalc.met} MET)
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isAdded}
                className={`btn-glossy spring-press flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition-all ${
                  isAdded
                    ? "bg-success text-white"
                    : "bg-primary text-primary-foreground hover:opacity-95"
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="h-4 w-4" /> Добавлено!
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Записать расход
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Список тренажеров с поиском */
          <div className="flex flex-col flex-1 overflow-hidden pt-3">
            {/* Поле поиска */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или мышцам..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 pl-9 pr-4 py-2.5 text-sm focus:border-primary focus:outline-hidden"
              />
            </div>

            {/* Категории */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2">
              <CategoryPill
                label="Все"
                active={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
              />
              <CategoryPill
                label="Ягодицы и бёдра"
                active={selectedCategory === "glutes_legs"}
                onClick={() => setSelectedCategory("glutes_legs")}
              />
              <CategoryPill
                label="Кардио"
                active={selectedCategory === "cardio"}
                onClick={() => setSelectedCategory("cardio")}
              />
              <CategoryPill
                label="Спина и верх"
                active={selectedCategory === "back_upper"}
                onClick={() => setSelectedCategory("back_upper")}
              />
              <CategoryPill
                label="Пресс и кор"
                active={selectedCategory === "abs_core"}
                onClick={() => setSelectedCategory("abs_core")}
              />
            </div>

            {/* Список */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 max-h-[55vh]">
              {filteredMachines.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Ничего не найдено по запросу «{searchQuery}»
                </div>
              ) : (
                filteredMachines.map((machine) => (
                  <button
                    key={machine.id}
                    onClick={() => handleSelectMachine(machine)}
                    className="glass-card glossy-sheen spring-press flex w-full items-center gap-3.5 rounded-2xl border border-border/60 bg-card/60 p-3.5 text-left transition-all hover:border-primary/40 active:scale-[0.98]"
                  >
                    <span className="text-2xl shrink-0">{machine.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">
                        {machine.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {machine.targetMuscles.join(" · ")}
                      </div>
                    </div>
                    <span className="rounded-full bg-primary-soft/80 border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary shrink-0">
                      Выбрать →
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "bg-muted/70 text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
