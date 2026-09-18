"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { todayKey } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function FoodAssistant({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(history: Message[]) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey(), messages: history.slice(-12) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Не удалось получить совет");
      setMessages([...history, { role: "assistant", content: json.answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось получить совет");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask([]);
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages]);

  function send() {
    const content = draft.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setDraft("");
    setMessages(next);
    void ask(next);
  }

  return (
    <section className="mt-4 w-full rounded-2xl bg-card p-4 shadow-sm" aria-label="Ассистент по питанию">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Что можно съесть?</h2>
        <button onClick={onClose} aria-label="Закрыть ассистента" className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Советы примерные. Ассистент учитывает сегодняшний дневник и ваши нормы.</p>
      <div className="max-h-80 space-y-3 overflow-y-auto text-sm" aria-live="polite">
        {messages.map((message, index) => (
          <p key={index} className={`whitespace-pre-wrap rounded-xl p-3 ${message.role === "user" ? "ml-7 bg-primary-soft" : "mr-4 bg-muted"}`}>{message.content}</p>
        ))}
        {loading && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Думаю над советом…</p>}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error} <button onClick={() => void ask(messages)} className="underline">Повторить</button></p>}
      <div className="mt-3 flex gap-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} maxLength={600} placeholder="Например: без молочных продуктов" aria-label="Сообщение ассистенту" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <button onClick={send} disabled={!draft.trim() || loading} aria-label="Отправить сообщение" className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </section>
  );
}
