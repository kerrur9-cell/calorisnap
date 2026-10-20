"use client";
import { useEffect, useState } from "react";

const kinds = [{ id: "hug", label: "Обнимашка", hint: "Тёплое сообщение и дневник" }, { id: "log", label: "Запиши вкусняшку", hint: "Открывает добавление еды" }, { id: "photo", label: "Фото-челлендж", hint: "Предлагает сфотографировать еду" }, { id: "idea", label: "Найди идею", hint: "Открывает хаб с ассистентом" }];
const code = "CAL-SZT7-KK3Z";
async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Сервер не ответил. Попробуйте снова.");
  return data;
}
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("hug");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void request("/api/admin/session", "GET").then(r => setAuthenticated(r.authenticated)).catch(() => {}); }, []);
  async function perform(task: () => Promise<void>) {
    setBusy(true); setStatus(""); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error && e.name === "TimeoutError" ? "Ответ задержался. Попробуйте ещё раз." : e instanceof Error ? e.message : "Ошибка запроса"); }
    finally { setBusy(false); }
  }
  return <main className="min-h-dvh bg-background px-5 py-10 text-foreground"><div className="mx-auto max-w-lg space-y-6">
    <header><p className="text-sm text-muted-foreground">CaloriSnap · личная панель</p><h1 className="mt-2 text-3xl font-bold">Маленькая забота о Даше</h1><p className="mt-3 text-sm text-muted-foreground">Сообщение, которое улыбнёт. Ничего не меняет в её дневнике без её действий.</p></header>
    {!authenticated ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void perform(async () => { await request("/api/admin/session", "POST", { password }); setPassword(""); setAuthenticated(true); }); }}>
      <label className="block text-sm">Пароль<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-card px-4" /></label>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Входим…" : "Войти"}</button>
    </form> : <>
      <div className="flex items-center justify-between gap-3 border-y border-border py-3"><span className="text-sm">Получатель: {code}</span><button disabled={busy} onClick={() => void perform(async () => { await request("/api/admin/session", "DELETE"); setAuthenticated(false); })} className="min-h-11 px-2 text-sm">Выйти</button></div>
      <fieldset><legend className="mb-3 font-semibold">Что отправим?</legend><div className="grid grid-cols-2 gap-3">{kinds.map(item => <label key={item.id} className={`cursor-pointer rounded-2xl border p-3 ${kind === item.id ? "border-primary bg-primary-soft" : "border-border bg-card"}`}><input type="radio" name="kind" value={item.id} checked={kind === item.id} onChange={() => setKind(item.id)} className="mr-2" /><span className="text-sm font-semibold">{item.label}</span><span className="mt-2 block text-xs text-muted-foreground">{item.hint}</span></label>)}</div></fieldset>
      <label className="block text-sm font-semibold">Текст сообщения<textarea maxLength={180} rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Дашуля, лови маленькую обнимашку…" className="mt-2 w-full rounded-2xl border border-border bg-card p-4 font-normal" /><span className="text-xs font-normal text-muted-foreground">{message.length}/180</span></label>
      <button disabled={busy} onClick={() => void perform(async () => { const data = await request("/api/admin/push", "POST", { operation: "generate", code, kind }); setMessage(data.message); if (!data.generated) setStatus("ИИ недоступен: подготовлен резервный текст. Его можно изменить."); })} className="min-h-12 w-full rounded-xl border border-primary text-primary disabled:opacity-50">{busy ? "Подождите…" : "Придумать с ИИ"}</button>
      {message && <section aria-label="Предпросмотр" className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Предпросмотр уведомления</p><p className="mt-2 text-sm leading-relaxed">{message}</p><p className="mt-3 text-xs text-primary">{kinds.find(i => i.id === kind)?.hint}</p></section>}
      <button disabled={busy || !message.trim()} onClick={() => void perform(async () => { const data = await request("/api/admin/push", "POST", { operation: "send", code, kind, message }); setStatus(`Push-сервис принял сообщение для ${data.accepted} устройства. ${data.failed ? `Не отправлено: ${data.failed}.` : ""} Получение зависит от телефона и разрешений.`); })} className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">Отправить Даше</button>
      <p className="text-xs text-muted-foreground">На iPhone кнопки внутри push могут не отображаться: нажатие на само сообщение откроет выбранный раздел.</p>
    </>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{status && <p role="status" className="text-sm text-primary">{status}</p>}
  </div></main>;
}
