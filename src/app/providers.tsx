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
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
