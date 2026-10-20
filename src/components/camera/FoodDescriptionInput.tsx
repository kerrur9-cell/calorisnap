"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MessageSquareText } from "lucide-react";

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void; stop(): void;
}

export function FoodDescriptionInput({ value, onChange, onAnalyze }: {
  value: string; onChange: (value: string) => void; onAnalyze: (description: string) => void;
}) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => {
    const active = recognition.current;
    if (active) { active.onresult = null; active.onerror = null; active.onend = null; active.abort(); }
  }, []);

  function dictate() {
    if (listening) { recognition.current?.stop(); return; }
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { setError("В этом браузере диктовка недоступна. Используйте микрофон на клавиатуре или введите текст."); return; }
    setError(null);
    const active = new Constructor();
    const initial = value.trim();
    active.lang = "ru-RU"; active.continuous = false; active.interimResults = true;
    active.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      onChange(`${initial}${initial && transcript ? " " : ""}${transcript}`.slice(0, 2000));
    };
    active.onerror = (event) => {
      setListening(false);
      setError(event.error === "not-allowed" ? "Разрешите доступ к микрофону в настройках браузера или введите текст." : "Не удалось расслышать. Попробуйте ещё раз или введите текст.");
    };
    active.onend = () => { setListening(false); recognition.current = null; };
    recognition.current = active;
    try { active.start(); setListening(true); }
    catch { setError("Не удалось включить микрофон. Введите текст или попробуйте ещё раз."); }
  }

  return (
    <details className="rounded-2xl border border-primary/25 bg-card p-4" onToggle={(event) => {
      if (!event.currentTarget.open) recognition.current?.stop();
    }}>
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Забыла сфоткать? Введи текстом
      </summary>
      <form className="mt-4 space-y-3" onSubmit={(event) => {
        event.preventDefault(); recognition.current?.stop();
        if (value.trim().length >= 3 && !listening) onAnalyze(value.trim());
      }}>
        <label htmlFor="food-description" className="block text-sm">Что ты съела или выпила?</label>
        <textarea id="food-description" value={value} onChange={(event) => onChange(event.target.value)}
          maxLength={2000} rows={4} placeholder="Например: два яйца, бутерброд с сыром и кофе с молоком"
          className="w-full rounded-xl border border-border bg-background p-3 text-base outline-none focus:border-primary" />
        <p className="text-xs text-muted-foreground">Можно без граммов: ИИ оценит порцию. Вес и КБЖУ приблизительные — их можно поправить перед сохранением.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={dictate} aria-pressed={listening}
            className="flex min-h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm">
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? "Остановить запись" : "Сказать голосом"}
          </button>
          <button type="submit" disabled={value.trim().length < 3 || listening}
            className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
            <MessageSquareText className="h-4 w-4" /> Разобрать еду
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{error || (listening ? "Слушаю… После диктовки проверь текст и нажми «Разобрать еду»." : "")}</p>
      </form>
    </details>
  );
}
