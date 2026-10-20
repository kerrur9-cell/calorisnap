"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2, Send } from "lucide-react";
import { usePathname } from "next/navigation";

type SavedPreference = { reminder_time: string; timezone: string; enabled: boolean } | null;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function apiRequest(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Не удалось выполнить запрос");
  return result;
}

export function NotificationSettings({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      const isSupported = window.isSecureContext
        && "serviceWorker" in navigator
        && "PushManager" in window
        && "Notification" in window;
      if (!active) return;
      setSupported(isSupported);
      setDismissed(localStorage.getItem("calorisnap_push_prompt_dismissed") === "1");
      if (!isSupported) {
        setPermission("unsupported");
        return;
      }

      setPermission(Notification.permission);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
        || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setInstalled(!isIos || isStandalone);

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const current = await registration?.pushManager.getSubscription();
        if (!active || !current) return;
        const result = await apiRequest(`/api/push/subscribe?endpoint=${encodeURIComponent(current.endpoint)}`, "GET");
        const preference = result.preference as SavedPreference;
        if (preference && active) {
          setSubscription(current);
          if (!preference.enabled) setSubscription(null);
        }
      } catch { /* The reminder is not enabled on this device yet. */ }
    })();
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!supported) throw new Error("Этот браузер не поддерживает push-уведомления. Откройте сайт в Safari или Chrome.");
      if (!installed) throw new Error("На iPhone сначала добавьте CaloriSnap на экран «Домой»: Поделиться → На экран «Домой», затем откройте приложение оттуда.");
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") throw new Error("Разрешите уведомления CaloriSnap в настройках браузера и попробуйте снова.");

      const { publicKey } = await apiRequest("/api/push/public-key", "GET");
      if (typeof publicKey !== "string") throw new Error("Push-уведомления ещё не настроены на сервере.");
      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Не удалось запустить уведомления. Обновите страницу и попробуйте снова.")), 12000))]);
      let current = await registration.pushManager.getSubscription();
      if (!current) {
        current = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        });
      }
      const json = current.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!p256dh || !auth) throw new Error("Браузер не создал корректную подписку. Попробуйте обновить страницу.");

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await apiRequest("/api/push/subscribe", "POST", {
        endpoint: current.endpoint,
        keys: { p256dh, auth },
        reminderTime: "11:00",
        timezone,
      });
      setSubscription(current);
      setMessage("Готово! Напоминания включены: 11:00, 15:00, 19:00 и иногда 20:30.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось включить уведомления.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/push/subscribe", "DELETE", { endpoint: subscription.endpoint });
      await subscription.unsubscribe().catch(() => false);
      setSubscription(null);
      setMessage("Напоминания выключены.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выключить уведомления.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/push/test", "POST", { endpoint: subscription.endpoint });
      setMessage("Тестовое уведомление отправлено на это устройство.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить тестовое уведомление.");
    } finally {
      setBusy(false);
    }
  }

  if (compact && (dismissed || subscription || permission === "denied" || pathname === "/profile")) return null;
  return (
    <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md">
      <div className="mb-2 flex items-center gap-2">
        {subscription ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-primary" />}
        <h2 className="font-semibold text-foreground">Напоминания на телефон</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        В 11:00, 15:00 и 19:00 по вашему часовому поясу — тёплые напоминания Даше. В половине дней — ещё одно в 20:30. Разрешение нужно дать только один раз.
      </p>
      {compact && <button type="button" onClick={() => { localStorage.setItem("calorisnap_push_prompt_dismissed", "1"); setDismissed(true); }} className="mb-3 min-h-11 text-xs text-muted-foreground">Не сейчас — позже включу в профиле</button>}

      {supported && installed && (
        <>
          <div className="flex flex-wrap gap-2">
            {subscription ? (
              <>
                <button type="button" onClick={sendTest} disabled={busy} className="btn-glossy spring-press flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Отправить тест
                </button>
                <button type="button" onClick={disable} disabled={busy} className="min-h-11 rounded-2xl border border-border px-4 text-sm font-medium text-muted-foreground disabled:opacity-50">
                  Выключить
                </button>
              </>
            ) : (
              <button type="button" onClick={enable} disabled={busy || permission === "denied"} className="btn-glossy spring-press flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Включить уведомления
              </button>
            )}
          </div>
        </>
      )}

      {!supported && <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Push-уведомления недоступны в этом браузере. Откройте CaloriSnap в Safari или Chrome.</p>}
      {supported && !installed && <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">На iPhone добавьте сайт на экран «Домой» через меню «Поделиться», откройте его как приложение и включите уведомления здесь.</p>}
      {permission === "denied" && <p className="mt-2 text-xs text-warning">Разрешение запрещено в браузере. Его можно изменить в настройках сайта на телефоне.</p>}
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      {message && <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-primary"><Check className="h-3.5 w-3.5" />{message}</p>}
    </section>
  );
}
