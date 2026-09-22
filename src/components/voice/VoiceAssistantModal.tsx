"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Loader2, Sparkles, Check, ArrowRight, Volume2, Radio } from "lucide-react";
import { classifyVoiceIntent, answerVoiceQuery, type VoiceQueryResult } from "@/lib/voice/intent";
import type { DayTotals, MacroTargets } from "@/lib/nutrition/macros";
import type { MealType } from "@/types/database";
import { saveMeal } from "@/lib/meals";
import { useQueryClient } from "@tanstack/react-query";
import { dayQueryKey, MEAL_TYPES } from "@/hooks/useDayLog";

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateKey: string;
  consumedTotals: DayTotals;
  targetCalories: number;
  macroTargets: MacroTargets;
  eatenFoodNames: string[];
  onOpenBalancer?: () => void;
}

interface ParsedFoodItem {
  name: string;
  weight_grams: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export function VoiceAssistantModal({
  isOpen,
  onClose,
  dateKey,
  consumedTotals,
  targetCalories,
  macroTargets,
  eatenFoodNames,
  onOpenBalancer,
}: VoiceAssistantModalProps) {
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [infoAnswer, setInfoAnswer] = useState<VoiceQueryResult | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedFoodItem[] | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("snack");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    setRecordingSeconds(0);
  };

  const handleClose = () => {
    cleanupAudio();
    setTranscript("");
    setInfoAnswer(null);
    setParsedItems(null);
    setError(null);
    onClose();
  };

  // Очистка при размонтировании или закрытии
  useEffect(() => {
    if (!isOpen) {
      cleanupAudio();
    }
    return () => {
      cleanupAudio();
    };
  }, [isOpen]);

  // Таймер длительности записи
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) {
            // Авто-остановка через 20 секунд
            stopListening();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isListening]);

  // Запуск записи звука
  async function startListening() {
    setError(null);
    setInfoAnswer(null);
    setParsedItems(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Ваш браузер не поддерживает запись аудио");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Определение поддерживаемого MIME-типа
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: mimeType.split(";")[0] ? mimeType : undefined });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audioBlob.size > 200) {
          await processRecordedAudio(audioBlob);
        } else {
          setIsProcessing(false);
        }
      };

      recorder.start(250); // собираем чанки каждые 250мс
      setIsListening(true);

      // Дополнительно запускаем Web Speech API для живого предпросмотра текста, если поддерживается
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = "ru-RU";
          recognition.continuous = true;
          recognition.interimResults = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (e: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = Array.from(e.results).map((r: any) => r[0].transcript).join("");
            if (text) setTranscript(text);
          };
          recognition.onerror = () => {
            // Игнорируем сетевые ошибки Google Speech — MediaRecorder сделает надежную запись
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Игнорируем
        }
      }
    } catch (err) {
      setIsListening(false);
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Доступ к микрофону заблокирован. Разрешите микрофон в настройках браузера."
          : "Не удалось получить доступ к микрофону. Введите запрос текстом."
      );
    }
  }

  // Остановка записи
  function stopListening() {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // Озвучивание ответа
  function speakText(text: string) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Обработка записанного аудиофайла
  async function processRecordedAudio(blob: Blob) {
    setIsProcessing(true);
    setError(null);

    // Если Web Speech уже распознал текстовый вопрос о дневнике, отвечаем сразу локально
    if (transcript.trim()) {
      const intent = classifyVoiceIntent(transcript);
      if (intent !== "LOG_FOOD" && intent !== "UNKNOWN") {
        const answer = answerVoiceQuery({
          intent,
          consumed: consumedTotals,
          targetCalories,
          targetMacros: macroTargets,
          eatenFoodNames,
        });
        setInfoAnswer(answer);
        speakText(answer.answerText);
        setIsProcessing(false);
        return;
      }
    }

    try {
      // Конвертируем Blob в Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(",");
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      const res = await fetch("/api/ai/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || "audio/webm",
          transcript: transcript.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось распознать голос");

      if (data.transcript) {
        setTranscript(data.transcript);

        // Проверяем, не был ли это вопрос
        const recognizedIntent = classifyVoiceIntent(data.transcript);
        if (recognizedIntent !== "LOG_FOOD" && recognizedIntent !== "UNKNOWN") {
          const answer = answerVoiceQuery({
            intent: recognizedIntent,
            consumed: consumedTotals,
            targetCalories,
            targetMacros: macroTargets,
            eatenFoodNames,
          });
          setInfoAnswer(answer);
          speakText(answer.answerText);
          setIsProcessing(false);
          return;
        }
      }

      setParsedItems(data.items ?? []);
      if (data.suggestedMealType) {
        setSelectedMealType(data.suggestedMealType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать запись");
    } finally {
      setIsProcessing(false);
    }
  }

  // Обработка текстовой фразы (ручной ввод)
  async function handleProcessPhrase(text: string) {
    if (!text.trim()) return;
    cleanupAudio();
    setIsProcessing(true);
    setError(null);
    setInfoAnswer(null);
    setParsedItems(null);

    const intent = classifyVoiceIntent(text);

    // Если это информационный вопрос о дневнике (сколько съел, сколько осталось и т.д.)
    if (intent !== "LOG_FOOD" && intent !== "UNKNOWN") {
      const answer = answerVoiceQuery({
        intent,
        consumed: consumedTotals,
        targetCalories,
        targetMacros: macroTargets,
        eatenFoodNames,
      });

      setInfoAnswer(answer);
      speakText(answer.answerText);
      setIsProcessing(false);
      return;
    }

    try {
      const res = await fetch("/api/ai/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось разобрать блюда");

      setParsedItems(data.items ?? []);
      if (data.suggestedMealType) {
        setSelectedMealType(data.suggestedMealType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать блюда");
    } finally {
      setIsProcessing(false);
    }
  }

  // Сохранение еды в дневник
  async function handleSaveMeals() {
    if (!parsedItems || parsedItems.length === 0) return;
    setIsSaving(true);
    setError(null);

    try {
      const mealId = crypto.randomUUID();
      await saveMeal({
        id: mealId,
        date: dateKey,
        type: selectedMealType,
        items: parsedItems.map((item, idx) => ({
          custom_food_name: item.name,
          weight_grams: item.weight_grams,
          calories: item.calories,
          protein_g: item.protein_g,
          fat_g: item.fat_g,
          carbs_g: item.carbs_g,
          weight_source: "manual",
          position: idx,
        })),
      });

      queryClient.invalidateQueries({ queryKey: dayQueryKey(dateKey) });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      handleClose();
    } catch {
      setError("Не удалось сохранить еду. Попробуйте ещё раз.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  const totalParsedCalories = (parsedItems ?? []).reduce((acc, it) => acc + it.calories, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto space-y-4">
        <header className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold">Голосовой ассистент</h2>
              <p className="text-xs text-muted-foreground">Скажите в микрофон или введите текст</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Закрыть" className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Анимация микрофона и кнопка */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <span className="absolute h-24 w-24 animate-ping rounded-full bg-red-500/20" />
                <span className="absolute h-20 w-20 animate-pulse rounded-full bg-primary/30" />
              </>
            )}
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
                isListening
                  ? "bg-red-500 text-white shadow-red-500/40"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              } disabled:opacity-50`}
              aria-label={isListening ? "Остановить запись" : "Начать запись"}
            >
              {isProcessing ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isListening ? (
                <Mic className="h-7 w-7 animate-pulse" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
            {isListening ? (
              <span className="flex items-center gap-1.5 text-red-500">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Идёт запись... 0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} (нажмите, чтобы завершить)
              </span>
            ) : isProcessing ? (
              <span className="flex items-center gap-1.5 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI распознаёт голос и считает калории...
              </span>
            ) : (
              <span className="text-muted-foreground">
                Нажмите на микрофон и назовите блюда
              </span>
            )}
          </div>
        </div>

        {/* Поле текста / транскрипта */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleProcessPhrase(transcript);
            }}
            placeholder="Например: Я съел 2 яйца и тост с авокадо"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {transcript && !isListening && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => handleProcessPhrase(transcript)}
                disabled={isProcessing}
                className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Отправить
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">
            {error}
          </div>
        )}

        {/* Ответ на информационный запрос */}
        {infoAnswer && (
          <div className="space-y-3 rounded-2xl bg-primary-soft/50 p-4 border border-primary/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Ответ</span>
              </div>
              <button
                onClick={() => speakText(infoAnswer.answerText)}
                className="text-xs text-primary underline"
              >
                Повторить голос
              </button>
            </div>
            <p className="text-sm font-medium leading-relaxed">{infoAnswer.answerText}</p>
            {infoAnswer.actionType === "open_balancer" && onOpenBalancer && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenBalancer();
                }}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary underline"
              >
                Открыть Балансировщик БЖУ →
              </button>
            )}
          </div>
        )}

        {/* Распознанные позиции еды */}
        {parsedItems && parsedItems.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase">Распознано:</span>
              <span className="text-xs font-bold text-primary">{Math.round(totalParsedCalories)} ккал</span>
            </div>

            <div className="space-y-2">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5">
                  <div>
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <span className="text-muted-foreground ml-1">· {item.weight_grams} г</span>
                  </div>
                  <div className="tabular-nums font-medium">
                    <span className="text-muted-foreground mr-2">Б {item.protein_g}</span>
                    <span>{Math.round(item.calories)} ккал</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Выбор приёма пищи */}
            <div className="pt-1">
              <div className="text-[11px] text-muted-foreground mb-1.5">Куда записать:</div>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TYPES.map((mt) => (
                  <button
                    key={mt.value}
                    onClick={() => setSelectedMealType(mt.value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedMealType === mt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {mt.emoji} {mt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveMeals}
              disabled={isSaving}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Записать в дневник
            </button>
          </div>
        )}

        <div className="pt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>Подсказки:</span>
          <span>«Сколько калорий осталось?», «Я съел борщ и хлеб»</span>
        </div>
      </div>
    </div>
  );
}
