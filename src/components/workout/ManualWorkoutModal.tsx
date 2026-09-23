"use client";

import { useState } from "react";
import { X, Plus, Check, Sparkles, Loader2 } from "lucide-react";
import type { WorkoutEntry } from "@/lib/workout/types";

interface ManualWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg?: number;
  userHeightCm?: number;
  userGender?: "male" | "female";
  userAge?: number;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

export function ManualWorkoutModal({
  isOpen,
  onClose,
  userWeightKg = 55,
  userHeightCm = 165,
  userGender = "female",
  userAge = 25,
  onAddWorkout,
}: ManualWorkoutModalProps) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [minutes, setMinutes] = useState("");
  const [targetMuscles, setTargetMuscles] = useState<string[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [calcMeta, setCalcMeta] = useState<{
    grossCalories?: number;
    met?: number;
    calculationMethod?: WorkoutEntry["calculationMethod"];
    explanation?: string;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleCalculateWithAi = async () => {
    if (!name.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/workout-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: name.trim(),
          userWeightKg,
          userHeightCm,
          userGender,
          userAge,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось рассчитать");
      }

      setCalories(String(data.caloriesBurned || ""));
      if (data.durationMinutes) {
        setMinutes(String(data.durationMinutes));
      }
      if (data.targetMuscles && Array.isArray(data.targetMuscles)) {
        setTargetMuscles(data.targetMuscles);
      }
      if (data.advice) {
        setAiAdvice(data.advice);
      }
      if (data.calculation) {
        setCalcMeta({
          grossCalories: data.calculation.grossCalories,
          met: data.calculation.met,
          calculationMethod: data.calculation.calculationMethod,
          explanation: data.calculation.explanation,
        });
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Ошибка расчёта");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cals = parseInt(calories, 10);
    if (!name.trim() || isNaN(cals) || cals <= 0) return;

    onAddWorkout({
      exerciseName: name.trim(),
      category: "machine",
      durationMinutes: minutes ? parseInt(minutes, 10) : undefined,
      caloriesBurned: cals,
      grossCalories: calcMeta?.grossCalories ?? cals,
      activeCalories: cals,
      met: calcMeta?.met,
      userWeightUsedKg: userWeightKg,
      calculationMethod: calcMeta?.calculationMethod ?? "manual",
      calculationDetails: calcMeta?.explanation,
      targetMuscles: targetMuscles.length > 0 ? targetMuscles : undefined,
      notes: aiAdvice || undefined,
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
      setName("");
      setCalories("");
      setMinutes("");
      setTargetMuscles([]);
      setAiAdvice(null);
      setCalcMeta(null);
      setIsSaved(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass-card w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
          <h2 className="font-bold text-foreground text-base sm:text-lg">
            Вписать расход калорий
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Название упражнения или тренировки
              </label>
              <button
                type="button"
                onClick={handleCalculateWithAi}
                disabled={!name.trim() || isAiLoading}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 disabled:opacity-40"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> AI считает...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> Рассчитать через ИИ
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Жим ногами 4 по 12 100 кг или Бег 20 мин"
              className="w-full rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-hidden"
            />
          </div>

          {/* Быстрые примеры */}
          <div className="flex flex-wrap gap-1">
            {[
              "Жим ногами 4 по 12 100 кг",
              "Ягодичный мостик 4 по 15 40 кг",
              "Ходьба в гору 30 минут",
              "Тяга блока 3 по 12 30 кг",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setName(preset);
                }}
                className="rounded-full bg-muted/70 hover:bg-muted border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {aiError && (
            <div className="rounded-xl bg-danger-soft p-2.5 text-xs text-danger">
              {aiError}
            </div>
          )}

          {targetMuscles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {targetMuscles.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-lg bg-primary-soft/60 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
                >
                  {muscle}
                </span>
              ))}
            </div>
          )}

          {aiAdvice && (
            <div className="rounded-2xl bg-primary-soft/40 border border-primary/25 p-3 text-xs text-foreground/90 space-y-1">
              <span className="font-bold text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Совет тренера:
              </span>
              <p>{aiAdvice}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Сожжено калорий (ккал) *
              </label>
              <input
                type="number"
                required
                min="1"
                max="5000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="например 38"
                className="w-full rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-sm font-bold tabular-nums focus:border-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Время в минутах (опц.)
              </label>
              <input
                type="number"
                min="1"
                max="600"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="40"
                className="w-full rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-sm tabular-nums focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !calories || isSaved}
            className={`btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold shadow-md transition-all ${
              isSaved
                ? "bg-success text-white"
                : "bg-primary text-primary-foreground hover:opacity-95"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="h-4 w-4" /> Добавлено!
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Сохранить в расход
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
