"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UtensilsCrossed, Mail, Loader2 } from "lucide-react";
import { Captcha } from "@/components/app/Captcha";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"main" | "email">("main");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  // Supabase не настроен — показываем инструкцию, а не падаем
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-muted-foreground">
          Для входа настройте Supabase.
        </p>
        <a href="/setup" className="text-primary underline">
          Инструкция по настройке →
        </a>
      </main>
    );
  }

  const supabase = createClient();

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      setCaptchaToken(""); setCaptchaKey((v) => v + 1);
    } else {
      router.push("/day");
      router.refresh();
    }
  }

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) { setError("Введите email и пароль от 6 символов"); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, captchaToken },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      router.push("/day"); router.refresh();
    } else {
      setNotice("Проверьте почту и подтвердите регистрацию.");
      setLoading(false);
    }
    setCaptchaToken(""); setCaptchaKey((v) => v + 1);
  }

  async function signInAsGuest() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setError(error.message);
      setLoading(false);
      setCaptchaToken(""); setCaptchaKey((v) => v + 1);
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Лого */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-soft">
            <UtensilsCrossed className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">CaloriSnap</h1>
          <p className="text-center text-muted-foreground">
            Сфотографируй еду —<br />
            приложение само всё посчитает
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-danger-soft p-3 text-center text-sm text-danger">
            {error}
          </div>
        )}
        {notice && <p role="status" className="mb-4">{notice}</p>}
        <Captcha key={captchaKey} onToken={setCaptchaToken} />
        <p className="mb-4 text-xs text-muted-foreground">Продолжая, вы знакомитесь с <a href="/privacy" className="underline">обработкой данных</a>.</p>

        {mode === "main" ? (
          <div className="space-y-3">
            {/* Google */}
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5" />
                  Войти через Google
                </>
              )}
            </button>

            {/* Email */}
            <button
              onClick={() => setMode("email")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 font-medium transition-colors hover:bg-muted"
            >
              <Mail className="h-5 w-5" />
              Email и пароль
            </button>

            {/* Guest */}
            <button
              onClick={signInAsGuest}
              disabled={loading || (captchaRequired && !captchaToken)}
              className="w-full rounded-2xl py-3.5 font-medium text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                "Продолжить как гость"
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={signInWithEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={loading || (captchaRequired && !captchaToken)}
              className="w-full rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Войти"}
            </button>
            <button
              onClick={signUpWithEmail}
              type="button"
              disabled={loading || (captchaRequired && !captchaToken)}
              className="w-full rounded-2xl py-3.5 font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              Зарегистрироваться
            </button>
            <button
              type="button"
              onClick={() => setMode("main")}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Назад
            </button>
          </form>
        )}
      </div>
      <a href="https://world.openfoodfacts.org" className="mt-6 text-center text-xs text-muted-foreground underline">
        Данные о части продуктов: Open Food Facts (ODbL)
      </a>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
