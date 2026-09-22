"use client";

import { useState } from "react";
import { useGamification } from "@/hooks/useGamification";
import { Trophy, Flame, X, Check } from "lucide-react";

export function GamificationBadge() {
  const { data: gamification } = useGamification();
  const [modalOpen, setModalOpen] = useState(false);

  if (!gamification) return null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs shadow-xs transition-all hover:bg-muted"
        title="Ваш прогресс и уровень"
        aria-label={`Уровень ${gamification.level}, ${gamification.xp} очков опыта`}
      >
        <div className="flex items-center gap-1 font-bold text-primary">
          <Trophy className="h-3.5 w-3.5" />
          <span>Ур. {gamification.level}</span>
        </div>

        <div className="h-3 w-px bg-border/80" />

        <div className="flex items-center gap-1 font-medium text-amber-500">
          <Flame className="h-3.5 w-3.5" />
          <span>{gamification.momentumDays} дн</span>
        </div>
      </button>

      {/* Модальное окно прогресса и достижений */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
            {/* iOS-стиль индикатор свайпа вниз */}
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />

            <header className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft p-2 text-primary">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold">Прогресс и Достижения</h2>
                  <p className="text-xs text-muted-foreground">{gamification.levelTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Карточка уровня */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary-soft/40 p-4 border border-primary/20">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Уровень {gamification.level}
                  </span>
                  <div className="text-lg font-bold mt-0.5">{gamification.levelTitle}</div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{gamification.xp} XP</span>
                  <div className="text-xs text-muted-foreground">всего опыта</div>
                </div>
              </div>

              {/* Шкала опыта */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{gamification.xpInCurrentLevel} XP</span>
                  <span>{gamification.xpToNextLevel} XP до след. уровня</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${gamification.levelProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Импульс без токсичности */}
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-amber-500/10 p-2 text-amber-500">
                  <Flame className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-semibold text-sm">Импульс: {gamification.momentumDays} из 14 дней</div>
                  <p className="text-muted-foreground mt-0.5">
                    Один пропущенный день не сбрасывает прогресс. Важна общая траектория.
                  </p>
                </div>
              </div>
            </div>

            {/* Сегодняшние действия */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Сегодняшний прогресс</span>
                <span className="text-primary font-bold">+{gamification.todayEarnedXp} XP</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <ActionStatusItem
                  title="Запись еды"
                  completed={gamification.completedTodayActions.loggedMeal}
                  xp="+15"
                />
                <ActionStatusItem
                  title="Цель по калориям"
                  completed={gamification.completedTodayActions.hitCalorieGoal}
                  xp="+40"
                />
                <ActionStatusItem
                  title="Норма белка"
                  completed={gamification.completedTodayActions.hitProteinGoal}
                  xp="+35"
                />
                <ActionStatusItem
                  title="Запись веса"
                  completed={gamification.completedTodayActions.loggedWeight}
                  xp="+20"
                />
                <ActionStatusItem
                  title="Учёт воды"
                  completed={gamification.completedTodayActions.loggedWater}
                  xp="+15"
                />
              </div>
            </div>

            {/* Достижения (Бейджи) */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-muted-foreground">Награды и бейджи</div>
              <div className="grid grid-cols-2 gap-2">
                {gamification.unlockedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-2xl border p-3 text-xs transition-all ${
                      badge.unlocked
                        ? "border-primary/30 bg-primary-soft/30"
                        : "border-border/40 bg-muted/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{badge.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{badge.title}</div>
                        {badge.progressText && !badge.unlocked && (
                          <span className="text-[10px] text-muted-foreground">{badge.progressText}</span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(false)}
              className="mt-2 w-full rounded-xl bg-muted py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ActionStatusItem({
  title,
  completed,
  xp,
}: {
  title: string;
  completed: boolean;
  xp: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-2.5 transition-colors ${
        completed
          ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
          : "border-border/40 bg-card text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-1.5 truncate">
        {completed ? (
          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
        )}
        <span className="truncate">{title}</span>
      </div>
      <span className="font-semibold shrink-0 text-[11px]">{xp} XP</span>
    </div>
  );
}
