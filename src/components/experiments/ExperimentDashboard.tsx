"use client";

import { useState } from "react";
import { FlaskConical, ChevronRight, CheckCircle, X, Trophy } from "lucide-react";
import {
  EXPERIMENT_PROTOCOLS,
  type ProtocolDefinition,
  type ExperimentDayLog,
} from "@/lib/experiments/engine";
import { useExperiments } from "@/hooks/useExperiments";

interface ExperimentDashboardProps {
  dayLogs?: ExperimentDayLog[];
  currentWeightKg?: number;
}

export function ExperimentDashboard({
  dayLogs = [],
  currentWeightKg,
}: ExperimentDashboardProps) {
  const { isLoaded, activeExperiment, evaluation, startExperiment, cancelExperiment } =
    useExperiments(dayLogs, currentWeightKg);

  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolDefinition | null>(null);

  if (!isLoaded) return null;

  return (
    <section className="space-y-4 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-primary-soft p-2 text-primary">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold">Режим экспериментов</h3>
            <p className="text-xs text-muted-foreground">Проверьте, какой протокол лучше подходит вашему телу</p>
          </div>
        </div>
      </div>

      {/* Активный эксперимент */}
      {activeExperiment && evaluation ? (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{evaluation.protocol.emoji}</span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {evaluation.isCompleted ? "Эксперимент завершён" : "Текущий протокол"}
                </span>
                <h4 className="text-sm font-bold text-foreground">{evaluation.protocol.title}</h4>
              </div>
            </div>

            <button
              onClick={cancelExperiment}
              className="text-xs text-muted-foreground hover:text-danger flex items-center gap-0.5"
              title="Отменить эксперимент"
            >
              <X className="h-3.5 w-3.5" />
              <span>Сбросить</span>
            </button>
          </div>

          {/* Прогресс-бар дней */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>День {evaluation.elapsedDays} из {evaluation.totalDays}</span>
              <span>Соблюдение: {Math.round(evaluation.complianceRate * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${Math.min(100, (evaluation.elapsedDays / evaluation.totalDays) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Результаты и изменения */}
          <div className="rounded-xl bg-background/80 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Дней по правилам:</span>
              <span className="font-bold">{evaluation.compliantDaysCount} из {evaluation.elapsedDays}</span>
            </div>
            {evaluation.weightDeltaKg !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Динамика веса:</span>
                <span className={`font-bold ${evaluation.weightDeltaKg <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                  {evaluation.weightDeltaKg > 0 ? `+${evaluation.weightDeltaKg}` : evaluation.weightDeltaKg} кг
                </span>
              </div>
            )}
            <p className="text-muted-foreground pt-1 border-t border-border/30 leading-relaxed">
              {evaluation.verdict}
            </p>
          </div>
        </div>
      ) : (
        /* Список доступных протоколов */
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground">
            Выберите диетический протокол на 7–14 дней. CaloriSnap будет ежедневно фиксировать соблюдение и подведёт честный итог.
          </p>

          <div className="grid gap-2">
            {EXPERIMENT_PROTOCOLS.map((proto) => (
              <button
                key={proto.id}
                onClick={() => setSelectedProtocol(proto)}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{proto.emoji}</span>
                  <div>
                    <div className="font-semibold text-xs text-foreground">{proto.title}</div>
                    <div className="text-[11px] text-muted-foreground">{proto.shortDescription}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Модальное окно деталей протокола и старта */}
      {selectedProtocol && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto space-y-4">
            <header className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedProtocol.emoji}</span>
                <div>
                  <h3 className="text-base font-bold">{selectedProtocol.title}</h3>
                  <p className="text-xs text-muted-foreground">{selectedProtocol.durationDays} дней эксперимента</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProtocol(null)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {selectedProtocol.detailedDescription}
            </p>

            <div className="space-y-1.5 rounded-2xl bg-muted/30 p-3 text-xs">
              <span className="font-bold text-foreground">Что даст эксперимент:</span>
              <ul className="space-y-1 text-muted-foreground">
                {selectedProtocol.expectedBenefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => {
                startExperiment(selectedProtocol.id, currentWeightKg);
                setSelectedProtocol(null);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
            >
              <Trophy className="h-4 w-4" />
              Начать {selectedProtocol.durationDays}-дневный эксперимент
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
