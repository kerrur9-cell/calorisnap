"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, Plus, Scale, TrendingDown, TrendingUp, Minus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateTdee } from "@/lib/nutrition/tdee";
import { ageFromBirthDate, ACTIVITY_LABELS, GOAL_LABELS } from "@/lib/nutrition/tdee";
import { calculateMacroTargets, calculateWaterTargetMl } from "@/lib/nutrition/macros";
import { todayKey } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { LinkAccount } from "@/components/app/LinkAccount";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background pb-24" />}>
      <ProfileFlow />
    </Suspense>
  );
}

type Theme = "auto" | "light" | "dark";

function ProfileFlow() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error: profileError } = useProfile();
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightSaved, setWeightSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Последние записи веса
  const { data: weightHistory } = useQuery({
    queryKey: ["weight-history"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("weight_entries")
        .select("weight_kg, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Тема
  const theme = profile?.theme ?? "auto";
  async function changeTheme(t: Theme) {
    if (!profile) return;
    const { error } = await createClient().from("profiles").update({ theme: t }).eq("id", profile.id);
    if (error) { setError("Не удалось сохранить тему"); return; }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  async function addWeight() {
    if (!profile || savingWeight) return;
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setError("Войдите в аккаунт заново"); return; }

    const kg = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(kg) || kg < 20 || kg > 500) { setError("Укажите вес от 20 до 500 кг"); return; }

    setSavingWeight(true);
    setWeightSaved(false);

    try {
      // 2. Текущий вес + пересчёт норм под новый вес
      const age = profile.birth_date ? ageFromBirthDate(profile.birth_date) : null;
      let patch: Partial<Profile> = { current_weight_kg: kg };
      if (profile.gender && age && profile.height_cm) {
        const calc = calculateTdee({
          gender: profile.gender,
          age,
          heightCm: profile.height_cm,
          weightKg: kg,
          activityLevel: profile.activity_level ?? "moderate",
          goal: profile.goal ?? "maintain",
        });
        const macros = calculateMacroTargets(
          calc.targetCalories,
          profile.goal ?? "maintain",
        );
        patch = {
          ...patch,
          daily_calorie_target: calc.targetCalories,
          daily_protein_g: macros.proteinG,
          daily_fat_g: macros.fatG,
          daily_carbs_g: macros.carbsG,
          daily_water_ml: calculateWaterTargetMl(kg),
        };
      }
      const { error: saveError } = await supabase.rpc("save_weight", {
        p_weight: kg, p_date: todayKey(), p_targets: patch,
      });
      if (saveError) throw saveError;
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        queryClient.invalidateQueries({ queryKey: ["weight-history"] });
        setWeightInput("");
        setWeightSaved(true);
        setTimeout(() => setWeightSaved(false), 2500);
    } catch { setError("Не удалось сохранить вес и нормы. Проверьте параметры профиля и повторите."); }
    finally { setSavingWeight(false); }
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) { setError("Не удалось выйти. Попробуйте ещё раз."); setSigningOut(false); return; }
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  if (profileError) return <main className="p-6" role="alert">Не удалось загрузить профиль. Обновите страницу.</main>;
  if (isLoading || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background pb-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  const age = profile.birth_date ? ageFromBirthDate(profile.birth_date) : null;
  const tdee = (() => { try { return (
    profile.gender && age && profile.height_cm && profile.current_weight_kg
      ? calculateTdee({
          gender: profile.gender,
          age,
          heightCm: profile.height_cm,
          weightKg: profile.current_weight_kg,
          activityLevel: profile.activity_level ?? "moderate",
          goal: profile.goal ?? "maintain",
        }).tdee
      : null); } catch { return null; } })();

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-8">
      <h1 className="mb-6 text-2xl font-bold">Профиль</h1>
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}

      {/* Шапка */}
      <div className="glass-card glossy-sheen scroll-sway mb-6 flex items-center gap-4 rounded-3xl p-5 shadow-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-bold text-primary shadow-xs border border-primary/20">
          {(profile.display_name ?? "Г").charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-lg font-bold">
            {profile.display_name ?? "Пользователь"}
          </div>
          <div className="text-sm text-muted-foreground">
            {age ?? "—"} лет · {profile.height_cm ?? "—"} см ·{" "}
            {profile.current_weight_kg ?? "—"} кг
          </div>
          {profile.goal && (
            <span className="mt-1 inline-block rounded-full bg-primary-soft border border-primary/30 px-3 py-0.5 text-xs font-medium text-primary shadow-2xs">
              {GOAL_LABELS[profile.goal]}
            </span>
          )}
        </div>
      </div>

      {/* Нормы */}
      <section className="glass-card glossy-sheen scroll-sway-reverse mb-4 rounded-3xl p-5 shadow-md">
        <h2 className="mb-3 font-semibold text-foreground">Ваши нормы</h2>
        <div className="space-y-2 text-sm">
          <Row label="Цель по калориям" value={`${profile.daily_calorie_target ?? "—"} ккал`} />
          <Row label="TDEE" value={tdee ? `${tdee} ккал` : "—"} />
          <Row label="Белки / Жиры / Углеводы" value={`${profile.daily_protein_g ?? "—"} / ${profile.daily_fat_g ?? "—"} / ${profile.daily_carbs_g ?? "—"} г`} />
          <Row label="Активность" value={profile.activity_level ? ACTIVITY_LABELS[profile.activity_level] : "—"} />
          <Row label="Вода в день" value={`${profile.daily_water_ml} мл`} />
        </div>
        <Link
          href="/onboarding"
          className="btn-glossy spring-press mt-4 block rounded-2xl bg-primary-soft border border-primary/20 py-2.5 text-center text-sm font-semibold text-primary shadow-xs hover:bg-primary hover:text-primary-foreground"
        >
          Изменить данные и пересчитать нормы
        </Link>
      </section>

      {/* Новый вес */}
      <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Scale className="h-4 w-4 text-primary" /> Вес тела
        </h2>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Например, 79.5"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="flex-1 rounded-2xl border border-border bg-background/80 px-3.5 py-2.5 tabular-nums outline-none focus:border-primary shadow-2xs"
          />
          <span className="flex items-center text-sm text-muted-foreground font-medium">кг</span>
          <button
            onClick={addWeight}
            disabled={savingWeight}
            className="btn-glossy spring-press rounded-2xl bg-primary px-4 text-primary-foreground shadow-xs"
          >
            {weightSaved ? (
              <Check className="h-5 w-5 text-primary-foreground" />
            ) : (
              <Plus
                className={`h-5 w-5 text-primary-foreground ${
                  savingWeight ? "animate-spin" : ""
                }`}
              />
            )}
          </button>
        </div>

        {weightSaved && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-sm text-primary animate-in fade-in slide-in-from-top-2">
            <Check className="h-4 w-4 shrink-0" />
            Сохранено: вес и нормы обновлены
          </div>
        )}

        {/* Последние записи */}
        {weightHistory && weightHistory.length > 0 && (
          <div className="mt-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {weightHistory.map((w, i) => {
                const prev = weightHistory[i + 1]?.weight_kg;
                const diff = prev != null ? w.weight_kg - prev : 0;
                const Trend = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
                return (
                  <div
                    key={w.recorded_at}
                    className="min-w-[72px] rounded-xl bg-muted/60 px-3 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold tabular-nums">
                      <Trend
                        className={cn(
                          "h-3 w-3",
                          diff < 0 && "text-primary",
                          diff > 0 && "text-warning",
                        )}
                      />
                      {Number(w.weight_kg).toFixed(1).replace(".", ",")}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.recorded_at + "T12:00:00").toLocaleDateString(
                        "ru-RU",
                        { day: "2-digit", month: "2-digit" },
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Link href="/stats" className="mt-3 block text-xs text-primary">
          Смотреть историю веса →
        </Link>
      </section>

      {/* Тема */}
      <section className="mb-4 rounded-2xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Тема</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["auto", "Авто"],
              ["light", "Светлая"],
              ["dark", "Тёмная"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => changeTheme(value)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                theme === value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Выход */}
      <LinkAccount />
      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-danger-soft py-3.5 font-medium text-danger"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Выход…" : "Выйти из аккаунта"}
      </button>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
