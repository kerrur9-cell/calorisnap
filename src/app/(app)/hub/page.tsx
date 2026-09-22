"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Mic,
  ChefHat,
  Trophy,
  FlaskConical,
  TrendingUp,
  ChevronRight,
  Zap,
  Target,
  Star,
} from "lucide-react";
import { useGamification } from "@/hooks/useGamification";
import { useProfile } from "@/hooks/useProfile";
import { useDayLog } from "@/hooks/useDayLog";
import { todayKey } from "@/lib/utils";
import dynamic from "next/dynamic";
import { AccentColorPicker } from "@/components/app/AccentColorPicker";

const VoiceAssistantModal = dynamic(
  () =>
    import("@/components/voice/VoiceAssistantModal").then(
      (mod) => mod.VoiceAssistantModal,
    ),
  { ssr: false },
);

const FridgeRecipeModal = dynamic(
  () =>
    import("@/components/fridge/FridgeRecipeModal").then(
      (mod) => mod.FridgeRecipeModal,
    ),
  { ssr: false },
);

const MacroBalancer = dynamic(
  () => import("@/components/day/MacroBalancer").then((mod) => mod.MacroBalancer),
  { ssr: false },
);

export default function HubPage() {
  const [showVoice, setShowVoice] = useState(false);
  const [showFridge, setShowFridge] = useState(false);
  const [showBalancer, setShowBalancer] = useState(false);
  const { data: gam } = useGamification();
  const { data: profile } = useProfile();
  const today = todayKey();
  const { data: dayLog } = useDayLog(today);

  const targetCalories = profile?.daily_calorie_target ?? 2000;
  const macroTargets = {
    proteinG: profile?.daily_protein_g ?? 120,
    fatG: profile?.daily_fat_g ?? 70,
    carbsG: profile?.daily_carbs_g ?? 200,
  };

  return (
    <main className="min-h-dvh bg-background px-4 pt-4">
      {/* Заголовок */}
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Хаб
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Все интеллектуальные инструменты в одном месте
        </p>
      </header>

      <AccentColorPicker />

      {/* Быстрые инструменты */}
      <section className="mb-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowVoice(true)}
          aria-label="Открыть голосового нутрициолога"
          className="glass-card glossy-sheen scroll-sway spring-press flex min-h-28 touch-manipulation flex-col items-start gap-2.5 rounded-3xl p-4 shadow-md text-left transition-all hover:border-primary/40 active:scale-[0.97]"
        >
          <div className="rounded-2xl bg-primary-soft/90 border border-primary/30 p-2.5 shadow-2xs">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">
              Голосовой нутрициолог
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Спросите голосом или текстом
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowFridge(true)}
          aria-label="Открыть AI-холодильник"
          className="glass-card glossy-sheen scroll-sway-reverse spring-press flex min-h-28 touch-manipulation flex-col items-start gap-2.5 rounded-3xl p-4 shadow-md text-left transition-all hover:border-amber-500/40 active:scale-[0.97]"
        >
          <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-2.5 shadow-2xs">
            <ChefHat className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">
              AI-Холодильник
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Рецепт из ваших продуктов
            </div>
          </div>
        </button>
      </section>

      {/* Уровень и геймификация */}
      {gam && (
        <section className="glass-card glossy-sheen scroll-sway mb-5 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="font-bold text-foreground">Уровень и достижения</h2>
            </div>
            <span className="rounded-full bg-primary-soft border border-primary/25 px-2.5 py-0.5 text-xs font-bold text-primary">
              Ур. {gam.level}
            </span>
          </div>

          {/* Прогресс-бар уровня */}
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{gam.levelTitle}</span>
            <span className="tabular-nums">
              {gam.xpInCurrentLevel} / {gam.xpToNextLevel} XP
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted/60 mb-4">
            <div
              className="macro-glossy h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 shadow-xs"
              style={{ width: `${gam.levelProgressPercent}%` }}
            />
          </div>

          {/* Импульс */}
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <Zap className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Импульс: {gam.momentumDays}/14 активных дней
            </span>
          </div>

          {/* Сегодняшние действия */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Сегодня заработано: +{gam.todayEarnedXp} XP
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <ActionItem done={gam.completedTodayActions.loggedMeal} label="Приём пищи записан" />
              <ActionItem done={gam.completedTodayActions.hitCalorieGoal} label="Калории в норме" />
              <ActionItem done={gam.completedTodayActions.hitProteinGoal} label="Белок в норме" />
              <ActionItem done={gam.completedTodayActions.loggedWeight} label="Вес зафиксирован" />
            </div>
          </div>

          {/* Бейджи */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              Достижения
            </div>
            <div className="grid grid-cols-2 gap-2">
              {gam.unlockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-all ${
                    badge.unlocked
                      ? "border-primary/30 bg-primary-soft/50"
                      : "border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <span className="text-lg shrink-0">{badge.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{badge.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {badge.progressText ?? (badge.unlocked ? "✓" : "—")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Режим экспериментов */}
      <section className="glass-card glossy-sheen scroll-sway-reverse mb-5 rounded-3xl p-5 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-violet-500" />
          <h2 className="font-bold text-foreground">Эксперименты</h2>
        </div>
        <div className="space-y-2.5">
          <ExperimentCard
            emoji="🥩"
            title="14 дней белка"
            description="Ежедневно выполняйте норму белка 14 дней подряд"
            progress={gam ? Math.min(14, gam.unlockedBadges.find(b => b.id === "protein_fan")?.unlocked ? 14 : (gam.momentumDays ?? 0)) : 0}
            total={14}
          />
          <ExperimentCard
            emoji="🎯"
            title="7 дней без переедания"
            description="Оставайтесь в рамках калорийности 7 дней"
            progress={gam ? Math.min(7, gam.unlockedBadges.find(b => b.id === "calorie_master")?.unlocked ? 7 : Math.min(gam.momentumDays, 7)) : 0}
            total={7}
          />
        </div>
      </section>

      {/* Прогноз веса */}
      <Link href="/stats" className="glass-card glossy-sheen scroll-sway spring-press mb-5 block touch-manipulation rounded-3xl p-5 shadow-md" aria-label="Открыть прогноз веса в статистике">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h2 className="font-bold text-foreground">Прогноз веса</h2>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {profile?.current_weight_kg
            ? `Текущий вес: ${profile.current_weight_kg} кг. Анализ динамики доступен в разделе статистики.`
            : "Добавьте вес в профиле, чтобы увидеть прогноз."}
        </p>
      </Link>

      {/* Модальные окна */}
      {showVoice && (
        <VoiceAssistantModal
          isOpen={showVoice}
          onClose={() => setShowVoice(false)}
          dateKey={today}
          consumedTotals={
            dayLog?.totals ?? {
              calories: 0,
              proteinG: 0,
              fatG: 0,
              carbsG: 0,
            }
          }
          targetCalories={targetCalories}
          macroTargets={macroTargets}
          eatenFoodNames={[
            ...new Set(
              (dayLog?.meals ?? []).flatMap((m) =>
                m.meal_items
                  .map((i) => i.custom_food_name)
                  .filter((n): n is string => Boolean(n)),
              ),
            ),
          ]}
          onOpenBalancer={() => {
            setShowVoice(false);
            setShowBalancer(true);
          }}
        />
      )}

      {showFridge && (
        <FridgeRecipeModal
          isOpen={showFridge}
          onClose={() => setShowFridge(false)}
          dateKey={today}
          remainingCalories={targetCalories - (dayLog?.totals.calories ?? 0)}
          remainingTotals={{
            calories: Math.max(
              0,
              targetCalories - (dayLog?.totals.calories ?? 0),
            ),
            proteinG: Math.max(
              0,
              macroTargets.proteinG - (dayLog?.totals.proteinG ?? 0),
            ),
            fatG: Math.max(
              0,
              macroTargets.fatG - (dayLog?.totals.fatG ?? 0),
            ),
            carbsG: Math.max(
              0,
              macroTargets.carbsG - (dayLog?.totals.carbsG ?? 0),
            ),
          }}
          macroTargets={macroTargets}
        />
      )}

      {showBalancer && (
        <MacroBalancer
          targetCalories={targetCalories}
          remainingCalories={Math.max(0, Math.round(targetCalories - (dayLog?.totals.calories ?? 0)))}
          targetMacros={macroTargets}
          remainingMacros={{
            proteinG: Math.max(0, Math.round(macroTargets.proteinG - (dayLog?.totals.proteinG ?? 0))),
            fatG: Math.max(0, Math.round(macroTargets.fatG - (dayLog?.totals.fatG ?? 0))),
            carbsG: Math.max(0, Math.round(macroTargets.carbsG - (dayLog?.totals.carbsG ?? 0))),
          }}
          dateKey={today}
          isOpen={showBalancer}
          onClose={() => setShowBalancer(false)}
        />
      )}
    </main>
  );
}

function ActionItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${done ? "bg-success-soft/60 text-success" : "bg-muted/40 text-muted-foreground"}`}>
      <span className="text-sm">{done ? "✅" : "⬜"}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ExperimentCard({
  emoji,
  title,
  description,
  progress,
  total,
}: {
  emoji: string;
  title: string;
  description: string;
  progress: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/50 p-3 transition-all">
      <span className="text-2xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {description}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-violet-500 transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
          {progress}/{total} дней
        </div>
      </div>
    </div>
  );
}
