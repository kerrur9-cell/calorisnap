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
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
