"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  X,
  Loader2,
  Sparkles,
  Check,
  ArrowRight,
  Volume2,
  VolumeX,
  Radio,
  Square,
  AlertCircle,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
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
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("snack");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  const cleanupAudioHardware = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
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
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isStartingRef.current = false;
  };

  const handleClose = () => {
    cleanupAudioHardware();
    setIsListening(false);
    setIsSpeaking(false);
    setRecordingSeconds(0);
    setTranscript("");
    setInfoAnswer(null);
    setParsedItems(null);
    setAiResponse(null);
    setAiTips(null);
    setStatus(null);
    setError(null);
    onClose();
  };

  // Очистка аппаратных ресурсов при размонтировании
  useEffect(() => {
    return () => {
      cleanupAudioHardware();
    };
  }, []);

  // Таймер длительности записи
  useEffect(() => {
    if (!isListening) return;

    const timer = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= 20) {
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isListening]);

  // Авто-остановка при 20 секундах
  useEffect(() => {
    if (recordingSeconds >= 20 && isListening) {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingSeconds, isListening]);

  // Запуск записи звука
  async function startListening() {
    if (isStartingRef.current || isListening || isProcessing) return;
    isStartingRef.current = true;
    setError(null);
    setInfoAnswer(null);
    setParsedItems(null);
    setAiResponse(null);
    setAiTips(null);
    setStatus(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Ваш браузер не поддерживает запись аудио");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        cleanupAudioHardware();
        setIsListening(false);
        setRecordingSeconds(0);
        setIsProcessing(false);
      };

      recorder.onstop = async () => {
        // Останавливаем стрим ПОСЛЕ завершения работы рекордера
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];

        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          await processRecordedAudio(audioBlob);
        } else {
          setIsProcessing(false);
          setIsListening(false);
        }
      };

      recorder.start(250);
      setIsListening(true);

      // Дополнительно: живой превью текста через Web Speech API (если поддерживается)
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
            // Игнорируем ошибки Google Speech
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setIsListening(false);
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Доступ к микрофону заблокирован. Разрешите микрофон в настройках браузера."
          : "Не удалось включить микрофон. Вы можете ввести запрос текстом ниже."
      );
    } finally {
      isStartingRef.current = false;
    }
  }

  // Остановка записи
  function stopListening(isCancel = false) {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsListening(false);

    if (isCancel) {
      cleanupAudioHardware();
      setIsListening(false);
      setIsProcessing(false);
      setRecordingSeconds(0);
      return;
    }

    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      setIsProcessing(true);
      try {
        rec.stop();
      } catch (err) {
        console.error("Error stopping recorder:", err);
        cleanupAudioHardware();
        setIsProcessing(false);
      }
    } else {
      cleanupAudioHardware();
      setIsProcessing(false);
    }
  }

  // Озвучивание ответа
  function speakText(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }

  function toggleSpeaking(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakText(text);
    }
  }

  // Обработка записанного аудиофайла
  async function processRecordedAudio(blob: Blob) {
    setIsProcessing(true);
    setError(null);
    setAiResponse(null);
    setAiTips(null);
    setStatus(null);

    // Если аудио слишком маленькое (< 500 байт), значит запись не состоялась
    if (blob.size < 500) {
      setIsProcessing(false);
      setIsListening(false);
      setError("Запись слишком короткая или микрофон не уловил звук.");
      setAiResponse(
        "Похоже, микрофон записал тишину. Нажмите кнопку записи, назовите блюда (например: «2 яйца и тост») и нажмите «Завершить запись»."
      );
      return;
    }

    // Если Web Speech уже распознал информационный запрос
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.error ?? "Не удалось распознать запись";
        setError(errorMsg);
        if (data?.aiResponse) {
          setAiResponse(data.aiResponse);
          speakText(data.aiResponse);
        }
        return;
      }

      if (data.transcript) {
        setTranscript(data.transcript);

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
          return;
        }
      }

      setStatus(data.status ?? "success");
      setParsedItems(data.items ?? []);

      if (data.aiResponse) {
        setAiResponse(data.aiResponse);
        speakText(data.aiResponse);
      }

      if (data.tips) {
        setAiTips(data.tips);
      }

      if (data.suggestedMealType) {
        setSelectedMealType(data.suggestedMealType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать запись");
      setAiResponse(
        "Произошла ошибка при обработке звука. Попробуйте повторить запись или введите продукты текстом в поле ниже."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  // Обработка текстовой фразы (ручной ввод)
  async function handleProcessPhrase(text: string) {
    if (!text.trim()) return;
    cleanupAudioHardware();
    setIsListening(false);
    setRecordingSeconds(0);
    setIsProcessing(true);
    setError(null);
    setInfoAnswer(null);
    setParsedItems(null);
    setAiResponse(null);
    setAiTips(null);
    setStatus(null);

    const intent = classifyVoiceIntent(text);

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

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMsg = data?.error ?? "Не удалось разобрать блюда";
        setError(errorMsg);
        if (data?.aiResponse) {
          setAiResponse(data.aiResponse);
          speakText(data.aiResponse);
        }
        return;
      }

      setStatus(data.status ?? "success");
      setParsedItems(data.items ?? []);

      if (data.aiResponse) {
        setAiResponse(data.aiResponse);
        speakText(data.aiResponse);
      }

      if (data.tips) {
        setAiTips(data.tips);
      }

      if (data.suggestedMealType) {
        setSelectedMealType(data.suggestedMealType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать блюда");
      setAiResponse("Не удалось обработать запрос. Пожалуйста, проверьте подключение к сети или повторите попытку.");
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
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
        {/* iOS-стиль индикатор свайпа вниз */}
        <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />

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

        {/* Анимация микрофона и кнопки управления */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <span className="absolute h-24 w-24 animate-ping rounded-full bg-red-500/25" />
                <span className="absolute h-20 w-20 animate-pulse rounded-full bg-red-500/40" />
              </>
            )}
            <button
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              disabled={isProcessing}
              className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
                isListening
                  ? "bg-red-500 text-white shadow-red-500/40 ring-4 ring-red-400/30"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              } disabled:opacity-50`}
              aria-label={isListening ? "Завершить запись" : "Начать запись"}
            >
              {isProcessing ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isListening ? (
                <Square className="h-7 w-7 fill-white" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-col items-center gap-2 text-xs font-semibold">
            {isListening ? (
              <>
                <span className="flex items-center gap-1.5 text-red-500 font-bold">
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  Запись: 0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 0:20
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => stopListening(false)}
                    className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Завершить запись
                  </button>
                  <button
                    onClick={() => stopListening(true)}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : isProcessing ? (
              <span className="flex items-center gap-1.5 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI распознаёт голос и считает калории...
              </span>
            ) : (
              <span className="text-muted-foreground">
                Нажмите на микрофон для записи
              </span>
            )}
          </div>
        </div>

        {/* Поле текста / транскрипта */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <input
            ref={inputRef}
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

        {/* Информативная плашка ошибки с кнопками быстрого действия */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <div className="rounded-full bg-red-500/20 p-1.5 text-red-500 shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="text-xs font-bold text-red-600 dark:text-red-400">
                  Что-то пошло не так
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {error}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-red-500/20">
              <button
                onClick={() => startListening()}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-red-600 active:scale-95 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Повторить запись
              </button>
              <button
                onClick={() => {
                  inputRef.current?.focus();
                }}
                className="rounded-lg bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                Ввести текстом
              </button>
            </div>
          </div>
        )}

        {/* Умный ответ / комментарий нейросети */}
        {aiResponse && (
          <div className="space-y-2.5 rounded-2xl border border-primary/25 bg-primary-soft/40 p-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/20 p-1 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {status === "question_answered"
                    ? "Ответ AI-нутрициолога"
                    : status === "not_food"
                    ? "Подсказка CaloriSnap"
                    : status === "clarification_needed"
                    ? "Уточнение порций"
                    : "AI-ассистент"}
                </span>
              </div>
              <button
                onClick={() => toggleSpeaking(aiResponse)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                  isSpeaking
                    ? "bg-primary text-primary-foreground animate-pulse"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title={isSpeaking ? "Остановить озвучку" : "Озвучить ответ"}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Стоп</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Озвучить</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs sm:text-sm font-medium leading-relaxed text-foreground">
              {aiResponse}
            </p>

            {aiTips && (
              <div className="flex items-start gap-1.5 rounded-xl bg-background/70 p-2 text-[11px] text-muted-foreground border border-border/40">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{aiTips}</span>
              </div>
            )}

            {/* Быстрые примеры для пробы, если еда ещё не распознана */}
            {(!parsedItems || parsedItems.length === 0) && (
              <div className="pt-2 border-t border-primary/15 space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Попробуйте нажать на пример:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "2 яйца и тост с авокадо",
                    "Сколько калорий в банане?",
                    "Овсянка 200г с мёдом",
                    "Что лучше съесть на ужин?",
                  ].map((sample) => (
                    <button
                      key={sample}
                      onClick={() => {
                        setTranscript(sample);
                        handleProcessPhrase(sample);
                      }}
                      className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-colors active:scale-95"
                    >
                      «{sample}»
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ответ на локальный детерминированный информационный запрос */}
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
