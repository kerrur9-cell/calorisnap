"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("CaloriSnap render failure", { digest: error.digest ?? "client" }); }, [error]);
  return <main className="mx-auto max-w-md space-y-4 p-6" role="alert">
    <h1>Не удалось открыть страницу</h1>
    <p>Проверьте подключение и попробуйте ещё раз.</p>
    <button onClick={reset} className="text-primary">Повторить</button>
  </main>;
}
