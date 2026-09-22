"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, X, Sparkles, Check, Loader2, AlertCircle } from "lucide-react";
import type { WorkoutEntry } from "@/lib/workout/types";

interface WorkoutVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg: number;
  userHeightCm: number;
  userGender: "male" | "female";
  userAge: number;
  onAddWorkout: (workout: Omit<WorkoutEntry, "id" | "createdAt" | "entryDate">) => void;
}

interface ParsedWorkoutResult {
  exerciseName: string;
  category: WorkoutEntry["category"];
  durationMinutes?: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  caloriesBurned: number;
  targetMuscles: string[];
  advice: string;
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
  userWeightKg,
  userHeightCm,
  userGender,
  userAge,
  onAddWorkout,
}: WorkoutVoiceModalProps) {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedWorkoutResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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
      setParsedResult(null);
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
    setParsedResult(null);

    try {
      const res = await fetch("/api/ai/workout-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query,
          userWeightKg,
          userHeightCm,
          userGender,
          userAge,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось распознать упражнение");
      }

      setParsedResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка распознавания");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!parsedResult) return;
    onAddWorkout({
      exerciseName: parsedResult.exerciseName,
      category: parsedResult.category,
      durationMinutes: parsedResult.durationMinutes,
      sets: parsedResult.sets,
      reps: parsedResult.reps,
      weightKg: parsedResult.weightKg,
      caloriesBurned: parsedResult.caloriesBurned,
      targetMuscles: parsedResult.targetMuscles,
      notes: parsedResult.advice,
    });
    setIsSaved(true);
    setTimeout(() => {
      onClose();
      resetState();
    }, 700);
  };

  const resetState = () => {
    setInputText("");
    setParsedResult(null);
    setError(null);
    setIsSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass-card flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl overflow-y-auto animate-slide-up">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <div>
              <h2 className="font-bold text-foreground text-base sm:text-lg">
                Голосовой трекер упражнений
              </h2>
              <p className="text-xs text-muted-foreground">
                Скажите или напишите, что вы сделали
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

        {/* Ошибки */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Кнопка записи микрофона */}
        <div className="flex flex-col items-center justify-center py-4">
          <button
            type="button"
            onClick={toggleRecording}
            className={`btn-glossy spring-press relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all ${
              isRecording
                ? "bg-danger text-white ring-8 ring-danger/30 scale-105 animate-pulse"
                : "bg-primary text-primary-foreground hover:opacity-95"
            }`}
          >
            {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </button>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">
            {isRecording ? "Слушаю вас... Говорите" : "Нажмите, чтобы говорить"}
          </div>
        </div>

        {/* Текстовое поле ввода */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Например: Я сделала ягодичный мостик 4 подхода по 15 раз с гантелью 10 кг..."
              rows={3}
              className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3.5 text-sm focus:border-primary focus:outline-hidden"
            />
          </div>

          <button
            onClick={() => handleParse(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Рассчитываем калории...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Рассчитать расход
              </>
            )}
          </button>
        </div>

        {/* Быстрые подсказки */}
        {!parsedResult && (
          <div className="mb-2">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
              Примеры для быстрого ввода:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Ягодичный мостик 4 подхода по 15",
                "Ходьба в гору на дорожке 30 минут",
                "Жим ногами 3 по 12 раз",
                "Эллипс 20 минут в среднем темпе",
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

        {/* Результат распознавания */}
        {parsedResult && (
          <div className="space-y-3 rounded-2xl bg-primary-soft/50 border border-primary/20 p-4 animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold text-primary uppercase">
                  Распознано:
                </span>
                <h3 className="font-extrabold text-base text-foreground mt-0.5">
                  {parsedResult.exerciseName}
                </h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {parsedResult.durationMinutes
                    ? `${parsedResult.durationMinutes} мин`
                    : `${parsedResult.sets || 3} подх. × ${parsedResult.reps || 12} повт.`}
                  {parsedResult.weightKg ? ` · ${parsedResult.weightKg} кг` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-primary tabular-nums">
                  ~{parsedResult.caloriesBurned} <span className="text-xs font-normal text-foreground">ккал</span>
                </div>
              </div>
            </div>

            {/* Мышцы */}
            {parsedResult.targetMuscles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {parsedResult.targetMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Совет */}
            {parsedResult.advice && (
              <div className="rounded-xl bg-background/80 border border-border/60 p-2.5 text-xs text-foreground/90">
                💡 {parsedResult.advice}
              </div>
            )}

            {/* Кнопка сохранить */}
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold shadow-md transition-all ${
                isSaved
                  ? "bg-success text-white"
                  : "bg-primary text-primary-foreground hover:opacity-95"
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4" /> Добавлено в расход!
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Добавить в дневник расхода
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
