import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodItem } from "@/types/database";

export const runtime = "nodejs";

/**
 * Поиск продуктов по базе (pg_trgm уже проиндексирован).
 * Пустой запрос → популярные проверенные продукты.
 */
async function search(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(Math.floor(Number(request.nextUrl.searchParams.get("limit"))) || 20, 50));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  if (q.length > 100) return NextResponse.json({ error: "Слишком длинный запрос" }, { status: 400 });
  const search = q.replace(/[\\%_,().]/g, " ").trim();

  const { data, error } = search.length >= 2
    ? await supabase.rpc("search_foods", { p_query: search, p_limit: limit })
        .select("id, name, name_local, barcode, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
    : await supabase.from("food_items")
        .select("id, name, name_local, barcode, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
        .order("is_verified", { ascending: false })
        .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queryLower = search.toLowerCase();
  const rawItems = (data ?? []) as Partial<FoodItem>[];

  // Ранжирование: точные совпадения и совпадения с начала слова всегда выше
  const sortedItems = rawItems.sort((a, b) => {
    const rankA = getMatchRank(a, queryLower);
    const rankB = getMatchRank(b, queryLower);
    if (rankA !== rankB) return rankA - rankB;
    if (Boolean(b.is_verified) !== Boolean(a.is_verified)) {
      return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0);
    }
    return (a.name_local || a.name || "").localeCompare(b.name_local || b.name || "");
  });

  return NextResponse.json({ items: sortedItems }, { headers: { "Cache-Control": "private, no-store" } });
}

function getMatchRank(item: Partial<FoodItem>, queryLower: string): number {
  const name = (item.name ?? "").toLowerCase();
  const nameLocal = (item.name_local ?? "").toLowerCase();

  // 0. Точное совпадение строки
  if (nameLocal === queryLower || name === queryLower) return 0;

  // 1. Начинается с запроса
  if (nameLocal.startsWith(queryLower) || name.startsWith(queryLower)) return 1;

  // 2. Одно из слов начинается с запроса
  const wordsLocal = nameLocal.split(/[\s,·\-/]+/);
  const words = name.split(/[\s,·\-/]+/);
  if (wordsLocal.some((w) => w.startsWith(queryLower)) || words.some((w) => w.startsWith(queryLower))) return 2;

  // 3. Содержит подстроку
  if (nameLocal.includes(queryLower) || name.includes(queryLower)) return 3;

  // 4. Нечёткое совпадение (опечатка)
  return 4;
}

export async function GET(request: NextRequest) {
  try { return await search(request); }
  catch { return NextResponse.json({ error: "Поиск временно недоступен" }, { status: 503 }); }
}
