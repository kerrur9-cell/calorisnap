"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { WorkoutEntry } from "@/lib/workout/types";
import { calculateEnergyBalance, type UserBiometrics } from "@/lib/workout/calculator";
import { useProfile } from "./useProfile";
import { ageFromBirthDate } from "@/lib/nutrition/tdee";
import { createClient } from "@/lib/supabase/client";

const STORAGE_PREFIX = "calorisnap_workouts_";

export function useWorkouts(dateKey: string, consumedCalories = 0) {
  const { data: profile } = useProfile();
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Проверяем наличие веса в профиле
  const isWeightMissing = !profile?.current_weight_kg || profile.current_weight_kg <= 0;

  // Биометрические данные пользователя из профиля
  const biometrics: UserBiometrics | null = useMemo(() => {
    if (!profile) return null;
    const age = profile.birth_date ? ageFromBirthDate(profile.birth_date) : 25;
    return {
      gender: profile.gender ?? "female",
      age: age ?? 25,
      heightCm: profile.height_cm ?? 165,
      weightKg: profile.current_weight_kg && profile.current_weight_kg > 0 ? profile.current_weight_kg : 0,
    };
  }, [profile]);

  // Загрузка тренировок за выбранный день
  useEffect(() => {
    let active = true;

    async function loadData() {
      // 1. Быстро читаем из localStorage
      let localItems: WorkoutEntry[] = [];
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem(`${STORAGE_PREFIX}${dateKey}`) : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localItems = parsed;
          }
        }
      } catch {
        // Игнорируем ошибки парсинга
      }

      if (active) {
        setWorkouts(localItems);
        setIsLoaded(true);
      }

      // 2. Фоново пробуем синхронизировать из Supabase, если таблица существует
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("workout_entries")
          .select("*")
          .eq("entry_date", dateKey)
          .order("created_at", { ascending: false });

        if (!error && data && active) {
          // Маппинг из snake_case Supabase в WorkoutEntry
          const dbWorkouts: WorkoutEntry[] = data.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            userId: row.user_id ? String(row.user_id) : undefined,
            entryDate: String(row.entry_date),
            exerciseName: String(row.exercise_name),
            category: (row.category as WorkoutEntry["category"]) ?? "machine",
            durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : undefined,
            sets: row.sets ? Number(row.sets) : undefined,
            reps: row.reps ? Number(row.reps) : undefined,
            weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
            caloriesBurned: Number(row.calories_burned ?? 0),
            grossCalories: row.gross_calories ? Number(row.gross_calories) : Number(row.calories_burned ?? 0),
            activeCalories: row.active_calories ? Number(row.active_calories) : Number(row.calories_burned ?? 0),
            met: row.met ? Number(row.met) : undefined,
            speedKmh: row.speed_kmh ? Number(row.speed_kmh) : undefined,
            inclinePercent: row.incline_percent ? Number(row.incline_percent) : undefined,
            userWeightUsedKg: row.user_weight_used_kg ? Number(row.user_weight_used_kg) : undefined,
            calculationMethod: row.calculation_method as WorkoutEntry["calculationMethod"],
            calculationDetails: row.calculation_details ? String(row.calculation_details) : undefined,
            targetMuscles: Array.isArray(row.target_muscles) ? (row.target_muscles as string[]) : undefined,
            notes: row.notes ? String(row.notes) : undefined,
            equipmentPhotoUrl: row.equipment_photo_url ? String(row.equipment_photo_url) : undefined,
            createdAt: String(row.created_at ?? new Date().toISOString()),
          }));

          if (dbWorkouts.length > 0) {
            setWorkouts(dbWorkouts);
            localStorage.setItem(`${STORAGE_PREFIX}${dateKey}`, JSON.stringify(dbWorkouts));
          }
        }
      } catch {
        // Оффлайн или отсутствие таблицы в Supabase — безопасно остаемся на localStorage
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [dateKey]);

  // Сохранение записи
  const addWorkout = useCallback(
    async (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => {
      const newEntry: WorkoutEntry = {
        ...workout,
        id: "w_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        entryDate: dateKey,
        createdAt: new Date().toISOString(),
      };

      setWorkouts((prev) => {
        const updated = [newEntry, ...prev];
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${dateKey}`, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Фоновая отправка в Supabase
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("workout_entries").insert({
            user_id: user.id,
            entry_date: dateKey,
            exercise_name: newEntry.exerciseName,
            category: newEntry.category,
            duration_minutes: newEntry.durationMinutes,
            sets: newEntry.sets,
            reps: newEntry.reps,
            weight_kg: newEntry.weightKg,
            calories_burned: newEntry.caloriesBurned,
            gross_calories: newEntry.grossCalories,
            active_calories: newEntry.activeCalories ?? newEntry.caloriesBurned,
            met: newEntry.met,
            speed_kmh: newEntry.speedKmh,
            incline_percent: newEntry.inclinePercent,
            user_weight_used_kg: newEntry.userWeightUsedKg,
            calculation_method: newEntry.calculationMethod,
            calculation_details: newEntry.calculationDetails,
            target_muscles: newEntry.targetMuscles,
            notes: newEntry.notes,
            equipment_photo_url: newEntry.equipmentPhotoUrl,
          });
        }
      } catch {
        // Игнорируем ошибки сети/таблицы
      }

      return newEntry;
    },
    [dateKey],
  );

  // Удаление записи
  const deleteWorkout = useCallback(
    async (id: string) => {
      setWorkouts((prev) => {
        const updated = prev.filter((w) => w.id !== id);
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${dateKey}`, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      try {
        const supabase = createClient();
        await supabase.from("workout_entries").delete().eq("id", id);
      } catch {
        // ignore
      }
    },
    [dateKey],
  );

  // Суммарные активные сожженные калории за день (идут в суточный дефицит)
  const totalBurnedCalories = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.activeCalories ?? w.caloriesBurned ?? 0), 0),
    [workouts],
  );

  // Суммарные полные калории тренировок за день
  const totalGrossCalories = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.grossCalories ?? w.caloriesBurned ?? 0), 0),
    [workouts],
  );

  // Энергобаланс дня (BMR + Активные тренировки vs Съедено)
  // Исключает двойной учёт BMR
  const energyBalance = useMemo(
    () =>
      calculateEnergyBalance({
        biometrics,
        burnedCalories: totalBurnedCalories,
        grossBurnedCalories: totalGrossCalories,
        consumedCalories,
      }),
    [biometrics, totalBurnedCalories, totalGrossCalories, consumedCalories],
  );

  return {
    workouts,
    isLoaded,
    addWorkout,
    deleteWorkout,
    totalBurnedCalories,
    totalGrossCalories,
    energyBalance,
    biometrics,
    isWeightMissing,
  };
}
