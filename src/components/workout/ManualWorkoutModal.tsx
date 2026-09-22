"use client";

import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import type { WorkoutEntry } from "@/lib/workout/types";

interface ManualWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

export function ManualWorkoutModal({
  isOpen,
  onClose,
  onAddWorkout,
}: ManualWorkoutModalProps) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [minutes, setMinutes] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cals = parseInt(calories, 10);
    if (!name.trim() || isNaN(cals) || cals <= 0) return;

    onAddWorkout({
      exerciseName: name.trim(),
      category: "machine",
      durationMinutes: minutes ? parseInt(minutes, 10) : undefined,
      caloriesBurned: cals,
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
      setName("");
      setCalories("");
      setMinutes("");
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
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Название упражнения или тренировки
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Тренировка в зале или Бег"
              className="w-full rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-hidden"
            />
          </div>

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
                placeholder="250"
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
