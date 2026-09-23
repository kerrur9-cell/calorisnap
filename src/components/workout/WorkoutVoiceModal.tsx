"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Gauge,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Footprints,
  Activity,
  Lightbulb,
  MessageSquareText,
} from "lucide-react";
import type { WorkoutEntry } from "@/lib/workout/types";
import { calculateDetailedWorkout } from "@/lib/workout/calculator";

interface WorkoutVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg?: number | null;
  userHeightCm?: number;
  userGender?: "male" | "female";
  userAge?: number;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

interface RawAiResult {
  exerciseName: string;
  category: WorkoutEntry["category"];
  durationMinutes: number | null;
  durationExplicitlyProvided: boolean;
  speedKmh: number | null;
  speedExplicitlyProvided: boolean;
  inclinePercent: number | null;
  inclineExplicitlyProvided: boolean;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  targetMuscles: string[];
  isAmbiguous: boolean;
  ambiguityNote: string | null;
  commentary: string;
  needsDuration: boolean;
  needsWeight: boolean;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function WorkoutVoiceModal({
  isOpen,
  onClose,
  userWeightKg: initialUserWeightKg,
  userHeightCm = 165,
  userGender = "female",
  userAge = 25,
  onAddWorkout,
}: WorkoutVoiceModalProps) {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Пользовательский вес (из профиля или введённый вручную, если отсутствует)
  const [userWeight, setUserWeight] = useState<number>(
    initialUserWeightKg && initialUserWeightKg > 0 ? initialUserWeightKg : 0,
  );

  // Данные, полученные от AI
  const [rawAi, setRawAi] = useState<RawAiResult | null>(null);

  // Редактируемые пользователем параметры перед сохранением
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<WorkoutEntry["category"]>("cardio");
  const [editDuration, setEditDuration] = useState<number | null>(null);
  const [editSpeed, setEditSpeed] = useState<number | null>(null);
  const [editIncline, setEditIncline] = useState<number | null>(null);
  const [editSets, setEditSets] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);
  const [editLoadWeight, setEditLoadWeight] = useState<number | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [prevWeightProp, setPrevWeightProp] = useState(initialUserWeightKg);
  if (initialUserWeightKg !== prevWeightProp) {
    setPrevWeightProp(initialUserWeightKg);
    if (initialUserWeightKg && initialUserWeightKg > 0) {
      setUserWeight(initialUserWeightKg);
    }
  }

  // Инициализация Web Speech API
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "ru-RU";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(Object.values(event.results))
            .map((r) => r[0].transcript)
            .join("");
          setInputText(transcript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError("Голосовой ввод не поддерживается вашим браузером. Введите упражнение текстом.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setError(null);
      setInputText("");
      setRawAi(null);
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch {
        setIsRecording(false);
      }
    }
  };

  const handleParse = async (textToParse: string) => {
    const query = textToParse.trim();
    if (!query) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    setIsLoading(true);
    setError(null);
    setRawAi(null);

    try {
      const res = await fetch("/api/ai/workout-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query,
          userWeightKg: userWeight > 0 ? userWeight : undefined,
          userHeightCm,
          userGender,
          userAge,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось распознать упражнение");
      }

      setRawAi(data);
      setEditName(data.exerciseName);
      setEditCategory(data.category);
      setEditDuration(data.durationMinutes ?? null);
      setEditSpeed(data.speedKmh ?? null);
      setEditIncline(data.inclinePercent ?? null);
      setEditSets(data.sets ?? null);
      setEditReps(data.reps ?? null);
      setEditLoadWeight(data.weightKg ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка распознавания");
    } finally {
      setIsLoading(false);
    }
  };

  // Мгновенный локальный математический пересчёт при изменении любых параметров пользователем
  const calculated = useMemo(() => {
    if (!rawAi) return null;
    const effectiveWeight = userWeight > 0 ? userWeight : 55;

    return calculateDetailedWorkout({
      exerciseName: editName,
      category: editCategory,
      durationMinutes: editDuration,
      speedKmh: editSpeed,
      inclinePercent: editIncline,
      sets: editSets,
      reps: editReps,
      weightKg: editLoadWeight,
      userWeightKg: effectiveWeight,
      userHeightCm,
      userGender,
      userAge,
    });
  }, [
    rawAi,
    editName,
    editCategory,
    editDuration,
    editSpeed,
    editIncline,
    editSets,
    editReps,
    editLoadWeight,
    userWeight,
    userHeightCm,
    userGender,
    userAge,
  ]);

  const handleSave = () => {
    if (!calculated || isSaved) return;

    if (!userWeight || userWeight <= 0) {
      setError("Пожалуйста, укажите ваш вес для персонализированного расчёта.");
      return;
    }

    if (calculated.category === "cardio" && (!editDuration || editDuration <= 0)) {
      setError("Пожалуйста, укажите продолжительность тренировки в минутах.");
      return;
    }

    onAddWorkout({
      exerciseName: editName || calculated.exerciseName,
      category: editCategory,
      durationMinutes: editDuration ?? undefined,
      sets: editSets ?? undefined,
      reps: editReps ?? undefined,
      weightKg: editLoadWeight ?? undefined,
      // В суточный дефицит идёт активный расход, чтобы не дублировать BMR
      caloriesBurned: calculated.activeCalories,
      grossCalories: calculated.grossCalories,
      activeCalories: calculated.activeCalories,
      met: calculated.met,
      speedKmh: editSpeed ?? undefined,
      inclinePercent: editIncline ?? undefined,
      userWeightUsedKg: userWeight,
      calculationMethod: calculated.calculationMethod,
      calculationDetails: calculated.explanation,
      targetMuscles: rawAi?.targetMuscles,
      notes: rawAi?.commentary || undefined,
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
      resetState();
    }, 700);
  };

  const resetState = () => {
    setInputText("");
    setRawAi(null);
    setError(null);
    setIsSaved(false);
    setShowFormulaDetails(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass-card flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl overflow-y-auto animate-slide-up">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
              <Mic className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base sm:text-lg leading-tight">
                ИИ-трекер активности
              </h2>
              <p className="text-xs text-muted-foreground">
                Распознавание речи и расчёт по Compendium / ACSM
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

        {/* Проверка наличия веса пользователя */}
        {userWeight <= 0 && (
          <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Укажите ваш вес для точного расчёта:</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Формулы расхода энергии опираются на массу тела. Без веса расчёт не может быть объективным.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="30"
                max="250"
                step="0.5"
                placeholder="например 60"
                value={userWeight > 0 ? userWeight : ""}
                onChange={(e) => setUserWeight(parseFloat(e.target.value) || 0)}
                className="w-28 rounded-xl border border-amber-500/40 bg-background px-3 py-1.5 text-sm font-bold tabular-nums focus:outline-hidden"
              />
              <span className="text-xs text-foreground font-semibold">кг</span>
            </div>
          </div>
        )}

        {/* Ошибки */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Кнопка записи микрофона */}
        <div className="flex flex-col items-center justify-center py-2">
          <button
            type="button"
            onClick={toggleRecording}
            className={`btn-glossy spring-press relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
              isRecording
                ? "bg-danger text-white animate-pulse shadow-danger/40 scale-105"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            aria-label={isRecording ? "Остановить запись" : "Начать голосовой ввод"}
          >
            {isRecording ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </button>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">
            {isRecording ? "Слушаю... Говорите темп, скорость, время" : "Нажмите или напишите ниже"}
          </div>
        </div>

        {/* Текстовое поле ввода */}
        <div className="space-y-2 mb-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Например: 15 минут на беговой дорожке со скоростью 6.7 км/ч..."
            rows={2}
            className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-sm focus:border-primary focus:outline-hidden"
          />

          <button
            onClick={() => handleParse(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Распознавание параметров...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Распознать и рассчитать
              </>
            )}
          </button>
        </div>

        {/* Быстрые примеры */}
        {!rawAi && (
          <div className="mb-2">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
              Примеры:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "15 минут на беговой дорожке со скоростью 6.7 км/ч",
                "Быстрая ходьба в гору 30 минут с уклоном 5%",
                "Бег трусцой 25 минут 9 км/ч",
                "Жим ногами 4 подхода по 12 раз с весом 100 кг",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setInputText(example);
                    handleParse(example);
                  }}
                  className="rounded-full bg-muted/70 hover:bg-muted border border-border/60 px-2.5 py-1 text-[11px] text-foreground transition-colors text-left"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Результат распознавания и редактор параметров */}
        {rawAi && calculated && (
          <div className="space-y-3.5 rounded-2xl bg-primary-soft/40 border border-primary/25 p-4 animate-fade-in">
            {/* Заголовок активности и категория */}
            <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  Распознано ИИ
                </span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="font-extrabold text-base text-foreground bg-transparent border-b border-transparent hover:border-border/60 focus:border-primary focus:outline-hidden w-full block mt-0.5"
                />
              </div>

              {/* Селектор категории */}
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as WorkoutEntry["category"])}
                className="rounded-xl border border-border/70 bg-card px-2 py-1 text-xs font-semibold text-foreground focus:outline-hidden"
              >
                <option value="cardio">Кардио</option>
                <option value="strength">Силовая</option>
                <option value="machine">Тренажёр</option>
                <option value="bodyweight">Свой вес</option>
              </select>
            </div>

            {/* Подсказка при неоднозначности (например, 6.7 км/ч: шаг или бег) */}
            {rawAi.isAmbiguous && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-semibold mb-2">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>{rawAi.ambiguityNote || "Уточните тип движения для максимальной точности:"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditName("Быстрая ходьба на беговой дорожке");
                      setEditCategory("cardio");
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      /ходьб/i.test(editName)
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/80 text-foreground hover:bg-muted"
                    }`}
                  >
                    <Footprints className="h-3.5 w-3.5 shrink-0" />
                    <span>Ходьба (5.8 MET)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditName("Лёгкий бег трусцой");
                      setEditCategory("cardio");
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      /бег/i.test(editName)
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/80 text-foreground hover:bg-muted"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5 shrink-0" />
                    <span>Бег трусцой (7.0 MET)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Запрос времени, если пользователь его не назвал */}
            {(!editDuration || editDuration <= 0) && (
              <div className="rounded-xl bg-danger-soft border border-danger/30 p-2.5 text-xs text-danger space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Вы не указали время тренировки:
                </span>
                <p className="text-[11px]">Введите количество минут, чтобы рассчитать калории:</p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    placeholder="15"
                    value={editDuration ?? ""}
                    onChange={(e) => setEditDuration(parseInt(e.target.value, 10) || null)}
                    className="w-24 rounded-lg border border-danger/40 bg-background px-2.5 py-1 text-sm font-bold tabular-nums text-foreground focus:outline-hidden"
                  />
                  <span className="text-xs font-semibold text-foreground">минут</span>
                </div>
              </div>
            )}

            {/* Интерактивные параметры для редактирования */}
            <div className="rounded-2xl bg-card border border-border/70 p-3 space-y-2.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Параметры тренировки</span>
                <span className="text-[10px] lowercase font-normal text-muted-foreground">
                  (редактируйте — пересчёт мгновенный)
                </span>
              </div>

              {/* Кардио-параметры */}
              {editCategory === "cardio" && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Время */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                      <Clock className="h-3 w-3" /> Время
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="600"
                        value={editDuration ?? ""}
                        onChange={(e) => setEditDuration(parseInt(e.target.value, 10) || null)}
                        placeholder="мин"
                        className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                      />
                      <span className="text-[10px] text-muted-foreground ml-1">мин</span>
                    </div>
                  </div>

                  {/* Скорость */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                      <Gauge className="h-3 w-3" /> Скорость
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="40"
                        step="0.1"
                        value={editSpeed ?? ""}
                        onChange={(e) => setEditSpeed(parseFloat(e.target.value) || null)}
                        placeholder="км/ч"
                        className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                      />
                      <span className="text-[10px] text-muted-foreground ml-1">км/ч</span>
                    </div>
                  </div>

                  {/* Наклон */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                      <TrendingUp className="h-3 w-3" /> Уклон
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.5"
                        value={editIncline ?? ""}
                        onChange={(e) => setEditIncline(parseFloat(e.target.value) || null)}
                        placeholder="0%"
                        className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                      />
                      <span className="text-[10px] text-muted-foreground ml-1">%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Силовые параметры */}
              {editCategory !== "cardio" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-semibold">Подходы</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={editSets ?? ""}
                      onChange={(e) => setEditSets(parseInt(e.target.value, 10) || null)}
                      placeholder="3"
                      className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-semibold">Повторения</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editReps ?? ""}
                      onChange={(e) => setEditReps(parseInt(e.target.value, 10) || null)}
                      placeholder="12"
                      className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-semibold">Вес снаряда</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        max="400"
                        value={editLoadWeight ?? ""}
                        onChange={(e) => setEditLoadWeight(parseFloat(e.target.value) || null)}
                        placeholder="кг"
                        className="w-full rounded-xl border border-border/80 bg-muted/30 px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-hidden"
                      />
                      <span className="text-[10px] text-muted-foreground ml-1">кг</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Корректировка веса пользователя */}
              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">Вес пользователя:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <input
                    type="number"
                    min="30"
                    max="250"
                    step="0.5"
                    value={userWeight > 0 ? userWeight : ""}
                    onChange={(e) => setUserWeight(parseFloat(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-border/80 bg-muted/30 px-2 py-0.5 text-xs font-bold tabular-nums text-right focus:outline-hidden"
                  />
                  <span>кг</span>
                </div>
              </div>
            </div>

            {/* Карточка прозрачного расчёта калорий */}
            <div className="rounded-2xl bg-card border border-primary/30 p-3.5 space-y-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Активный расход в дефицит:
                  </div>
                  <div className="text-2xl font-extrabold text-primary tabular-nums">
                    ~{calculated.activeCalories}{" "}
                    <span className="text-xs font-normal text-foreground">ккал</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Полный расход:</div>
                  <div className="text-base font-bold text-foreground tabular-nums">
                    ~{calculated.grossCalories}{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">ккал</span>
                  </div>
                </div>
              </div>

              {/* Раскрывающийся блок объяснения формулы */}
              <div className="border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormulaDetails((s) => !s)}
                  className="flex items-center justify-between w-full text-[11px] font-bold text-primary hover:underline"
                >
                  <span className="flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> Как рассчитаны калории ({calculated.met} MET)?
                  </span>
                  {showFormulaDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {showFormulaDetails && (
                  <div className="mt-2 space-y-1.5 rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed animate-fade-in">
                    <div>
                      <strong className="text-foreground">Методика: </strong>
                      {calculated.calculationMethod === "acsm"
                        ? "Уравнение ACSM для беговой дорожки с учётом скорости и угла наклона."
                        : calculated.calculationMethod === "compendium"
                          ? "Compendium of Physical Activities (Ainsworth et al.)."
                          : "Физиологический учёт времени под нагрузкой (TUT) и мышечной работы."}
                    </div>
                    <div>
                      <strong className="text-foreground">Формула полного расхода: </strong>
                      {calculated.met} MET × {userWeight} кг × {(calculated.durationMinutes / 60).toFixed(2)} ч ={" "}
                      {calculated.grossCalories} ккал.
                    </div>
                    <div>
                      <strong className="text-foreground">Активный расход сверх покоя: </strong>
                      ({calculated.met} − 1) × {userWeight} кг × {(calculated.durationMinutes / 60).toFixed(2)} ч ={" "}
                      {calculated.activeCalories} ккал.
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                      ✓ Защита от двойного учёта: в суточный дефицит добавляются только активные {calculated.activeCalories} ккал, поскольку базовый обмен (BMR) уже учтён за все 24 часа.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Мышцы */}
            {rawAi.targetMuscles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {rawAi.targetMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Нейтральный комментарий */}
            {rawAi.commentary && (
              <div className="flex items-start gap-2 rounded-2xl bg-muted/30 border border-border/50 p-3 text-xs text-foreground/90">
                <MessageSquareText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="leading-relaxed">{rawAi.commentary}</span>
              </div>
            )}

            {/* Кнопка сохранить с защитой от двойного клика */}
            <button
              onClick={handleSave}
              disabled={isSaved || userWeight <= 0 || (editCategory === "cardio" && (!editDuration || editDuration <= 0))}
              className={`btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold shadow-md transition-all ${
                isSaved
                  ? "bg-success text-white"
                  : "bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50"
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4" /> Добавлено в расход!
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Добавить в дневник ({calculated.activeCalories} ккал)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
