"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CaloriSnap global root failure", error);
  }, [error]);

  const handleHardRefresh = () => {
    // Clear any potential stale service worker caches and hard reload
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
    window.location.reload();
  };

  return (
    <html lang="ru">
      <body className="bg-background text-foreground antialiased font-sans">
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
                Не удалось загрузить страницу
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {error?.message || "Произошла ошибка при загрузке компонентов. Нажмите кнопку ниже, чтобы перезагрузить приложение."}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleHardRefresh}
                className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md"
              >
                <RefreshCw className="h-4 w-4" /> Обновить страницу
              </button>

              <button
                type="button"
                onClick={() => reset()}
                className="btn-glossy spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-muted/80 border border-border/60 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
