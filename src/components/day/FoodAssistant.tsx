"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Send, X, Sparkles, AlertCircle } from "lucide-react";
import { todayKey } from "@/lib/utils";
import type { AdviceResponse } from "@/lib/nutrition/advice";

type Message = { role: "user" | "assistant"; content: string; advice?: AdviceResponse };

export class FoodAssistantBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="mt-4 rounded-2xl bg-card p-4 text-sm" role="alert">Не удалось открыть ассистента. <button className="text-primary underline" onClick={() => this.setState({ failed: false })}>Попробовать снова</button></div>
      : this.props.children;
  }
}

function historyText(message: Message) {
  if (!message.advice) return message.content;
  const names = message.advice.recommendations.map((item) => item.name).join(" | ");
  return [message.advice.message, ...message.advice.highlights, names && `РЕКОМЕНДОВАНО: ${names}`].filter(Boolean).join("\n");
}

export function FoodAssistant({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function ask(history: Message[]) {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/ai/advice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey(), messages: history.slice(-12).map(({ role, ...message }) => ({ role, content: historyText({ role, ...message }) })) }),
      });
      const raw = await response.text();
      let json: { advice?: AdviceResponse; error?: string };
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("Ассистент временно недоступен. Нажмите «Повторить».");
      }
      if (!response.ok) throw new Error(json.error ?? "Не удалось получить совет");
      if (!json.advice) throw new Error("Ассистент не прислал ответ. Нажмите «Повторить».");
      const advice = json.advice;
      setMessages([...history, { role: "assistant", content: advice.message, advice }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось получить совет"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!started.current) { started.current = true; void ask([]); } }, []);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, loading]);

  function send() {
    const content = draft.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setDraft(""); setMessages(next); void ask(next);
  }

  return (
    <section className="mt-4 w-full rounded-3xl bg-card p-4 shadow-sm" aria-label="Ассистент по питанию">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="rounded-full bg-primary-soft p-2 text-primary"><Sparkles className="h-4 w-4" /></span><h2 className="font-semibold">Помощник по питанию</h2></div><button onClick={onClose} aria-label="Закрыть ассистента" className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4" /></button></div>
      <div ref={listRef} className="max-h-[30rem] space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map((message, index) => message.role === "user" ? (
          <p key={index} className="ml-10 rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{message.content}</p>
        ) : <AdviceCard key={index} advice={message.advice} fallback={message.content} />)}
        {loading && <div className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Думаю над ответом…</div>}
      </div>
      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger"><AlertCircle className="h-4 w-4" /> {error} <button onClick={() => void ask(messages)} className="underline">Повторить</button></p>}
      <div className="mt-3 flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} maxLength={600} placeholder="Например: без молочных продуктов" aria-label="Сообщение ассистенту" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /><button onClick={send} disabled={!draft.trim() || loading} aria-label="Отправить сообщение" className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button></div>
    </section>
  );
}

function AdviceCard({ advice, fallback }: { advice?: AdviceResponse; fallback: string }) {
  if (!advice) return <p className="mr-4 rounded-2xl bg-muted p-3 text-sm">{fallback}</p>;
  const noFood = advice.mode !== "normal";
  return <article className="rounded-2xl bg-muted p-3 text-sm">
    <p className="font-medium">{advice.message}</p>
    {advice.highlights.length > 0 && <div className="mt-3 grid gap-2">{advice.highlights.map((item) => <p key={item} className="rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">{item}</p>)}</div>}
    {!noFood && advice.recommendations.length > 0 && <div className="mt-3 space-y-2">{advice.recommendations.map((item) => <div key={`${item.name}-${item.portion}`} className="rounded-2xl bg-card p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.portion}</p></div><span className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{Math.round(item.calories)} ккал</span></div><p className="mt-2 text-xs text-muted-foreground">Б {item.protein} · Ж {item.fat} · У {item.carbs}</p><p className="mt-2 text-xs">{item.reason}</p></div>)}</div>}
  </article>;
}
