import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Обновляет сессию Supabase на каждом запросе и возвращает текущего пользователя.
 * Без этого токен протухает и пользователя выкидывает из приложения.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let response = NextResponse.next({ request });

  // Supabase ещё не настроен — не мешаем приложению показать инструкцию.
  if (!isSupabaseConfigured()) {
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(
    SUPABASE_URL(),
    SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
