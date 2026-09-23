"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, LogIn, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    /Loading chunk .* failed/i.test(error?.message || "") ||
    /ChunkLoadError/i.test(error?.message || "");

  useEffect(() => {
    console.error("CaloriSnap render failure", {
      message: error.message,
      digest: error.digest ?? "client",
      stack: error.stack,
    });
  }, [error]);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  };

  const handleReload = () => {
    if (isChunkError) {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6 text-center"
      role="alert"
    >
      <div className="rounded-3xl bg-card border border-border/80 p-6 shadow-xl w-full space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-foreground">
            {isChunkError ? "Вышло обновление приложения" : "Не удалось открыть страницу"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isChunkError
              ? "Загружаем свежую версию CaloriSnap... Нажмите кнопку ниже, если страница не обновилась автоматически."
              : (error?.message || "Проверьте подключение и попробуйте ещё раз.")}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={handleReload}
            className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md"
          >
            <RefreshCw className="h-4 w-4" /> {isChunkError ? "Обновить приложение" : "Повторить попытку"}
          </button>

          {!isChunkError && (
            <button
              onClick={handleSignOut}
              className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-muted/80 border border-border/60 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <LogIn className="h-3.5 w-3.5" /> Войти заново в аккаунт
            </button>
          )}

          <Link
            href="/day"
            onClick={handleReload}
            className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" /> Вернуться на главную
          </Link>
        </div>
      </div>
    </main>
  );
}
