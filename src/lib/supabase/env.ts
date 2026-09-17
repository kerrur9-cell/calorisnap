/**
 * Проверка переменных окружения Supabase.
 * Падаем с понятным сообщением, а не с «undefined is not a function».
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Не задана переменная окружения ${name}. ` +
        `Скопируйте .env.example в .env.local и заполните значения из Supabase.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/** Проверка без исключения — для UI, чтобы показать экран настройки вместо краша */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
