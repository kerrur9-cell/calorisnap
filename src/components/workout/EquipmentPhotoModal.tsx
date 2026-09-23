"use client";

import { useState, useRef, ChangeEvent, useMemo } from "react";
import { Camera, X, AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import type { WorkoutEntry } from "@/lib/workout/types";
import { processImageFile } from "@/lib/image";
import { calculateDetailedWorkout } from "@/lib/workout/calculator";

interface EquipmentPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg: number;
  userHeightCm?: number;
  userGender: "male" | "female";
  userAge?: number;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

interface DetectedMachine {
  machineName: string;
  machineNameEn?: string;
  category: WorkoutEntry["category"];
  targetMuscles: string[];
  recommendedSets: number;
  recommendedReps: number;
  recommendedMinutes?: number;
  caloriesPerSet: number;
  caloriesPerMinute?: number;
  techniqueTip: string;
  safetyTip: string;
}

export function EquipmentPhotoModal({
  isOpen,
  onClose,
  userWeightKg,
  userHeightCm = 165,
  userGender,
  userAge = 25,
  onAddWorkout,
}: EquipmentPhotoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedMachine | null>(null);

  // Настройка параметров тренировки после распознавания
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(12);
  const [minutes, setMinutes] = useState(20);
  const [weightKg, setWeightKg] = useState<number>(30);
  const [aiRefinedAdvice, setAiRefinedAdvice] = useState<string | null>(null);
  const [aiCalories, setAiCalories] = useState<number | null>(null);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setDetected(null);
    setAiRefinedAdvice(null);
    setAiCalories(null);
    setIsSaved(false);

    try {
      setIsLoading(true);
      const img = await processImageFile(file);
      setPhotoPreview(`data:${img.mimeType};base64,${img.dataBase64}`);

      // Запрос к AI
      const res = await fetch("/api/ai/equipment-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: img.dataBase64,
          mimeType: img.mimeType,
          userWeightKg,
          userGender,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось распознать тренажер");
      }

      setDetected(data);
      setSets(data.recommendedSets || 3);
      setReps(data.recommendedReps || 12);
      if (data.recommendedMinutes) {
        setMinutes(data.recommendedMinutes);
      }
      // Подбираем адекватный стартовый вес
      const isLegs = /ногам|присед|мостик|гакк|ягодиц/i.test(data.machineName);
      setWeightKg(isLegs ? 50 : 25);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка при анализе фото");
    } finally {
      setIsLoading(false);
    }
  };

  const detailedCalc = useMemo(() => {
    if (!detected) return null;
    return calculateDetailedWorkout({
      exerciseName: detected.machineName,
      category: detected.category,
      sets: detected.category !== "cardio" ? sets : undefined,
      reps: detected.category !== "cardio" ? reps : undefined,
      weightKg: detected.category !== "cardio" ? weightKg : undefined,
      durationMinutes: detected.category === "cardio" ? minutes : undefined,
      userWeightKg,
      userHeightCm,
      userGender,
      userAge,
    });
  }, [detected, sets, reps, weightKg, minutes, userWeightKg, userHeightCm, userGender, userAge]);

  const handleRefineWithAi = async () => {
    if (!detected) return;
    setIsAiRefining(true);
    try {
      const isCardio = detected.category === "cardio";
      const queryText = isCardio
        ? `${detected.machineName} ${minutes} минут`
        : `${detected.machineName} ${sets} по ${reps} с весом ${weightKg} кг`;

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
        if (data.advice) setAiRefinedAdvice(data.advice);
        if (typeof data.caloriesBurned === "number") setAiCalories(data.caloriesBurned);
      }
    } catch {
      // ignore
    } finally {
      setIsAiRefining(false);
    }
  };

  const handleSave = () => {
    if (!detected) return;
    const finalCalories = aiCalories ?? (detailedCalc?.activeCalories ?? 0);
    onAddWorkout({
      exerciseName: detected.machineName,
      category: detected.category,
      durationMinutes: detected.category === "cardio" ? minutes : undefined,
      sets: detected.category !== "cardio" ? sets : undefined,
      reps: detected.category !== "cardio" ? reps : undefined,
      weightKg: detected.category !== "cardio" ? weightKg : undefined,
      caloriesBurned: finalCalories,
      grossCalories: detailedCalc?.grossCalories,
      activeCalories: finalCalories,
      met: detailedCalc?.met,
      userWeightUsedKg: detailedCalc?.userWeightKg ?? userWeightKg,
      calculationMethod: detailedCalc?.calculationMethod,
      calculationDetails: detailedCalc?.explanation,
      targetMuscles: detected.targetMuscles,
      notes: aiRefinedAdvice || detected.techniqueTip,
    });
    setIsSaved(true);
    setTimeout(() => {
      onClose();
      resetState();
    }, 700);
  };

  const resetState = () => {
    setPhotoPreview(null);
    setDetected(null);
    setAiCalories(null);
    setError(null);
    setIsSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass-card flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl overflow-y-auto animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
              <Camera className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base sm:text-lg leading-tight">
                Распознать тренажер
              </h2>
              <p className="text-xs text-muted-foreground">
                Фото тренажера в зале для автоматического расчёта
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              resetState();
            }}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Скрытый input для камеры и галереи */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Ошибки */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Загрузка фото, если еще не выбрано */}
        {!photoPreview && (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 p-8 text-center bg-muted/20">
            <div className="rounded-full bg-primary-soft p-4 text-primary mb-3">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">
              Сделайте фото тренажера
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-5">
              Наведите камеру на тренажер целиком, чтобы было видно сиденье и блоки
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-glossy spring-press flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md"
              >
                <Camera className="h-4 w-4" /> Открыть камеру / фото
              </button>
            </div>
          </div>
        )}

        {/* Превью и процесс анализа */}
        {photoPreview && (
          <div className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/80 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Тренажер"
                className="h-full w-full object-cover"
              />
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <div className="font-bold text-sm">AI анализирует тренажер...</div>
                  <div className="text-xs text-white/80 mt-1">
                    Определяем мышечные группы и биомеханику
                  </div>
                </div>
              )}
            </div>

            {/* Результат распознавания */}
            {detected && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-2 rounded-2xl bg-primary-soft/50 border border-primary/20 p-4">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Определено:
                    </span>
                    <h3 className="text-lg font-extrabold text-foreground mt-0.5">
                      {detected.machineName}
                    </h3>
                    {detected.machineNameEn && (
                      <div className="text-xs text-muted-foreground">
                        {detected.machineNameEn}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detected.targetMuscles.map((muscle) => (
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

                {/* Подсказки по технике и безопасности */}
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-foreground/90 space-y-1">
                  <div>
                    <span className="font-bold text-amber-600 dark:text-amber-400">Техника: </span>
                    {detected.techniqueTip}
                  </div>
                  {detected.safetyTip && (
                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-amber-500/20">
                      <span className="font-semibold">Безопасность: </span>{detected.safetyTip}
                    </div>
                  )}
                </div>

                {/* Настройка подходов */}
                {detected.category === "cardio" ? (
                  <div className="rounded-2xl border border-border/70 p-3 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
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
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/70 p-3">
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">
                          Подходы
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
                          Повторения
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
                          Рабочий вес на тренажере
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

                    {/* Кнопка запроса уточнения к ИИ */}
                    <button
                      type="button"
                      onClick={handleRefineWithAi}
                      disabled={isAiRefining}
                      className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft/90 border border-primary/30 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      {isAiRefining ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI уточняет параметры...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Уточнить технику и совет через ИИ
                        </>
                      )}
                    </button>

                    {aiRefinedAdvice && (
                      <div className="rounded-2xl bg-primary-soft/40 border border-primary/25 p-3 text-xs text-foreground/90 space-y-1 animate-fade-in">
                        <div className="font-bold text-primary flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" /> Совет ИИ тренера:
                        </div>
                        <p>{aiRefinedAdvice}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Карточка расчета калорий и кнопка добавления */}
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
                    disabled={isSaved}
                    className={`btn-glossy spring-press flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition-all ${
                      isSaved
                        ? "bg-success text-white"
                        : "bg-primary text-primary-foreground hover:opacity-95"
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-4 w-4" /> Сохранено!
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Добавить в расход
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Сделать другое фото
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
