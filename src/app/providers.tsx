"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Провайдеры для клиентских компонентов.
 * QueryClient создаётся здесь, чтобы каждый компонент не создавал свой.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  useEffect(() => {
    // Автоматическая перезагрузка при выходе новой версии приложения (ChunkLoadError)
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const message =
        "message" in event
          ? event.message
          : String((event as PromiseRejectionEvent).reason?.message || (event as PromiseRejectionEvent).reason || "");
      if (/Loading chunk .* failed/i.test(message) || /ChunkLoadError/i.test(message)) {
        const lastReload = Number(sessionStorage.getItem("last_chunk_reload") || "0");
        const now = Date.now();
        if (now - lastReload > 8_000) {
          sessionStorage.setItem("last_chunk_reload", String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadOldWorker = registrations.length > 0;
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("calorisnap-")).map((key) => caches.delete(key)));
        }
        if (hadOldWorker && !sessionStorage.getItem("calorisnap-cache-reset")) {
          sessionStorage.setItem("calorisnap-cache-reset", "1");
          window.location.reload();
        }
      })().catch(() => {});
    }
    if (!isSupabaseConfigured()) return;
    let previousId: string | null | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || (previousId !== undefined && previousId !== id)) queryClient.clear();
      previousId = id;
    });
    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
      subscription.unsubscribe();
    };
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
