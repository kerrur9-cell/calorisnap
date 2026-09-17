"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  calculateTdee,
  ageFromBirthDate,
  ACTIVITY_LABELS,
  ACTIVITY_HINTS,
  type Gender,
  type Goal,
  type ActivityLevel,
} from "@/lib/nutrition/tdee";
import {
  calculateMacroTargets,
  calculateWaterTargetMl,
} from "@/lib/nutrition/macros";
import { Loader2, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import type { Profile } from "@/types/database";

/**
 * Онбординг: профиль + цель → расчёт нормы → сохранение.
 * Пропущен (если хочется) → данные можно дозаполнить в /profile.
 */
export default function OnboardingPage() {
  const { data, isLoading, error } = useProfile();
  if (isLoading) return <main className="p-6">Загружаем профиль…</main>;
  if (error || !data) return <main role="alert" className="p-6">Не удалось загрузить профиль. Обновите страницу.</main>;
  return <OnboardingForm initialProfile={data} />;
}

function OnboardingForm({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [gender, setGender] = useState<Gender | null>(initialProfile.gender);
  const [birthDate, setBirthDate] = useState(initialProfile.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(initialProfile.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(initialProfile.current_weight_kg?.toString() ?? "");
  const [goal, setGoal] = useState<Goal>(initialProfile.goal ?? "maintain");
  const [activity, setActivity] = useState<ActivityLevel>(initialProfile.activity_level ?? "moderate");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = useMemo(
    () => (birthDate ? ageFromBirthDate(birthDate) : null),
    [birthDate],
  );

  const result = useMemo(() => {
    if (!gender || !age || !heightCm || !weightKg) return null;
    try {
      return calculateTdee({
        gender,
        age,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        activityLevel: activity,
        goal,
      });
    } catch {
      return null;
    }
  }, [gender, age, heightCm, weightKg, activity, goal]);

  const macros = useMemo(
    () =>
      result
        ? calculateMacroTargets(result.targetCalories, goal)
        : null,
    [result, goal],
  );

  async function handleSave() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setError("Войдите в аккаунт заново"); return; }

    if (!gender || !age || !heightCm || !weightKg || !result || !macros) {
      setError("Проверьте поля: возраст 18–120 лет, рост 100–249 см, вес 20–500 кг");
      return;
    }

    setSaving(true);
    setError(null);

    const water = calculateWaterTargetMl(Number(weightKg));

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        gender,
        birth_date: birthDate,
        height_cm: Number(heightCm),
        current_weight_kg: Number(weightKg),
        goal,
        activity_level: activity,
        daily_calorie_target: result.targetCalories,
        daily_protein_g: macros.proteinG,
        daily_fat_g: macros.fatG,
        daily_carbs_g: macros.carbsG,
        daily_water_ml: water,
        onboarding_completed: true,
      })
      .eq("id", user.id).select("id").single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    router.push("/day");
    router.refresh();
  }

  const weightDeltaText = result
    ? result.weeklyWeightDeltaKg < 0
      ? `≈ −${Math.abs(result.weeklyWeightDeltaKg).toFixed(2).replace(".", ",")} кг/нед`
      : result.weeklyWeightDeltaKg > 0
        ? `≈ +${result.weeklyWeightDeltaKg.toFixed(2).replace(".", ",")} кг/нед`
        : "≈ поддержание"
    : "";

  return (
    <main className="min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-bold">Ваши параметры</h1>
        <p className="mb-8 text-muted-foreground">
          Рассчитаем дневную норму калорий и БЖУ
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Пол */}
        <Field label="Пол">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "male", label: "Мужчина" },
                { value: "female", label: "Женщина" },
              ] as const
            ).map((g) => (
              <button
                key={g.value}
                onClick={() => setGender(g.value)}
                className={`rounded-xl border px-4 py-3 font-medium transition-colors ${
                  gender === g.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Дата рождения */}
        <Field label="Дата рождения">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
          />
        </Field>

        {/* Рост */}
        <Field label="Рост">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="175"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 tabular-nums outline-none focus:border-primary"
            />
            <span className="text-muted-foreground">см</span>
          </div>
        </Field>

        {/* Вес */}
        <Field label="Текущий вес">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="78"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 tabular-nums outline-none focus:border-primary"
            />
            <span className="text-muted-foreground">кг</span>
          </div>
        </Field>

        {/* Цель */}
        <Field label="Цель">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "lose", label: "Похудеть" },
                { value: "maintain", label: "Поддержать" },
                { value: "gain", label: "Набрать" },
              ] as const
            ).map((g) => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${
                  goal === g.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Активность */}
        <Field label="Активность">
          <div className="space-y-2">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setActivity(lvl)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  activity === lvl
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="font-medium">{ACTIVITY_LABELS[lvl]}</div>
                <div className="text-xs text-muted-foreground">
                  {ACTIVITY_HINTS[lvl]}
                </div>
              </button>
            ))}
          </div>
        </Field>

        {/* Результат */}
        {result && macros && (
          <div className="mt-6 rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Ваша норма</span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {result.targetCalories}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ккал/день
                </span>
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              TDEE {result.tdee} ккал · {weightDeltaText}
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span>
                Белки <b className="tabular-nums">{macros.proteinG} г</b>
              </span>
              <span>
                Жиры <b className="tabular-nums">{macros.fatG} г</b>
              </span>
              <span>
                Углеводы <b className="tabular-nums">{macros.carbsG} г</b>
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Начать
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
