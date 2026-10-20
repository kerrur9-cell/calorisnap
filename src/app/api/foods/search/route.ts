import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodItem } from "@/types/database";
import { foodMatchRank, normalizeFoodQuery, rankFoods } from "@/lib/food-search";

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
  const search = normalizeFoodQuery(q);

  const [searchResult, basicResult] = await Promise.all([search.length >= 2
    ? await supabase.rpc("search_foods", { p_query: search, p_limit: 50 })
        .select("id, name, name_local, barcode, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
    : await supabase.from("food_items")
        .select("id, name, name_local, barcode, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
        .order("is_verified", { ascending: false })
        .limit(limit),
    search.length >= 2 ? supabase.from("food_items")
      .select("id,name,name_local,barcode,calories_per_100g,protein_per_100g,fat_per_100g,carbs_per_100g,source,is_verified")
      .eq("is_verified", true).limit(500) : Promise.resolve({ data: [] }),
  ]);
  const { data, error } = searchResult;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawItems = (data ?? []) as Partial<FoodItem>[];
  // Fetch basic verified foods separately: RPC may fill its limit with branded products.
  const basics = ((basicResult.data ?? []) as Partial<FoodItem>[]).filter(item => foodMatchRank(item, search) < 99);
  const unique = [...new Map([...basics, ...rawItems].map(item => [item.id, item])).values()];
  const sortedItems = rankFoods(unique, search).slice(0, limit);
  return NextResponse.json({ items: sortedItems }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try { return await search(request); }
  catch { return NextResponse.json({ error: "Поиск временно недоступен" }, { status: 503 }); }
}
