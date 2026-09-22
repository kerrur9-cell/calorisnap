"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Клиент для клиентских компонентов. Сессия хранится в cookies. Кэшируется как синглтон. */
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (clientInstance) return clientInstance;
  clientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return clientInstance;
}
