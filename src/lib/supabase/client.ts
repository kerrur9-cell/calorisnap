"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Клиент для клиентских компонентов. Сессия хранится в cookies. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
